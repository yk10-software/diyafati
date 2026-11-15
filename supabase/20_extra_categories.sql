-- =========================================================
-- ضيافتي — الصنف بأكتر من قسم
-- الصنف إله قسم أساسي (category_id)، وبيقدر يطلع كمان بأقسام تانية
-- (extra_categories). الزبون بيشوفه بكل هالأقسام، وبـ«الكل» مرة وحدة.
-- السعر والصور واحدة، يعني صاحب المحل بيعدّلهن مرة وحدة.
-- البوكس والتعبئة و«قريباً» بيمشوا عالقسم الأساسي بس.
--
-- شغّله مرة وحدة من SQL Editor. ما بيمسح شي، وآمن لو انعاد.
-- =========================================================

-- ---------- العمود ----------
alter table public.products
  add column if not exists extra_categories bigint[] not null default '{}';

-- ---------- لما ينحذف قسم ----------
-- منشيله من extra_categories لكل الأصناف (متل on delete set null للقسم الأساسي)
create or replace function public.categories_drop_extra()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.products
     set extra_categories = array_remove(extra_categories, old.id)
   where old.id = any (extra_categories);
  return old;
end $$;

revoke execute on function public.categories_drop_extra() from public, anon, authenticated;

drop trigger if exists categories_drop_extra on public.categories;
create trigger categories_drop_extra after delete on public.categories
  for each row execute function public.categories_drop_extra();

-- ---------- البداية: الأصناف اللي العميل بدو ياها بقسمين ----------
-- بس إذا لسا ما إلها أقسام إضافية، لحتى ما نمسح تعديلات صاحب المحل لو انعاد.
update public.products p set extra_categories = array[c.id]
  from public.categories c
 where c.name = 'شوكولا ضيافتي'
   and p.name = 'كاتي ضيافتي'
   and p.extra_categories = '{}';

update public.products p set extra_categories = array[c.id]
  from public.categories c
 where c.name = 'المواليد'
   and p.name in ('غزلة ضيافتي', 'سنوبول ضيافتي',
                  'هريسة لوز دبدوب بنت', 'هريسة لوز دبدوب صبي',
                  'كرميلا ديفا بنت', 'كرميلا ديفا صبي')
   and p.extra_categories = '{}';

-- ---------- فحص ----------
select p.name, c.name as main, p.extra_categories
  from public.products p left join public.categories c on c.id = p.category_id
 where p.extra_categories <> '{}'
 order by p.name;
