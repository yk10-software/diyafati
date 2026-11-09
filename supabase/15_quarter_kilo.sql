-- =========================================================
-- ضيافتي — 15: الطلب بربع كيلو
-- min_kilo و order_items.qty كانوا منزلة عشرية وحدة، فـ 0.25 كانت بتصير 0.3.
-- هلق منزلتين. والخطوة: ربع كيلو إذا أقل كمية ربع، وإلا نص كيلو.
-- بعد هالملف لازم تعيد تشغيل 03_functions.sql كله (place_order بيفحص الخطوة الجديدة).
-- آمن لو شغّلته مرتين.
-- =========================================================
alter table public.settings    alter column min_kilo type numeric(5,2);
alter table public.order_items alter column qty      type numeric(7,2);
