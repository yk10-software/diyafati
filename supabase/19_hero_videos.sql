-- =========================================================
-- ضيافتي — فيديوهات أول الصفحة
-- لحد 5 فيديوهات بتشتغل ورا بعض تحت الاسم، بلا صوت.
-- الفيديو بسطل videos (من ملف 17)، والغلاف (لقطة من الفيديو) بسطل images.
--
-- لازم يكون 17_story_videos.sql منشغّل قبله.
-- شغّله مرة وحدة من SQL Editor. ما بيمسح شي، وآمن لو انعاد.
-- =========================================================

-- ---------- الجدول ----------
create table if not exists public.hero_videos (
  id         bigint generated always as identity primary key,
  video      text not null,   -- رابط MP4 بسطل videos
  poster     text not null,   -- الغلاف: بيبيّن قبل ما يحمّل الفيديو
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- الصلاحيات ----------
alter table public.hero_videos enable row level security;
grant select on public.hero_videos to anon;
grant select, insert, update, delete on public.hero_videos to authenticated;

drop policy if exists "hero_videos: public read" on public.hero_videos;
create policy "hero_videos: public read" on public.hero_videos
  for select to anon, authenticated using (true);

drop policy if exists "hero_videos: admin all" on public.hero_videos;
create policy "hero_videos: admin all" on public.hero_videos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- الحد: 5 فيديوهات ----------
-- اللوحة كمان بتمنع السادس، بس هون الحماية الأكيدة.
create or replace function public.hero_videos_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.hero_videos) >= 5 then
    raise exception 'hero_limit' using errcode = 'P0001';
  end if;
  return new;
end $$;

revoke execute on function public.hero_videos_limit() from public, anon, authenticated;

drop trigger if exists hero_videos_limit on public.hero_videos;
create trigger hero_videos_limit before insert on public.hero_videos
  for each row execute function public.hero_videos_limit();

-- ---------- فحص ----------
-- لازم يطلع صف فيه hero_videos و true
select relname, relrowsecurity from pg_class where oid = 'public.hero_videos'::regclass;
