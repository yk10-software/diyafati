-- =========================================================
-- ضيافتي — 04: بيانات البداية
-- صف الإعدادات، والأقسام والأصناف والقصص تبع الديمو، ومناطق توصيل للمثال.
-- بيضيف بس إذا الجداول فاضية، يعني ما بيكرر لو شغّلته مرتين.
-- الأصناف الحقيقية (150+) رح تنضاف بعدين من محادثة الواتس.
-- =========================================================

-- الإعدادات: صف واحد دايماً
insert into public.settings (id) values (1)
on conflict (id) do nothing;

do $$
declare
  v_mawaleed bigint;
  v_choco    bigint;
  v_mlabbas  bigint;
  v_story    bigint;
begin
  -- ---------- الأقسام ----------
  if not exists (select 1 from public.categories) then
    insert into public.categories (name, sort_order) values ('ضيافة مواليد', 1) returning id into v_mawaleed;
    insert into public.categories (name, sort_order) values ('شوكولا', 2)       returning id into v_choco;
    insert into public.categories (name, sort_order) values ('ملبس', 3)         returning id into v_mlabbas;
    insert into public.categories (name, sort_order, coming_soon) values ('أزهار', 4, true);

    -- ---------- أصناف الديمو ----------
    -- الصور هلق مسارات من الموقع نفسه، وبعدين بتصير روابط من Storage
    insert into public.products (category_id, name, description, price, unit, images, sort_order) values
      (v_mawaleed, 'هريسة لوز بيبي صبي',
       'قطع هريسة لوز بشكل سيارة، كل قطعة مغلفة لحالها. لضيافة المواليد.',
       2000, 'كيلو', array['img/harisa-boy.jpg'], 1),
      (v_mawaleed, 'هريسة لوز بيبي بنت',
       'قطع هريسة لوز بشكل رضّاعة، كل قطعة مغلفة لحالها. لضيافة المواليد.',
       2000, 'كيلو', array['img/harisa-girl.jpg'], 2),
      (v_choco, 'شوكولا ضيافتي ميكس',
       'شوكولا ميكس لوز وبندق، بتغليف ذهبي باسم ضيافتي.',
       2600, 'كيلو', array['img/choco-mix.jpg'], 1),
      (v_choco, 'شوكولا ضيافتي ويفر باللوتس',
       'شوكولا محشية ويفر بكريمة اللوتس.',
       2500, 'كيلو', array['img/choco-lotus.jpg'], 2);

    insert into public.products (category_id, name, description, price, unit, images, custom_note_label, sort_order) values
      (v_mlabbas, 'ملبس مطبوع خاص',
       'ملبس بينطبع عليه الاسم أو اللوغو اللي بدك ياه لمناسبتك.',
       3000, 'كيلو', array['img/mlabbas-1.jpg', 'img/mlabbas-2.jpg'],
       'شو بدك ينطبع على الملبس؟ (اسم، تاريخ، لوغو...)', 1);
  end if;

  -- ---------- القصص (بدون تاريخ انتهاء لأنها للتجربة) ----------
  if not exists (select 1 from public.stories) then
    insert into public.stories (title, sort_order) values ('مواليد', 1) returning id into v_story;
    insert into public.story_items (story_id, image, product_id, sort_order, expires_at)
    select v_story, p.images[1], p.id, p.sort_order, null
    from public.products p where p.name in ('هريسة لوز بيبي صبي', 'هريسة لوز بيبي بنت');

    insert into public.stories (title, sort_order) values ('شوكولا', 2) returning id into v_story;
    insert into public.story_items (story_id, image, product_id, sort_order, expires_at)
    select v_story, p.images[1], p.id, p.sort_order, null
    from public.products p where p.name in ('شوكولا ضيافتي ميكس', 'شوكولا ضيافتي ويفر باللوتس');

    insert into public.stories (title, sort_order) values ('ملبس مطبوع', 3) returning id into v_story;
    insert into public.story_items (story_id, image, product_id, sort_order, expires_at)
    select v_story, img, p.id, ord, null
    from public.products p,
         unnest(p.images) with ordinality as u(img, ord)
    where p.name = 'ملبس مطبوع خاص';
  end if;

  -- ---------- مناطق التوصيل (أرقام للمثال، صاحب المحل بيغيّرها من اللوحة) ----------
  if not exists (select 1 from public.delivery_zones) then
    insert into public.delivery_zones (name, fee, note, sort_order) values
      ('دمشق',           200,  '',     1),
      ('ريف دمشق',       350,  '',     2),
      ('باقي المحافظات', 500,  'شحن',  3),
      ('خارج سوريا',     null, 'حسب الاتفاق', 4);
  end if;
end $$;

-- حسابات شام كاش والبنوك: ما حطيت شي لأنها لسا ما وصلت من العميل.
-- رح تنضاف من اللوحة، أو بهالشكل:
-- insert into public.payment_accounts (kind, title, holder_name, account_number, sort_order)
-- values ('shamcash', 'شام كاش', 'ضيافتي', '...', 1);
