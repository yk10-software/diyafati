-- =========================================================
-- ضيافتي — 03: الدوال (RPC) والـ triggers
-- الزبون ما بيكتب بالجداول مباشرة. كل شي بيمرّ من هون:
--   place_order(p_order)            → بيحفظ الطلب وبيحسب الأسعار عالسيرفر
--   get_order(p_token)              → صفحة متابعة الطلب
--   get_orders(p_tokens)            → صفحة «طلباتي»
--   check_coupon(p_code, p_subtotal)→ فحص الكوبون قبل الطلب (للعرض بس)
--   submit_review(p_token, ...)     → التقييم بعد التسليم
-- آمن لو شغّلته مرتين (create or replace).
--
-- الأخطاء بترجع برسالة إنكليزية قصيرة (error.message بـ supabase-js)،
-- والواجهة بتترجمها للعربي:
--   shop_closed, busy, too_many_orders, invalid_name, invalid_phone,
--   invalid_address, invalid_zone, empty_cart, product_unavailable,
--   invalid_qty, invalid_mode, scheduling_disabled, invalid_schedule,
--   outside_hours,
--   invalid_payment, payment_unavailable, invalid_coupon, coupon_min_total,
--   order_not_found, not_delivered, invalid_rating
-- =========================================================

-- ---------- updated_at لحاله ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

drop trigger if exists settings_touch on public.settings;
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

-- ---------- وقت كل حالة للطلب ----------
-- لما صاحب المحل يغيّر الحالة من اللوحة، بينحفظ الوقت لحاله
-- (هاد اللي بيطلع بصفحة المتابعة: «عم يتحضر 9:40 م»)
create or replace function public.stamp_order_status()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status is distinct from old.status then
    case new.status
      when 'preparing' then new.preparing_at := coalesce(new.preparing_at, now());
      when 'on_way'    then new.on_way_at    := coalesce(new.on_way_at, now());
      when 'delivered' then new.delivered_at := coalesce(new.delivered_at, now());
      when 'cancelled' then new.cancelled_at := coalesce(new.cancelled_at, now());
      else null;
    end case;
  end if;
  return new;
end $$;

drop trigger if exists orders_status_stamp on public.orders;
create trigger orders_status_stamp before update on public.orders
  for each row execute function public.stamp_order_status();

