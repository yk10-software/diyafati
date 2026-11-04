-- =========================================================
-- ضيافتي — 09: دوام المحل
-- ساعة الفتح والسكر، ومنهم بتطلع مواعيد التوصيل عند الزبون،
-- و place_order بيرفض أي موعد برا الدوام.
-- الدوام بنفس اليوم: السكر لازم يكون بعد الفتح.
-- بعد هالملف لازم تعيد تشغيل 03_functions.sql كله.
-- آمن لو شغّلته مرتين.
-- =========================================================
alter table public.settings add column if not exists open_time  time not null default '09:00';
alter table public.settings add column if not exists close_time time not null default '22:00';

alter table public.settings drop constraint if exists settings_hours_order;
alter table public.settings add constraint settings_hours_order check (close_time > open_time);
