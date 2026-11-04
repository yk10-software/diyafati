-- =========================================================
-- ضيافتي — 11: التقييمات بالموقع بلا الاسم الكامل
-- قبل هالملف كان أي زائر بيقدر يقرأ reviews.name كامل من الـ API.
-- هلق الزائر ما إله قراءة عالجدول، وبياخد التقييمات المعروضة من
-- get_public_reviews، بالاسم الأول وأول حرف من الكنية (سارة محمد ← سارة م.).
-- اللوحة بتضل بتشوف الاسم الكامل.
-- آمن لو شغّلته مرتين.
-- =========================================================
create or replace function public.short_name(p_name text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  parts text[] := regexp_split_to_array(btrim(coalesce(p_name, '')), '\s+');
  n     int    := array_length(parts, 1);
  last  text;
begin
  if n < 2 then return parts[1]; end if;
  last := parts[n];
  if last ~ '^ال.{2}' then last := substr(last, 3); end if;   -- الحلبي ← ح.
  return parts[1] || ' ' || left(last, 1) || '.';
end $$;

create or replace function public.get_public_reviews()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id, 'name', public.short_name(r.name), 'rating', r.rating, 'comment', r.comment
  ) order by r.created_at desc), '[]'::jsonb)
  from (
    select * from public.reviews where is_public order by created_at desc limit 12
  ) r;
$$;

revoke all on function public.short_name(text) from public, anon, authenticated;
revoke all on function public.get_public_reviews() from public;
grant execute on function public.get_public_reviews() to anon, authenticated;

-- الجدول نفسه للأدمن بس
drop policy if exists "reviews: public read" on public.reviews;
revoke select on public.reviews from anon;