-- =========================================================
-- place_order
-- المدخل (JSON):
-- {
--   "name": "أم جود", "phone": "0944123456",
--   "zone_id": 1, "address": "دمشق، المزة، شارع الفيلات",
--   "delivery_mode": "asap" | "scheduled",
--   "scheduled_at": "2026-11-05T18:30:00+03:00",   -- بس مع scheduled
--   "payment_method": "cash" | "shamcash" | "bank",
--   "payment_account_id": 2,                         -- بس مع shamcash/bank
--   "notes": "...", "coupon_code": "EID10",
--   "items": [ { "product_id": 1, "qty": 1.5, "note": "أهلاً بجود" } ]
-- }
-- الأسعار اللي بيبعتها الزبون (إذا بعت) ما منستعملها أبداً.
-- =========================================================
create or replace function public.place_order(p_order jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s        public.settings;
  z        public.delivery_zones;
  acc      public.payment_accounts;
  c        public.coupons;
  pr       public.products;
  it       jsonb;
  v_name    text := left(btrim(coalesce(p_order->>'name', '')), 80);
  v_phone   text := left(btrim(coalesce(p_order->>'phone', '')), 30);
  v_address text := left(btrim(coalesce(p_order->>'address', '')), 300);
  v_notes   text := left(btrim(coalesce(p_order->>'notes', '')), 500);
  v_mode    text := coalesce(p_order->>'delivery_mode', 'asap');
  v_method  text := coalesce(p_order->>'payment_method', 'cash');
  v_coupon  text := nullif(upper(btrim(coalesce(p_order->>'coupon_code', ''))), '');
  v_sched   timestamptz;
  v_qty     numeric;
  v_price   bigint;
  v_line    bigint;
  v_subtotal bigint := 0;
  v_discount bigint := 0;
  v_fee      bigint;
  v_total    bigint;
  v_payment_label text := 'كاش عند الاستلام';
  v_lines  jsonb := '[]'::jsonb;
  v_code   text;
  v_token  text;
  v_id     uuid;
  v_ref    uuid := nullif(p_order->>'client_ref', '')::uuid;
  v_old    public.orders;
begin
  -- نفس الطلب وصل مرتين (النت ضعيف والزبون رجع كبس): منرجّع الطلب نفسه
  if v_ref is not null then
    select * into v_old from public.orders where client_ref = v_ref;
    if found then
      return jsonb_build_object(
        'id',            v_old.id,
        'code',          v_old.code,
        'token',         v_old.token,
        'subtotal',      v_old.subtotal,
        'discount',      v_old.discount,
        'delivery_fee',  v_old.delivery_fee,
        'total',         v_old.total,
        'payment_label', v_old.payment_label,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'product_id', i.product_id, 'name', i.name, 'image', i.image, 'unit', i.unit,
            'qty', i.qty, 'unit_price', i.unit_price, 'line_total', i.line_total, 'note', i.note
          ) order by i.id)
          from public.order_items i where i.order_id = v_old.id
        ), '[]'::jsonb)
      );
    end if;
  end if;

  -- المحل مفتوح؟
  select * into s from public.settings where id = 1;
  if not found or not s.shop_open then
    raise exception 'shop_closed';
  end if;

  -- حماية بسيطة من الإزعاج
  if (select count(*) from public.orders where created_at > now() - interval '1 minute') >= 30 then
    raise exception 'busy';
  end if;
  if (select count(*) from public.orders
      where phone = v_phone and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'too_many_orders';
  end if;

  -- بيانات الزبون
  if length(v_name) < 2 then raise exception 'invalid_name'; end if;
  if length(regexp_replace(v_phone, '\D', '', 'g')) < 9 then raise exception 'invalid_phone'; end if;
  if length(v_address) < 3 then raise exception 'invalid_address'; end if;

  -- منطقة التوصيل
  select * into z from public.delivery_zones
  where id = nullif(p_order->>'zone_id', '')::bigint and active;
  if not found then raise exception 'invalid_zone'; end if;
  v_fee := z.fee;  -- فاضي = حسب الاتفاق، وما بينحسب بالمجموع

  -- الأصناف
  if jsonb_typeof(p_order->'items') is distinct from 'array'
     or jsonb_array_length(p_order->'items') = 0 then
    raise exception 'empty_cart';
  end if;
  if jsonb_array_length(p_order->'items') > 60 then
    raise exception 'invalid_qty';
  end if;

  for it in select value from jsonb_array_elements(p_order->'items') loop
    select p.* into pr
    from public.products p
    left join public.categories cat on cat.id = p.category_id
    where p.id = nullif(it->>'product_id', '')::bigint
      and not p.hidden
      and p.available
      and (cat.id is null or (not cat.hidden and not cat.coming_soon));
    if not found then raise exception 'product_unavailable'; end if;

    v_qty := nullif(it->>'qty', '')::numeric;
    if v_qty is null or v_qty <= 0 or v_qty > 1000 then raise exception 'invalid_qty'; end if;
    if pr.unit = 'كيلو' then
      -- خطوة نص كيلو، ومو أقل من الحد الأدنى
      if v_qty * 2 <> trunc(v_qty * 2) or v_qty < s.min_kilo then raise exception 'invalid_qty'; end if;
    else
      if v_qty <> trunc(v_qty) then raise exception 'invalid_qty'; end if;
    end if;

    -- سعر الخصم إذا لسا شغّال
    v_price := case
      when pr.sale_price is not null and (pr.sale_until is null or pr.sale_until > now())
        then pr.sale_price
      else pr.price
    end;
    v_line := round(v_price * v_qty)::bigint;
    v_subtotal := v_subtotal + v_line;

    v_lines := v_lines || jsonb_build_object(
      'product_id', pr.id,
      'name',       pr.name,
      'image',      pr.images[1],
      'unit',       pr.unit,
      'qty',        v_qty,
      'unit_price', v_price,
      'line_total', v_line,
      'note',       left(btrim(coalesce(it->>'note', '')), 200)
    );
  end loop;

  -- الموعد
  if v_mode = 'scheduled' then
    if not s.scheduled_enabled then raise exception 'scheduling_disabled'; end if;
    v_sched := nullif(p_order->>'scheduled_at', '')::timestamptz;
    if v_sched is null
       or v_sched < now()
       or v_sched > now() + make_interval(days => s.schedule_max_days) then
      raise exception 'invalid_schedule';
    end if;
    -- الموعد لازم يكون ضمن دوام المحل بتوقيت دمشق
    if (v_sched at time zone 'Asia/Damascus')::time not between s.open_time and s.close_time then
      raise exception 'outside_hours';
    end if;
  elsif v_mode <> 'asap' then
    raise exception 'invalid_mode';
  end if;

  -- طريقة الدفع
  if v_method = 'cash' then
    if not s.cash_enabled then raise exception 'payment_unavailable'; end if;
  elsif v_method in ('shamcash', 'bank') then
    select * into acc from public.payment_accounts
    where id = nullif(p_order->>'payment_account_id', '')::bigint
      and active and kind = v_method;
    if not found then raise exception 'payment_unavailable'; end if;
    v_payment_label := acc.title || ': ' || acc.account_number;
  else
    raise exception 'invalid_payment';
  end if;

  -- الكوبون (for update لحتى ما يتجاوز max_uses لو انطلب طلبين بنفس اللحظة)
  if v_coupon is not null then
    select * into c from public.coupons
    where upper(code) = v_coupon
      and active
      and (expires_at is null or expires_at > now())
      and (max_uses is null or used_count < max_uses)
    for update;
    if not found then raise exception 'invalid_coupon'; end if;
    if v_subtotal < c.min_total then raise exception 'coupon_min_total'; end if;

    v_discount := case c.kind
      when 'percent' then floor(v_subtotal * c.value / 100.0)::bigint
      else least(c.value, v_subtotal)
    end;
    update public.coupons set used_count = used_count + 1 where id = c.id;
    v_coupon := c.code;
  end if;

  v_total := v_subtotal - v_discount + coalesce(v_fee, 0);

  -- رقم الطلب للعرض (D + 5 أرقام) والتوكن السري (64 حرف عشوائي)
  loop
    v_code := 'D' || lpad(floor(random() * 100000)::int::text, 5, '0');
    exit when not exists (select 1 from public.orders o where o.code = v_code);
  end loop;
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  insert into public.orders (
    code, token, client_ref, customer_name, phone, zone_id, zone_name, address,
    delivery_mode, scheduled_at, payment_method, payment_account_id, payment_label,
    notes, coupon_code, subtotal, discount, delivery_fee, total
  ) values (
    v_code, v_token, v_ref, v_name, v_phone, z.id, z.name, v_address,
    v_mode, v_sched, v_method, acc.id, v_payment_label,
    v_notes, v_coupon, v_subtotal, v_discount, v_fee, v_total
  )
  returning id into v_id;

  insert into public.order_items (order_id, product_id, name, image, unit, qty, unit_price, line_total, note)
  select v_id,
         (l->>'product_id')::bigint, l->>'name', l->>'image', l->>'unit',
         (l->>'qty')::numeric, (l->>'unit_price')::bigint, (l->>'line_total')::bigint, l->>'note'
  from jsonb_array_elements(v_lines) l;

  -- الأرقام النهائية من السيرفر، الواجهة بتستعملها برسالة الواتس
  return jsonb_build_object(
    'id',            v_id,
    'code',          v_code,
    'token',         v_token,
    'subtotal',      v_subtotal,
    'discount',      v_discount,
    'delivery_fee',  v_fee,
    'total',         v_total,
    'payment_label', v_payment_label,
    'items',         v_lines
  );
end $$;

-- =========================================================
-- get_order: الزبون بيشوف طلبه بس إذا معه التوكن
-- =========================================================
create or replace function public.get_order(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id',             o.id,
    'code',           o.code,
    'status',         o.status,
    'customer_name',  o.customer_name,
    'phone',          o.phone,
    'zone_name',      o.zone_name,
    'address',        o.address,
    'delivery_mode',  o.delivery_mode,
    'scheduled_at',   o.scheduled_at,
    'payment_method', o.payment_method,
    'payment_label',  o.payment_label,
    'notes',          o.notes,
    'coupon_code',    o.coupon_code,
    'subtotal',       o.subtotal,
    'discount',       o.discount,
    'delivery_fee',   o.delivery_fee,
    'total',          o.total,
    'created_at',     o.created_at,
    'preparing_at',   o.preparing_at,
    'on_way_at',      o.on_way_at,
    'delivered_at',   o.delivered_at,
    'cancelled_at',   o.cancelled_at,
    'token',          o.token,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_id', i.product_id, 'name', i.name, 'image', i.image, 'unit', i.unit,
        'qty', i.qty, 'unit_price', i.unit_price, 'line_total', i.line_total, 'note', i.note
      ) order by i.id)
      from public.order_items i where i.order_id = o.id
    ), '[]'::jsonb),
    'review', (
      select jsonb_build_object('rating', r.rating, 'comment', r.comment)
      from public.reviews r where r.order_id = o.id
    )
  )
  from public.orders o
  where length(coalesce(p_token, '')) >= 32
    and o.token = p_token;
