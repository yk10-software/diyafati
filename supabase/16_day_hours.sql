-- =========================================================
-- ضيافتي — 16: دوام مختلف لبعض الأيام
-- day_hours: الأيام اللي دوامها غير الدوام العادي (open_time و close_time).
-- المفتاح رقم اليوم: 0 الأحد، 1 الإتنين ... 5 الجمعة، 6 السبت (متل JavaScript و extract(dow)).
-- مثال: {"5": {"open": "17:30", "close": "21:30"}}
-- بتنعدّل من اللوحة: الرئيسية ← دوام المحل ← تغيير.
-- بعد هالملف لازم تعيد تشغيل 03_functions.sql كله.
-- آمن لو شغّلته مرتين.
-- =========================================================
alter table public.settings add column if not exists day_hours jsonb not null default '{}'::jsonb;

alter table public.settings drop constraint if exists settings_day_hours_object;
alter table public.settings add constraint settings_day_hours_object check (jsonb_typeof(day_hours) = 'object');

-- دوام الجمعة اللي طلبه المحل: من 5:30 لـ 9:30 المسا.
-- بس إذا لسا ما في أيام مختلفة، لحتى ما نمسح شي انعدّل من اللوحة
update public.settings
set day_hours = '{"5": {"open": "17:30", "close": "21:30"}}'::jsonb
where day_hours = '{}'::jsonb;
