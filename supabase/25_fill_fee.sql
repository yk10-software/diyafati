-- =========================================================
-- ضيافتي — أجرة التعبئة والتزيين
-- مبلغ ثابت لكل بوكس أو صحن بينطلب معبّى، وبيتعدّل من اللوحة ← الإعدادات.
-- الفاضي ما بتنضاف عليه. 0 = بلا أجرة.
-- place_order (ملف 03) بيضيفها سطر لحاله جوا البوكس: product_id فاضي، in_box = true.
--
-- ⚠️ انشال بملف 26_fill_fee_per_product.sql: الأجرة صارت لكل صنف. لا تشغّل هالملف لحاله.
-- بعد هالملف شغّل 03_functions.sql من جديد.
-- آمن لو انعاد.
-- =========================================================
alter table public.settings
  add column if not exists fill_fee integer not null default 0;

alter table public.settings drop constraint if exists settings_fill_fee_check;
alter table public.settings add constraint settings_fill_fee_check check (fill_fee between 0 and 1000000);

select fill_fee from public.settings;
