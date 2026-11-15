-- =========================================================
-- ضيافتي — البوكس المعبّى
-- الزبون بيختار البوكس فارغ أو معبّى. إذا معبّى، بيحط جواه أصناف
-- من الأقسام اللي بيحددها صاحب المحل، أكتر من صنف، ومن كل صنف
-- من ربع كيلو وطالع (الخطوة ربع). السعر = البوكس + اللي جواه.
--
-- بعده لازم تعيد تشغيل 03_functions.sql (place_order و get_order).
-- آمن لو انعاد.
-- =========================================================

-- ---------- الأقسام ----------
-- is_boxes: أصناف هالقسم بوكسات، والزبون بيقدر يعبّيها
-- box_fill: أصناف هالقسم بتطلع للزبون وقت يعبّي البوكس
alter table public.categories add column if not exists is_boxes boolean not null default false;
alter table public.categories add column if not exists box_fill boolean not null default false;

-- ---------- أسطر الطلب ----------
-- البوكس واللي جواه إلهن نفس box_no (1، 2، ... بنفس الطلب).
-- in_box = true يعني الصنف جوا البوكس. الأصناف العادية box_no فاضي.
alter table public.order_items add column if not exists box_no smallint;
alter table public.order_items add column if not exists in_box boolean not null default false;

-- ---------- البداية ----------
-- قسم البوكسات بيتعبّى، وكل قسم فيه أصناف بالكيلو بيطلع للتعبئة.
-- بعدين صاحب المحل بيغيّر هالخيارات من شاشة القسم باللوحة.
update public.categories set is_boxes = true where name = 'البوكسات';
update public.categories c set box_fill = true
where not c.is_boxes
  and exists (select 1 from public.products p where p.category_id = c.id and p.unit = 'كيلو');

-- ---------- فحص ----------
select name, is_boxes, box_fill from public.categories order by sort_order, id;
