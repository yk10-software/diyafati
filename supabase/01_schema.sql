-- =========================================================
-- ضيافتي — 01: الجداول
-- شغّله أول شي. آمن لو شغّلته مرتين (if not exists).
-- الأسعار كلها أرقام صحيحة بالليرة السورية (العملة الجديدة).
-- =========================================================

-- ---------- أصحاب اللوحة ----------
-- مو كل حساب مسجّل بـ Supabase Auth بيصير أدمن.
-- لازم يكون الـ user_id تبعه بهالجدول (شوف 05_make_admin.sql).
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------- الإعدادات (صف واحد بس) ----------
create table if not exists public.settings (
  id                 int primary key default 1 check (id = 1),
  shop_open          boolean not null default true,      -- «المحل مفتوح للطلبات»
  whatsapp           text    not null default '963953334642',
  hours_label        text    not null default 'كل يوم من 9 الصبح لـ 10 بالليل',
  open_time          time    not null default '09:00',   -- الدوام: منه بتطلع مواعيد التوصيل
  close_time         time    not null default '22:00',
  instagram_url      text    not null default 'https://www.instagram.com/diyafati_hama_2',
  facebook_url       text    not null default 'https://www.facebook.com/share/1E6URHXfHx/',
  min_kilo           numeric(5,1) not null default 0.5,  -- أقل كمية لصنف بالكيلو
  scheduled_enabled  boolean not null default true,      -- «استقبال طلبات بموعد»
  schedule_max_days  int     not null default 30,        -- لحد كم يوم لقدام
  cash_enabled       boolean not null default true,      -- كاش عند الاستلام
  updated_at         timestamptz not null default now(),
  constraint settings_hours_order check (close_time > open_time)
);

-- ---------- الأقسام ----------
create table if not exists public.categories (
  id          bigint generated always as identity primary key,
  name        text    not null,
  sort_order  int     not null default 0,
  hidden      boolean not null default false,
  coming_soon boolean not null default false,            -- متل «أزهار، قريباً»
  image       text,                                      -- صورة القسم، فاضي = بلا صورة
  created_at  timestamptz not null default now()
);

