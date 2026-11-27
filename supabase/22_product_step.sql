-- =========================================================
-- ضيافتي — كمية كل صنف بالكيلو لحاله
-- qty_step: بشو بينباع الصنف: ربع كيلو (0.25) أو نص (0.5) أو كيلو (1).
-- هي أقل كمية، وهي الخطوة كمان (مثلاً «كيلو» يعني 1، 2، 3 كيلو).
-- فاضي = حسب «أقل كمية بالكيلو» العامة بالإعدادات، متل قبل.
-- التعبئة بالبوكس بتضل من ربع كيلو وطالع لكل الأصناف (قرار عبد الرحمن).
--
-- بعده لازم تعيد تشغيل 03_functions.sql (place_order بيفحص الخطوة).
-- آمن لو انعاد.
-- =========================================================
alter table public.products add column if not exists qty_step numeric(3,2);

alter table public.products drop constraint if exists products_qty_step_check;
alter table public.products add constraint products_qty_step_check
  check (qty_step is null or qty_step in (0.25, 0.5, 1));

-- ---------- فحص ----------
select count(*) filter (where qty_step is not null) as with_step, count(*) as all_products
from public.products;
