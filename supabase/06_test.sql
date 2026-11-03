-- =========================================================
-- ضيافتي — 06: فحص الصلاحيات والطلب
-- بيتصرّف كأنه زبون (anon) وبيجرّب: طلب صحيح، محاولات غش، وقراءة ممنوعة.
-- كل شي جوا transaction وبينلغى بالآخر (rollback)، يعني ما بيترك طلبات وهمية.
-- إذا خلص بدون أحمر = كلشي تمام. إذا في مشكلة بيطلع خطأ أوله «FAIL».
-- =========================================================

begin;
set local role anon;

do $$
declare
  v_zone    bigint;
  v_product bigint;
  v_price   bigint;
  v_fee     bigint;
  r jsonb;
  o jsonb;
begin
  select id, fee into v_zone, v_fee from public.delivery_zones where fee is not null order by sort_order limit 1;
  select id, price into v_product, v_price from public.products where unit = 'كيلو' and available order by id limit 1;
  if v_zone is null or v_product is null then
    raise exception 'FAIL: الزبون ما عم يشوف المناطق أو الأصناف (شغّلت 04_seed.sql؟)';
  end if;

  -- 1) طلب صحيح: كيلو ونص، والسعر اللي بعتناه (1) لازم ينتجاهل
  r := public.place_order(jsonb_build_object(
    'name', 'تجربة', 'phone', '0944000000', 'zone_id', v_zone, 'address', 'دمشق، تجربة',
    'delivery_mode', 'asap', 'payment_method', 'cash',
    'items', jsonb_build_array(jsonb_build_object('product_id', v_product, 'qty', 1.5, 'price', 1))
  ));
  if (r->>'subtotal')::bigint <> round(v_price * 1.5) then
    raise exception 'FAIL: المجموع غلط %', r;
  end if;
  if (r->>'total')::bigint <> round(v_price * 1.5) + v_fee then
    raise exception 'FAIL: أجور التوصيل ما انحسبت %', r;
  end if;
  if length(r->>'token') < 64 then
    raise exception 'FAIL: التوكن قصير';
  end if;

  -- 2) متابعة الطلب بالتوكن
  o := public.get_order(r->>'token');
  if o is null or o->>'code' <> r->>'code' or jsonb_array_length(o->'items') <> 1 then
    raise exception 'FAIL: get_order ما رجّع الطلب';
  end if;
  if public.get_order('wrong-token-wrong-token-wrong-token') is not null then
    raise exception 'FAIL: get_order رجّع طلب بتوكن غلط';
  end if;
  if jsonb_array_length(public.get_orders(array[r->>'token'])) <> 1 then
    raise exception 'FAIL: get_orders';
  end if;

  -- 3) كمية مو مضاعف نص كيلو لازم تنرفض
  begin
    perform public.place_order(jsonb_build_object(
      'name', 'تجربة', 'phone', '0944000001', 'zone_id', v_zone, 'address', 'دمشق',
      'items', jsonb_build_array(jsonb_build_object('product_id', v_product, 'qty', 0.3))
    ));
    raise exception 'FAIL: قبل كمية 0.3 كيلو';
  exception when others then
    if sqlerrm <> 'invalid_qty' then raise; end if;
  end;

  -- 4) كوبون مو موجود لازم ينرفض
  begin
    perform public.place_order(jsonb_build_object(
      'name', 'تجربة', 'phone', '0944000002', 'zone_id', v_zone, 'address', 'دمشق',
      'coupon_code', 'NOPE-123',
      'items', jsonb_build_array(jsonb_build_object('product_id', v_product, 'qty', 1))
    ));
    raise exception 'FAIL: قبل كوبون مو موجود';
  exception when others then
    if sqlerrm <> 'invalid_coupon' then raise; end if;
  end;

  -- 5) الزبون ما لازم يقرأ الطلبات ولا الكوبونات مباشرة
  begin
    perform 1 from public.orders limit 1;
    raise exception 'FAIL: anon عم يقرأ جدول orders';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.coupons limit 1;
    raise exception 'FAIL: anon عم يقرأ جدول coupons';
  exception when insufficient_privilege then null;
  end;

  -- 6) ولا يعدّل الأسعار
  begin
    update public.products set price = 1 where id = v_product;
    raise exception 'FAIL: anon عدّل سعر';
  exception when insufficient_privilege then null;
  end;

  raise notice 'كل الفحوصات نجحت ✅  (رقم الطلب التجريبي %)', r->>'code';
end $$;

rollback;
