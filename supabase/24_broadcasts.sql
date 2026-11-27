-- =========================================================
-- ضيافتي — رسائل لكل الزباين (إشعار عالموبايل)
-- 1) promo_push_subscriptions: موبايلات الزباين اللي كبسوا «بلّغني بالعروض».
--    منفصلة عن إشعارات الطلب (ملف 23)، لأنها موافقة تانية.
--    الزائر ما بيقرأ ولا بيكتب عليها مباشرة: بس عن طريق الدالتين تحت.
--    صاحب المحل بيقرأ العدد بس.
-- 2) subscribe_promo_push(p_sub) و unsubscribe_promo_push(p_endpoint).
-- 3) broadcasts: الرسائل اللي بعتها صاحب المحل. لحد 3 رسائل باليوم،
--    لحتى ما يزعج الزباين ويسكّروا الإشعارات.
--    بعد ما تنضاف رسالة، الـ trigger بيستدعي notify-order بـ id الرسالة بس.
--    الدالة بتقرأ النص من القاعدة، وكل رسالة بتنبعت مرة وحدة (sent_at).
--
-- بعده لازم ترفع notify-order الجديدة (supabase/functions/notify-order).
-- آمن لو انعاد.
-- =========================================================

-- ---------- 1) الاشتراكات ----------
create table if not exists public.promo_push_subscriptions (
  id         bigint generated always as identity primary key,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

alter table public.promo_push_subscriptions enable row level security;
revoke all on public.promo_push_subscriptions from anon, authenticated;
grant select on public.promo_push_subscriptions to authenticated;

drop policy if exists "promo_push: admin read" on public.promo_push_subscriptions;
create policy "promo_push: admin read" on public.promo_push_subscriptions
  for select to authenticated using (public.is_admin());

-- ---------- 2) الزبون بيشترك أو بيلغي ----------
create or replace function public.subscribe_promo_push(p_sub jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_endpoint text := coalesce(p_sub->>'endpoint', '');
  v_p256dh   text := coalesce(p_sub->'keys'->>'p256dh', '');
  v_auth     text := coalesce(p_sub->'keys'->>'auth', '');
begin
  -- بس خدمات الإشعارات المعروفة، وبطول معقول (متل ملف 23)
  if length(v_endpoint) > 1000 or length(v_p256dh) not between 40 and 200 or length(v_auth) not between 10 and 100
     or v_endpoint !~ '^https://(fcm\.googleapis\.com|[a-z0-9.-]+\.push\.apple\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com)/' then
    raise exception 'invalid_subscription';
  end if;

  -- 10 محاولات كل 10 دقايق من نفس الجهاز، لحتى ما حدا يعبّي الجدول
  if public.rate_limited('promo_sub', 10, interval '10 minutes') then
    return false;
  end if;

  insert into public.promo_push_subscriptions (endpoint, p256dh, auth)
  values (v_endpoint, v_p256dh, v_auth)
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth;
  return true;
end $$;

create or replace function public.unsubscribe_promo_push(p_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.promo_push_subscriptions where endpoint = p_endpoint;
$$;

revoke execute on function public.subscribe_promo_push(jsonb) from public;
revoke execute on function public.unsubscribe_promo_push(text) from public;
grant execute on function public.subscribe_promo_push(jsonb) to anon, authenticated;
grant execute on function public.unsubscribe_promo_push(text) to anon, authenticated;

-- ---------- 3) الرسائل ----------
create table if not exists public.broadcasts (
  id            bigint generated always as identity primary key,
  title         text not null check (length(btrim(title)) between 1 and 60),
  body          text not null check (length(btrim(body)) between 1 and 200),
  created_at    timestamptz not null default now(),
  sent_at       timestamptz,
  sent_count    int,
  removed_count int
);

alter table public.broadcasts enable row level security;
revoke all on public.broadcasts from anon;
-- صاحب المحل بيضيف وبيشوف بس. ما في تعديل ولا حذف، لحتى الحد اليومي يضل صحيح
revoke all on public.broadcasts from authenticated;
grant select, insert on public.broadcasts to authenticated;

drop policy if exists "broadcasts: admin all" on public.broadcasts;
create policy "broadcasts: admin all" on public.broadcasts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- لحد 3 رسائل بآخر 24 ساعة
create or replace function public.broadcasts_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.broadcasts where created_at > now() - interval '24 hours') >= 3 then
    raise exception 'too_many_broadcasts';
  end if;
  return new;
end $$;

revoke execute on function public.broadcasts_limit() from public, anon, authenticated;

drop trigger if exists broadcasts_limit on public.broadcasts;
create trigger broadcasts_limit
  before insert on public.broadcasts
  for each row execute function public.broadcasts_limit();

-- بعد ما تنضاف الرسالة: منستدعي الدالة بالـ id بس
create or replace function public.notify_broadcast()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://quznimzbgfcrntyrpfim.supabase.co/functions/v1/notify-order',
    body := jsonb_build_object('type', 'BROADCAST', 'record', jsonb_build_object('id', new.id)),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 10000
  );
  return new;
exception when others then
  raise warning 'notify_broadcast: %', sqlerrm;
  return new;
end $$;

revoke execute on function public.notify_broadcast() from public, anon, authenticated;

drop trigger if exists notify_broadcast on public.broadcasts;
create trigger notify_broadcast
  after insert on public.broadcasts
  for each row execute function public.notify_broadcast();

-- ---------- فحص ----------
-- لازم يطلع: anon_can_subscribe = true و anon_reads_subs = false و anon_reads_broadcasts = false
select has_function_privilege('anon', 'public.subscribe_promo_push(jsonb)', 'execute') as anon_can_subscribe,
       has_table_privilege('anon', 'public.promo_push_subscriptions', 'select') as anon_reads_subs,
       has_table_privilege('anon', 'public.broadcasts', 'select') as anon_reads_broadcasts;
