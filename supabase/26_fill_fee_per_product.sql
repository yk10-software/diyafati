-- =========================================================
-- ضيافتي — أجرة التعبئة والتزيين لكل بوكس أو صحن لحاله
-- (بدل الأجرة الوحدة بالإعدادات تبع ملف 25)
-- بشاشة الصنف، للأصناف اللي بأقسام البوكسات والصحون:
--   بلا أجرة       : الكل فاضي
--   مبلغ ثابت      : fill_fee_min بس          ← بينضاف عالسعر
--   بين وبين       : fill_fee_min و fill_fee_max ← ما بينضاف، بيتأكد مع المحل
--   حسب الاتفاق    : fill_fee_ask = true        ← ما بينضاف، بيتأكد مع المحل
-- الأجرة بتنضاف بس إذا انطلب معبّى. place_order (ملف 03) بيضيفها سطر جوا البوكس.
--
-- بعد هالملف شغّل 03_functions.sql من جديد.
-- آمن لو انعاد.
-- =========================================================
alter table public.products
  add column if not exists fill_fee_min integer,
  add column if not exists fill_fee_max integer,
  add column if not exists fill_fee_ask boolean not null default false;

alter table public.products drop constraint if exists products_fill_fee_check;
alter table public.products add constraint products_fill_fee_check check (
  (fill_fee_min is null or fill_fee_min between 1 and 1000000)
  and (fill_fee_max is null or (fill_fee_min is not null and fill_fee_max > fill_fee_min and fill_fee_max <= 1000000))
);

-- الأجرة الوحدة القديمة (ملف 25) ما عاد إلها لزمة
alter table public.settings drop constraint if exists settings_fill_fee_check;
alter table public.settings drop column if exists fill_fee;
