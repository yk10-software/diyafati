-- =========================================================
-- ضيافتي — فيديو بالقصص
-- كل عنصر بالقصة بيصير فيه فيديو اختياري (عمود video).
-- عمود image بيضل موجود: للفيديو بيكون الغلاف (لقطة من الفيديو)،
-- وهو اللي بيبيّن بالقوس وقبل ما يحمّل الفيديو.
--
-- شغّله مرة وحدة من SQL Editor. ما بيمسح شي، وآمن لو انعاد.
-- ما في داعي تعيد تشغيل أي ملف تاني بعده.
-- =========================================================

-- ---------- العمود ----------
alter table public.story_items add column if not exists video text;  -- فاضي = صورة عادية

-- ---------- سطل الفيديو ----------
-- عام للقراءة متل سطل الصور (الزباين بيشوفوا القصص بلا تسجيل دخول).
-- حد الفيديو 10MB، وبيقبل MP4 بس. اللوحة بتتأكد إنو الفيديو H.264
-- (بيشتغل على كل الموبايلات) قبل ما ترفعه، وبترفعه دايماً كـ MP4.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', true, 10485760, array['video/mp4'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- الرفع والتعديل والحذف للأدمن بس، متل سطل الصور
drop policy if exists "videos: admin read"   on storage.objects;
drop policy if exists "videos: admin insert" on storage.objects;
drop policy if exists "videos: admin update" on storage.objects;
drop policy if exists "videos: admin delete" on storage.objects;

create policy "videos: admin read" on storage.objects
  for select to authenticated using (bucket_id = 'videos' and public.is_admin());
create policy "videos: admin insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'videos' and public.is_admin());
create policy "videos: admin update" on storage.objects
  for update to authenticated using (bucket_id = 'videos' and public.is_admin());
create policy "videos: admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'videos' and public.is_admin());

-- ---------- فحص ----------
-- لازم يطلع صف فيه videos و true و 10485760
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'videos';
