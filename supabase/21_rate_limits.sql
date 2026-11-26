-- =========================================================
-- ضيافتي — حدود ضد التخمين والإزعاج
-- 1) is_admin ما عاد الزائر (anon) بيقدر يستدعيها. كل السياسات اللي
--    بتستعملها لـ authenticated بس، فالزائر ما بيحتاجها أبداً.
-- 2) جدول rate_hits ودالة rate_limited: عدد المحاولات من نفس الجهاز (IP)
--    بفترة قصيرة. منستعملها لتجريب أكواد الكوبونات (check_coupon و place_order).
--    الـ IP ما بينحفظ: بينحفظ منه بصمة (sha256)، وبتنمسح بعد ساعة.
--
-- بعده لازم تعيد تشغيل 03_functions.sql (check_coupon و place_order).
-- آمن لو انعاد.
-- =========================================================

-- ---------- 1) is_admin للمسجّلين بس ----------
revoke execute on function public.is_admin() from anon;

-- ---------- 2) المحاولات ----------
create table if not exists public.rate_hits (
  id      bigint generated always as identity primary key,
  kind    text not null,          -- شو المحاولة، مثلاً 'coupon'
  ip_hash text not null,          -- بصمة الـ IP، مو الـ IP نفسه
  at      timestamptz not null default now()
);
create index if not exists rate_hits_lookup on public.rate_hits (kind, ip_hash, at);

-- ما حدا بيقرأه ولا بيكتب فيه من برا. بس الدوال (اللي بتشتغل بصلاحية صاحب الجدول).
alter table public.rate_hits enable row level security;
revoke all on public.rate_hits from anon, authenticated;

-- بترجع true إذا هالجهاز تجاوز الحد، وإلا بتسجّل محاولة وبترجع false.
-- إذا ما عرفنا الـ IP (مثلاً من SQL Editor)، ما في حد.
create or replace function public.rate_limited(p_kind text, p_max int, p_window interval)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_ip   text;
  v_hash text;
  v_n    int;
begin
  v_ip := btrim(split_part(coalesce(
    current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1));
  if v_ip = '' then return false; end if;
  v_hash := encode(sha256(convert_to(v_ip, 'UTF8')), 'hex');

  -- تنظيف: ما منخلّي شي أقدم من ساعة
  delete from public.rate_hits where at < now() - interval '1 hour';

  select count(*) into v_n from public.rate_hits
   where kind = p_kind and ip_hash = v_hash and at > now() - p_window;
  if v_n >= p_max then return true; end if;

  insert into public.rate_hits (kind, ip_hash) values (p_kind, v_hash);
  return false;
end $$;

revoke execute on function public.rate_limited(text, int, interval) from public, anon, authenticated;

-- ---------- فحص ----------
-- لازم يطلع: anon_is_admin = false
select has_function_privilege('anon', 'public.is_admin()', 'execute') as anon_is_admin;
