-- =========================================================
-- ضيافتي — 13: صورة القسم، وعدد الحبات بالكيلو
-- categories.image: رابط الصورة. فاضي = القسم بيطلع بلا صورة.
-- products.pieces_per_kg: بيبيّن بصفحة الصنف إذا الوحدة كيلو.
-- لازم ينشغّل قبل حفظ أي صنف من اللوحة، وقبل tools/import.html.
-- آمن لو شغّلته مرتين.
-- =========================================================
alter table public.categories add column if not exists image text;
alter table public.products   add column if not exists pieces_per_kg int;

alter table public.products drop constraint if exists products_pieces_positive;
alter table public.products add constraint products_pieces_positive check (pieces_per_kg is null or pieces_per_kg > 0);
