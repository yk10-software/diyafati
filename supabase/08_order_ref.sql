-- =========================================================
-- ضيافتي — 08: رقم مرجعي للطلب
-- على النت الضعيف ممكن ينحفظ الطلب وما يوصل الرد للزبون، فيرجع يكبس إرسال.
-- التطبيق بيبعت client_ref ثابت لنفس المحاولة، و place_order بيرجّع نفس الطلب
-- بدل ما يعمل طلب تاني.
-- بعد هالملف لازم تعيد تشغيل 03_functions.sql كله.
-- آمن لو شغّلته مرتين.
-- =========================================================
alter table public.orders add column if not exists client_ref uuid;
create unique index if not exists orders_client_ref_uidx on public.orders (client_ref);
