-- =========================================================
-- ضيافتي — إشعارات للزبون لما تتغيّر حالة طلبه
-- 1) order_push_subscriptions: موبايلات الزباين اللي فعّلوا الإشعارات لطلب معيّن.
--    كل اشتراك مربوط بطلب واحد، وبينمسح لحاله مع الطلب (on delete cascade).
--    الزائر ما بيقرأ ولا بيكتب عليه مباشرة: بس عن طريق subscribe_order_push.
-- 2) subscribe_order_push(p_token, p_sub): الزبون بيسجّل موبايله بتوكن طلبه.
--    بنقبل بس روابط خدمات الإشعارات المعروفة (غوغل، آبل، موزيلا، مايكروسوفت).
-- 3) trigger notify_order_status: لما صاحب المحل يغيّر الحالة، بيستدعي notify-order
--    بـ id الطلب بس. الدالة بتقرأ الحالة من القاعدة، وبتبعت مرة وحدة لكل حالة
--    (status_notified)، فحتى لو حدا استدعاها من برا ما بيقدر يكرر الإشعار.
--
-- بعده لازم ترفع notify-order الجديدة (supabase/functions/notify-order).
-- آمن لو انعاد.
-- =========================================================

-- ---------- 1) الاشتراكات ----------
create table if not exists public.order_push_subscriptions (
  id         bigint generated always as identity primary key,
  order_id   uuid not null references public.orders(id) on delete cascade,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now(),
  unique (order_id, endpoint)
);
create index if not exists order_push_order_idx on public.order_push_subscriptions (order_id);

alter table public.order_push_subscriptions enable row level security;
revoke all on public.order_push_subscriptions from anon, authenticated;

-- آخر حالة انبعتلها إشعار للزبون
alter table public.orders add column if not exists status_notified text;

-- ---------- 2) الزبون بيفعّل الإشعارات لطلبه ----------
create or replace function public.subscribe_order_push(p_token text, p_sub jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order    uuid;
  v_status   text;
  v_endpoint text := coalesce(p_sub->>'endpoint', '');
  v_p256dh   text := coalesce(p_sub->'keys'->>'p256dh', '');
  v_auth     text := coalesce(p_sub->'keys'->>'auth', '');
begin
  select id, status into v_order, v_status from public.orders where token = p_token;
  if v_order is null then raise exception 'order_not_found'; end if;
  -- الطلب خلص: ما في شي نبلّغ عنه
  if v_status in ('delivered', 'cancelled') then return false; end if;

  -- بس خدمات الإشعارات المعروفة، وبطول معقول
  if length(v_endpoint) > 1000 or length(v_p256dh) not between 40 and 200 or length(v_auth) not between 10 and 100
     or v_endpoint !~ '^https://(fcm\.googleapis\.com|[a-z0-9.-]+\.push\.apple\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com)/' then
    raise exception 'invalid_subscription';
  end if;

  -- لحد 5 موبايلات لكل طلب
  if (select count(*) from public.order_push_subscriptions where order_id = v_order) >= 5 then
    return false;
  end if;

  insert into public.order_push_subscriptions (order_id, endpoint, p256dh, auth)
  values (v_order, v_endpoint, v_p256dh, v_auth)
  on conflict (order_id, endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth;
  return true;
end $$;

revoke execute on function public.subscribe_order_push(text, jsonb) from public;
grant execute on function public.subscribe_order_push(text, jsonb) to anon, authenticated;

-- ---------- 3) لما تتغيّر الحالة ----------
create or replace function public.notify_order_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- بس إذا في موبايل مشترك لهالطلب، لحتى ما نستدعي الدالة على الفاضي
  if not exists (select 1 from public.order_push_subscriptions where order_id = new.id) then
    return new;
  end if;
  perform net.http_post(
    url := 'https://quznimzbgfcrntyrpfim.supabase.co/functions/v1/notify-order',
    body := jsonb_build_object('type', 'STATUS', 'record', jsonb_build_object('id', new.id)),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 10000
  );
  return new;
exception when others then
  -- الإشعار شغلة إضافية: مشكلة فيه ما لازم توقف تغيير الحالة
  raise warning 'notify_order_status: %', sqlerrm;
  return new;
end $$;

revoke execute on function public.notify_order_status() from public, anon, authenticated;

drop trigger if exists notify_order_status on public.orders;
create trigger notify_order_status
  after update of status on public.orders
  for each row when (old.status is distinct from new.status)
  execute function public.notify_order_status();

-- ---------- فحص ----------
-- لازم يطلع: anon_can_subscribe = true و anon_reads_table = false
select has_function_privilege('anon', 'public.subscribe_order_push(text, jsonb)', 'execute') as anon_can_subscribe,
       has_table_privilege('anon', 'public.order_push_subscriptions', 'select') as anon_reads_table;