-- ---------- الأصناف ----------
create table if not exists public.products (
  id                bigint generated always as identity primary key,
  category_id       bigint references public.categories (id) on delete set null,
  name              text    not null,
  description       text    not null default '',
  price             bigint  not null check (price >= 0),
  -- خصم على الصنف: إذا في sale_price بينعرض price مشطوب
  sale_price        bigint  check (sale_price >= 0),
  sale_until        timestamptz,                         -- فاضي = بلا تاريخ انتهاء
  unit              text    not null default 'كيلو'
                    check (unit in ('كيلو', 'قطعة', 'علبة', 'باقة')),
  images            text[]  not null default '{}',       -- روابط أو مسارات الصور
  pieces_per_kg     int check (pieces_per_kg > 0),       -- عدد الحبات بالكيلو
  custom_note_label text,                                -- متل «شو بدك ينطبع على الملبس؟»
  available         boolean not null default true,       -- false = «خلص» بس بيبين
  hidden            boolean not null default false,      -- true = ما بيبين للزباين أبداً
  sort_order        int     not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists products_category_idx on public.products (category_id, sort_order);

-- ---------- القصص ----------
-- القصة مجموعة (مواليد، شوكولا...)، وجواها صور. كل صورة بتختفي لحالها بعد أسبوع.
create table if not exists public.stories (
  id         bigint generated always as identity primary key,
  title      text not null,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.story_items (
  id         bigint generated always as identity primary key,
  story_id   bigint not null references public.stories (id) on delete cascade,
  image      text   not null,
  product_id bigint references public.products (id) on delete set null,
  sort_order int    not null default 0,
  expires_at timestamptz default (now() + interval '7 days'),  -- فاضي = ما بتختفي
  created_at timestamptz not null default now()
);
create index if not exists story_items_story_idx on public.story_items (story_id, sort_order);

-- ---------- مناطق وأجور التوصيل ----------
create table if not exists public.delivery_zones (
  id         bigint generated always as identity primary key,
  name       text   not null,                 -- دمشق، ريف دمشق، باقي المحافظات، خارج سوريا
  fee        bigint check (fee >= 0),          -- فاضي = «حسب الاتفاق»
  note       text   not null default '',       -- متل «شحن»
  sort_order int    not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- حسابات الدفع (شام كاش + بنوك بلا حدود) ----------
create table if not exists public.payment_accounts (
  id             bigint generated always as identity primary key,
  kind           text not null check (kind in ('shamcash', 'bank')),
  title          text not null,               -- «شام كاش» أو اسم البنك
  holder_name    text not null default '',
  account_number text not null,
  note           text not null default '',
  sort_order     int  not null default 0,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

-- ---------- الكوبونات ----------
create table if not exists public.coupons (
  id         bigint generated always as identity primary key,
  code       text   not null,
  kind       text   not null check (kind in ('percent', 'amount')),
  value      bigint not null check (value > 0),
  min_total  bigint not null default 0,        -- أقل مجموع لحتى يمشي الكود
  max_uses   int,                              -- فاضي = بلا حد
  used_count int    not null default 0,
  expires_at timestamptz,                      -- فاضي = بلا تاريخ انتهاء
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  constraint coupons_percent_max check (kind <> 'percent' or value <= 100)
);
-- الكود ما بيفرّق بين كبير وصغير
create unique index if not exists coupons_code_uidx on public.coupons (upper(code));

-- ---------- الطلبات ----------
create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,        -- رقم الطلب للعرض: D35672
  token            text not null unique,        -- سر طويل، الزبون بيتابع طلبه فيه
  client_ref       uuid unique,                 -- لحتى ما يتكرر الطلب إذا انبعت مرتين
  status           text not null default 'new'
                   check (status in ('new', 'preparing', 'on_way', 'delivered', 'cancelled')),
  customer_name    text not null,
  phone            text not null,
  zone_id          bigint references public.delivery_zones (id) on delete set null,
  zone_name        text not null,               -- نسخة من الاسم وقت الطلب
  address          text not null,
  delivery_mode    text not null check (delivery_mode in ('asap', 'scheduled')),
  scheduled_at     timestamptz,
  payment_method   text not null check (payment_method in ('cash', 'shamcash', 'bank')),
  payment_account_id bigint references public.payment_accounts (id) on delete set null,
  payment_label    text not null default '',    -- نسخة نصية من الحساب وقت الطلب
  notes            text not null default '',
  coupon_code      text,
  subtotal         bigint not null,
  discount         bigint not null default 0,
  delivery_fee     bigint,                      -- فاضي = حسب الاتفاق
  total            bigint not null,
  created_at       timestamptz not null default now(),
  preparing_at     timestamptz,
  on_way_at        timestamptz,
  delivered_at     timestamptz,
  cancelled_at     timestamptz,
  updated_at       timestamptz not null default now()
);
create index if not exists orders_status_idx  on public.orders (status, created_at desc);
create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_phone_idx   on public.orders (phone, created_at desc);

create table if not exists public.order_items (
  id          bigint generated always as identity primary key,
  order_id    uuid   not null references public.orders (id) on delete cascade,
  product_id  bigint references public.products (id) on delete set null,
  name        text   not null,                  -- نسخ وقت الطلب، لو انحذف الصنف بعدين
  image       text,
  unit        text   not null,
  qty         numeric(7,1) not null check (qty > 0),
  unit_price  bigint not null,
  line_total  bigint not null,
  note        text   not null default ''        -- نص الطباعة للملبس
);
create index if not exists order_items_order_idx on public.order_items (order_id);

-- ---------- التقييمات ----------
create table if not exists public.reviews (
  id         bigint generated always as identity primary key,
  order_id   uuid not null unique references public.orders (id) on delete cascade,
  name       text not null,                     -- اسم الزبون وقت الطلب
  rating     int  not null check (rating between 1 and 5),
  comment    text not null default '',
  is_public  boolean not null default false,    -- صاحب المحل بيختار شو ينعرض
  created_at timestamptz not null default now()
);

-- ---------- اشتراكات الإشعارات (موبايل صاحب المحل) ----------
create table if not exists public.push_subscriptions (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now()
);