$$;

-- =========================================================
-- get_orders: لصفحة «طلباتي» (قائمة التوكنات من localStorage)
-- =========================================================
create or replace function public.get_orders(p_tokens text[])
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x order by x->>'created_at' desc), '[]'::jsonb)
  from (
    select public.get_order(t) as x
    from unnest(p_tokens[1:50]) as t
  ) q
  where x is not null;
$$;

-- =========================================================
-- check_coupon: لعرض الخصم بالسلة قبل الطلب.
-- الحساب الحقيقي بيصير من جديد جوا place_order.
-- =========================================================
create or replace function public.check_coupon(p_code text, p_subtotal bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c public.coupons;
  v_discount bigint;
begin
  select * into c from public.coupons
  where upper(code) = upper(btrim(coalesce(p_code, '')))
    and active
    and (expires_at is null or expires_at > now())
    and (max_uses is null or used_count < max_uses);
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid_coupon');
  end if;
  if coalesce(p_subtotal, 0) < c.min_total then
    return jsonb_build_object('ok', false, 'reason', 'coupon_min_total', 'min_total', c.min_total);
  end if;

  v_discount := case c.kind
    when 'percent' then floor(coalesce(p_subtotal, 0) * c.value / 100.0)::bigint
    else least(c.value, coalesce(p_subtotal, 0))
  end;
  return jsonb_build_object(
    'ok', true, 'code', c.code, 'kind', c.kind, 'value', c.value, 'discount', v_discount
  );
end $$;

-- =========================================================
-- submit_review: تقييم بالنجوم، بس بعد ما يتسلّم الطلب.
-- بيقدر يعدّل تقييمه، بس بيرجع مخفي لحتى يوافق عليه صاحب المحل.
-- =========================================================
create or replace function public.submit_review(p_token text, p_rating int, p_comment text default '')
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders;
begin
  select * into o from public.orders
  where length(coalesce(p_token, '')) >= 32 and token = p_token;
  if not found then raise exception 'order_not_found'; end if;
  if o.status <> 'delivered' then raise exception 'not_delivered'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'invalid_rating'; end if;

  insert into public.reviews (order_id, name, rating, comment)
  values (o.id, o.customer_name, p_rating, left(btrim(coalesce(p_comment, '')), 500))
  on conflict (order_id) do update
    set rating = excluded.rating,
        comment = excluded.comment,
        is_public = false;
  return true;
end $$;

-- ---------- مين بيقدر يستدعي الدوال ----------
revoke all on function public.place_order(jsonb)          from public;
revoke all on function public.get_order(text)             from public;
revoke all on function public.get_orders(text[])          from public;
revoke all on function public.check_coupon(text, bigint)  from public;
revoke all on function public.submit_review(text, int, text) from public;

grant execute on function public.place_order(jsonb)          to anon, authenticated;
grant execute on function public.get_order(text)             to anon, authenticated;
grant execute on function public.get_orders(text[])          to anon, authenticated;
grant execute on function public.check_coupon(text, bigint)  to anon, authenticated;
grant execute on function public.submit_review(text, int, text) to anon, authenticated;
