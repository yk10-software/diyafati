-- =========================================================
-- ضيافتي — 12: روابط التواصل بأسفل الموقع
-- بتنعدّل من إعدادات اللوحة. إذا الرابط فاضي، الأيقونة ما بتطلع.
-- آمن لو شغّلته مرتين: ما بيرجّع رابط انعدّل أو انمسح.
-- =========================================================
alter table public.settings add column if not exists instagram_url text not null default 'https://www.instagram.com/diyafati_hama_2';
alter table public.settings add column if not exists facebook_url  text not null default 'https://www.facebook.com/share/1E6URHXfHx/';
