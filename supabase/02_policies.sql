-- =========================================================
-- ضيافتي — 02: الصلاحيات (RLS)
-- الفكرة:
--   الزبون (anon)  : بيقرأ الكتالوج المنشور بس. ما بيكتب بأي جدول مباشرة.
--                    الطلب والتقييم بيمرّوا من دوال 03_functions.sql.
--   صاحب المحل     : حساب Auth موجود بجدول admins، إله كل شي.
-- آمن لو شغّلته مرتين.
-- =========================================================

-- ---------- هل المستخدم الحالي أدمن؟ ----------
-- security definer لحتى تقدر تقرأ admins بدون ما نفتح الجدول لحدا.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- شغّل RLS على كل الجداول ----------
alter table public.admins             enable row level security;
alter table public.settings           enable row level security;
alter table public.categories         enable row level security;
alter table public.products           enable row level security;
alter table public.stories            enable row level security;
alter table public.story_items        enable row level security;
alter table public.delivery_zones     enable row level security;
alter table public.payment_accounts   enable row level security;
alter table public.coupons            enable row level security;
alter table public.orders             enable row level security;
alter table public.order_items        enable row level security;
alter table public.reviews            enable row level security;
alter table public.push_subscriptions enable row level security;

-- ---------- الصلاحيات الأساسية (طبقة تانية فوق RLS) ----------
-- anon ما إله غير القراءة، وبس للجداول اللي بيحتاجها الكتالوج.
revoke all on all tables in schema public from anon;
grant select on public.settings, public.categories, public.products,
                public.stories, public.story_items, public.delivery_zones,
                public.payment_accounts, public.reviews
  to anon;

-- authenticated عنده كل الصلاحيات، بس الـ RLS تحت بيحصرها بالأدمن.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
-- جدول admins ما بينكتب من الواجهة أبداً، بس من SQL Editor
revoke insert, update, delete on public.admins from authenticated;

-- =========================================================
-- السياسات
-- =========================================================

-- admins: الأدمن بيشوف القائمة بس
drop policy if exists "admins: admin read" on public.admins;
create policy "admins: admin read" on public.admins
  for select to authenticated using (public.is_admin());

-- settings: الكل بيقرأ، الأدمن بيعدّل
drop policy if exists "settings: public read" on public.settings;
create policy "settings: public read" on public.settings
  for select to anon, authenticated using (true);

drop policy if exists "settings: admin all" on public.settings;
create policy "settings: admin all" on public.settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- categories: الأقسام المو مخفية
drop policy if exists "categories: public read" on public.categories;
create policy "categories: public read" on public.categories
  for select to anon, authenticated using (not hidden);

drop policy if exists "categories: admin all" on public.categories;
create policy "categories: admin all" on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- products: الأصناف المو مخفية، وقسمها مو مخفي
drop policy if exists "products: public read" on public.products;
create policy "products: public read" on public.products
  for select to anon, authenticated
  using (
    not hidden
    and (category_id is null or exists (
      select 1 from public.categories c where c.id = category_id and not c.hidden
    ))
  );

drop policy if exists "products: admin all" on public.products;
create policy "products: admin all" on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- stories + story_items: الصور اللي لسا ما خلص أسبوعها
drop policy if exists "stories: public read" on public.stories;
create policy "stories: public read" on public.stories
  for select to anon, authenticated using (true);

drop policy if exists "stories: admin all" on public.stories;
create policy "stories: admin all" on public.stories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "story_items: public read" on public.story_items;
create policy "story_items: public read" on public.story_items
  for select to anon, authenticated
  using (expires_at is null or expires_at > now());

drop policy if exists "story_items: admin all" on public.story_items;
create policy "story_items: admin all" on public.story_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- delivery_zones: المناطق الفعّالة
drop policy if exists "delivery_zones: public read" on public.delivery_zones;
create policy "delivery_zones: public read" on public.delivery_zones
  for select to anon, authenticated using (active);

drop policy if exists "delivery_zones: admin all" on public.delivery_zones;
create policy "delivery_zones: admin all" on public.delivery_zones
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- payment_accounts: الحسابات الفعّالة (الزبون لازم يشوف الرقم لينسخه)
drop policy if exists "payment_accounts: public read" on public.payment_accounts;
create policy "payment_accounts: public read" on public.payment_accounts
  for select to anon, authenticated using (active);

drop policy if exists "payment_accounts: admin all" on public.payment_accounts;
create policy "payment_accounts: admin all" on public.payment_accounts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- coupons: الأدمن بس (الزبون بيفحص الكود عن طريق check_coupon)
drop policy if exists "coupons: admin all" on public.coupons;
create policy "coupons: admin all" on public.coupons
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- orders + order_items: الأدمن بس (الزبون عن طريق get_order)
drop policy if exists "orders: admin all" on public.orders;
create policy "orders: admin all" on public.orders
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "order_items: admin all" on public.order_items;
create policy "order_items: admin all" on public.order_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- reviews: الزباين بيشوفوا اللي اختارها صاحب المحل بس
drop policy if exists "reviews: public read" on public.reviews;
create policy "reviews: public read" on public.reviews
  for select to anon, authenticated using (is_public);

drop policy if exists "reviews: admin all" on public.reviews;
create policy "reviews: admin all" on public.reviews
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- push_subscriptions: الأدمن بس
drop policy if exists "push_subscriptions: admin all" on public.push_subscriptions;
create policy "push_subscriptions: admin all" on public.push_subscriptions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- =========================================================
-- Storage: سطل الصور
-- عام للقراءة (الصور بتبين للزباين برابط مباشر)، والرفع للأدمن بس.
-- حد الصورة 2MB، ومنصغّرها بالمتصفح قبل الرفع أصلاً.
-- =========================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "images: admin read"   on storage.objects;
drop policy if exists "images: admin insert" on storage.objects;
drop policy if exists "images: admin update" on storage.objects;
drop policy if exists "images: admin delete" on storage.objects;

create policy "images: admin read" on storage.objects
  for select to authenticated using (bucket_id = 'images' and public.is_admin());
create policy "images: admin insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'images' and public.is_admin());
create policy "images: admin update" on storage.objects
  for update to authenticated using (bucket_id = 'images' and public.is_admin());
create policy "images: admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'images' and public.is_admin());

-- =========================================================
-- Realtime: لحتى توصل الطلبات الجديدة للوحة فوراً وهي مفتوحة
-- (الـ RLS بيمشي عالـ realtime كمان، يعني بس الأدمن بيستقبل)
-- =========================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;
