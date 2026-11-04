/* =========================================================
   ضيافتي — واجهة الزبون
   عرض الأصناف والقصص، السلة، وإرسال الطلب عالواتساب
   ========================================================= */
(() => {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const CART_KEY = 'diyafati_cart';
  const CUSTOMER_KEY = 'diyafati_customer';
  const SEEN_KEY = 'diyafati_seen_stories';
  const INSTALL_KEY = 'diyafati_install_dismissed';
  const ORDERS_KEY = 'diyafati_orders';      // توكنات «طلباتي»

  const ls = {
    get(k, fallback) {
      try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; }
      catch (e) { return fallback; }
    },
    set(k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
    },
  };

  const ICON = {
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17" cy="7" r="1" fill="currentColor" stroke="none"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-7.5H16l.5-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21h3Z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    whats: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.5-.3Z"/></svg>',
    cash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>',
    wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1V7Zm0 0 12-3v3"/><circle cx="16" cy="13.5" r="1.2"/></svg>',
    bank: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 9.5 12 4l9 5.5H3Z"/><path d="M5 10v7M9.5 10v7M14.5 10v7M19 10v7M3.5 20h17"/></svg>',
    addSquare: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8.5v7M8.5 12h7"/></svg>',
  };

  /* ---------- الحالة ---------- */
  // الكتالوج من Supabase. منحفظ آخر نسخة بالموبايل، لحتى التطبيق يفتح دغري
  // ويشتغل حتى لو النت ضعيف، وبعدين منحدّثه من النت.
  const CATALOG_KEY = 'diyafati_catalog_v1';
  let settings = { shop_open: true, whatsapp: CONFIG.whatsapp, min_kilo: 0.5 };
  let categories = [];
  let products = [];
  let stories = [];
  let reviews = [];   // اللي اختارها صاحب المحل للعرض
  let zones = [];                            // مناطق التوصيل
  let accounts = [];                         // حسابات شام كاش والبنوك
  let cart = ls.get(CART_KEY, []);           // [{ id, qty, note }]
  let activeCat = 'all';
  let query = '';

  const findProduct = id => products.find(p => p.id === Number(id));
  const findCat = id => categories.find(c => c.id === id);
  const catName = id => (findCat(id) || {}).name || '';
  // الصنف بينطلب إذا متوفر، وقسمه مو «قريباً»
  const isSoon = p => { const c = findCat(p.category_id); return !!(c && c.coming_soon); };
  const canOrder = p => p && p.available && !isSoon(p);

  function cleanCart() {
    cart = cart.filter(l => canOrder(findProduct(l.id)));
  }
  function saveCart() { ls.set(CART_KEY, cart); updateCartUI(); }
  function cartTotal() {
    return cart.reduce((sum, l) => { const p = findProduct(l.id); return p ? sum + effectivePrice(p) * l.qty : sum; }, 0);
  }

  function applyCatalog(data) {
    settings = data.settings || settings;
    categories = data.categories;
    // ترتيب الأصناف: حسب ترتيب الأقسام، وبعدين ترتيب الصنف
    const catOrder = id => { const c = findCat(id); return c ? c.sort_order : 9999; };
    products = data.products.sort((a, b) =>
      catOrder(a.category_id) - catOrder(b.category_id) || a.sort_order - b.sort_order || a.id - b.id);
    // القصة اللي خلصت كل صورها (بعد أسبوع) ما بتبيّن
    stories = data.stories.filter(s => s.story_items.length);
    reviews = data.reviews || [];
    zones = data.zones || [];
    accounts = data.accounts || [];
  }

  // بيجيب كل الكتالوج من Supabase بنفس الوقت
  async function fetchCatalog() {
    const [revs, settingsRows, cats, prods, strs, zs, accs] = await Promise.all([
      // التقييمات شغلة إضافية: إذا فشلت، الكتالوج لازم يضل يفتح
      API.get('reviews?select=id,name,rating,comment&is_public=eq.true&order=created_at.desc&limit=12').catch(() => []),
      API.get('settings?select=*'),
      API.get('categories?select=id,name,sort_order,coming_soon&order=sort_order,id'),
      API.get('products?select=id,category_id,name,description,price,sale_price,sale_until,unit,images,custom_note_label,available,sort_order'),
      API.get('stories?select=id,title,story_items(id,image,product_id,sort_order)&order=sort_order,id&story_items.order=sort_order,id'),
      API.get('delivery_zones?select=id,name,fee,note&order=sort_order,id'),
      API.get('payment_accounts?select=id,kind,title,holder_name,account_number,note&order=sort_order,id'),
    ]);
    return { settings: settingsRows[0], categories: cats, products: prods, stories: strs, reviews: revs, zones: zs, accounts: accs, at: Date.now() };
  }

  let lastFetch = 0;
  async function refreshCatalog() {
    lastFetch = Date.now();
    try {
      const data = await fetchCatalog();
      ls.set(CATALOG_KEY, data);
      applyCatalog(data);
      cleanCart();
      saveCart();
      renderAll();
    } catch (err) {
      console.error(err);
      // إذا ما في نسخة محفوظة، منقول للزبون ونعطيه زر يرجع يجرّب
      if (!products.length) showLoadError();
    }
  }

  function showLoadError() {
    $('#grid').innerHTML = `
      <div class="empty" style="grid-column:1/-1">
        <b>ما قدرنا نجيب الأصناف</b>شيّك عالنت وجرّب كمان مرة.
        <button class="btn ghost" id="retry" style="margin-top:16px">جرّب كمان مرة</button>
      </div>`;
  }

  // صورة الصنف، وإذا ما إله صورة: كرت بهوية ضيافتي (قوس زبدي ولوغو)
  function photo(src, alt = '') {
    return src
      ? `<img src="${escapeHTML(src)}" alt="${escapeHTML(alt)}" loading="lazy">`
      : `<span class="ph"><img src="img/logo-mark.png" alt=""><small>${escapeHTML(alt)}</small></span>`;
  }

  // السعر، ومعه القديم مشطوب إذا في خصم
  function priceHTML(p) {
    const now = effectivePrice(p);
    const old = now !== p.price ? `<s>${formatPrice(p.price)}</s> ` : '';
    return `${old}${formatPrice(now)} <small>/ ${escapeHTML(p.unit)}</small>`;
  }
  function countLabel(n) {
    if (n === 1) return 'صنف واحد';
    if (n === 2) return 'صنفين';
    if (n <= 10) return n + ' أصناف';
    return n + ' صنف';
  }

  /* ---------- العرض ---------- */
  function renderChips() {
    // إذا القسم المختار انحذف من اللوحة، منرجع للكل
    if (activeCat !== 'all' && !findCat(activeCat)) activeCat = 'all';
    const all = { id: 'all', name: 'الكل' };
    $('#chips').innerHTML = [all, ...categories].map(c => `
      <button class="chip" data-cat="${c.id}" aria-pressed="${c.id === activeCat}">
        ${escapeHTML(c.name)}${c.coming_soon ? '<small>قريباً</small>' : ''}
      </button>`).join('');
  }

  function renderGrid() {
    let list = products;
    if (activeCat !== 'all') list = list.filter(p => p.category_id === activeCat);
    if (query) {
      const q = normalizeAr(query);
      list = list.filter(p => normalizeAr(p.name + ' ' + (p.description || '')).includes(q));
    }
    const grid = $('#grid');
    if (!list.length) {
      const cat = findCat(activeCat);
      grid.innerHTML = (cat && cat.coming_soon && !query)
        ? `<div class="empty" style="grid-column:1/-1"><b>${escapeHTML(cat.name)}</b>رح تنضاف أصناف هالقسم قريباً.</div>`
        : `<div class="empty" style="grid-column:1/-1"><b>ما في نتائج</b>جرّب كلمة تانية أو اختار قسم تاني.</div>`;
      return;
    }
    grid.innerHTML = list.map(p => {
      const ok = canOrder(p);
      const tag = !ok ? `<span class="out">${isSoon(p) ? 'قريباً' : 'خلص'}</span>` : '';
      return `
      <article class="card${ok ? '' : ' off'}" data-open="${p.id}">
        <div class="photo">
          ${photo(p.images[0], p.images[0] ? '' : p.name)}
          ${tag}
          ${ok ? `<button class="add" data-add="${p.id}" aria-label="أضف ${escapeHTML(p.name)} للسلة">${ICON.plus}</button>` : ''}
        </div>
        <h3><button class="name-btn" data-open="${p.id}">${escapeHTML(p.name)}</button></h3>
        <p class="price">${priceHTML(p)}</p>
      </article>`;
    }).join('');
  }

  function renderStories() {
    const seen = ls.get(SEEN_KEY, []);
    $('#stories').innerHTML = stories.map((s, i) => `
      <button class="story${seen.includes(s.id) ? ' seen' : ''}" data-story="${i}">
        <div class="frame"><img src="${escapeHTML(s.story_items[0].image)}" alt=""></div>
        <span>${escapeHTML(s.title)}</span>
      </button>`).join('');
  }

  // النجوم للعرض: الممتلئة، وبعدها الفاضية
  function starsText(n) {
    return `<span class="stars-s" role="img" aria-label="${n} من 5">${'★'.repeat(n)}<i>${'★'.repeat(5 - n)}</i></span>`;
  }

  // الاسم بالموقع: الاسم الأول وأول حرف من الكنية (سارة محمد ← سارة م.)
  function shortName(name) {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2) return parts[0] || '';
    const last = parts[parts.length - 1].replace(/^ال(?=.{2})/, '');   // الحلبي ← ح.
    return `${parts[0]} ${[...last][0]}.`;
  }

  // آراء الزباين: بس اللي اختارها صاحب المحل
  function renderReviews() {
    $('#reviews').hidden = !reviews.length;
    $('#rvList').innerHTML = reviews.map(r => `
      <figure class="rv">
        ${starsText(r.rating)}
        ${r.comment ? `<blockquote>${escapeHTML(r.comment)}</blockquote>` : ''}
        <figcaption>${escapeHTML(shortName(r.name))}</figcaption>
      </figure>`).join('');
  }

  // أيقونات الفوتر: الرابط الفاضي ما إله أيقونة، والواتس دايماً من إعدادات المحل
  function renderSocials() {
    const https = url => (/^https:\/\//i.test(url || '') ? url : '');
    const links = [
      [https(settings.instagram_url), 'انستغرام', ICON.instagram],
      [https(settings.facebook_url), 'فيسبوك', ICON.facebook],
      [`https://wa.me/${settings.whatsapp}`, 'واتساب', ICON.whats],
    ];
    $('#socials').innerHTML = links.filter(l => l[0]).map(([url, label, icon]) =>
      `<a class="icon-btn" href="${escapeHTML(url)}" target="_blank" rel="noopener" aria-label="${label}">${icon}</a>`).join('');
  }

  // إذا المحل مسكّر من اللوحة، منقول للزبون فوق
  function renderClosed() {
    let strip = $('#closedStrip');
    if (settings.shop_open) { if (strip) strip.remove(); return; }
    if (!strip) {
      strip = document.createElement('div');
      strip.id = 'closedStrip';
      strip.className = 'notice-strip';
      $('.app').prepend(strip);
    }
    strip.textContent = 'المحل مسكّر هلق، وما عم نستقبل طلبات. فيك تتفرّج عالأصناف.';
  }

  function updateCartUI() {
    // منعدّ بس الأصناف اللي منعرفها (إذا لسا ما وصل الكتالوج، السلة ما بتبيّن)
    const n = cart.filter(l => findProduct(l.id)).length;
    const badge = $('#cartCount');
    badge.textContent = n;
    badge.hidden = n === 0;
    $('#cartBar').hidden = n === 0;
    $('#cartBarCount').textContent = 'السلة (' + countLabel(n) + ')';
    $('#cartBarTotal').textContent = formatPrice(cartTotal());
  }

  function renderAll() {
    renderClosed();
    renderSocials();
    renderChips();
    renderGrid();
    renderStories();
    renderReviews();
    updateCartUI();
  }

  /* ---------- إشعار صغير ---------- */
  let toastTimer;
  function toast(msg) {
    document.querySelectorAll('.toast').forEach(t => t.remove());
    const t = document.createElement('div');
    t.className = 'toast';
    t.setAttribute('role', 'status');
    t.textContent = msg;
    document.body.appendChild(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.remove(), 2200);
  }

  /* ---------- النوافذ السفلية (مع زر الرجوع بالأندرويد) ---------- */
  let current = null;
  let lastFocus = null;
  let onSheetClose = null;   // بتشتغل لما تتسكّر النافذة

  function openSheet(html, opts = {}) {
    document.querySelectorAll('.toast').forEach(t => t.remove());
    if (current) {
      if (onSheetClose) onSheetClose();
      current.remove();
    } else {
      lastFocus = document.activeElement;
      if (history.state && history.state.overlay) history.replaceState({ overlay: 'sheet' }, '');
      else history.pushState({ overlay: 'sheet' }, '');
    }
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `<div class="sheet${opts.tall ? ' tall' : ''}" role="dialog" aria-modal="true" aria-label="${escapeHTML(opts.label || '')}"><div class="grab"></div>${html}</div>`;
    ov.addEventListener('click', e => { if (e.target === ov) closeSheet(); });
    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';
    current = ov;
    onSheetClose = opts.onClose || null;
    const sheet = ov.firstElementChild;
    sheet.addEventListener('click', e => { if (e.target.closest('.close, [data-close]')) closeSheet(); });
    if (opts.onMount) opts.onMount(sheet);
    const f = sheet.querySelector('.close');
    if (f) f.focus({ preventScroll: true });
    return sheet;
  }
  function removeSheet() {
    if (!current) return;
    if (onSheetClose) onSheetClose();
    onSheetClose = null;
    current.remove();
    current = null;
    document.body.style.overflow = '';
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }
  function closeSheet() {
    if (!current) return;
    if (history.state && history.state.overlay) history.back();
    else removeSheet();
  }

  window.addEventListener('popstate', () => {
    if (storyState) closeStoryDom();
    if (current) removeSheet();
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (storyState) closeStory(); else closeSheet();
  });

  /* ---------- صفحة الصنف ---------- */
  // أقل كمية: بالكيلو حسب إعدادات المحل (نص كيلو أو أكتر)، وبالقطعة وحدة
  const minQty = unit => unit === 'كيلو' ? Math.max(0.5, Number(settings.min_kilo) || 0.5) : 1;

  function stepperHTML(qty, unit, small) {
    return `
      <div class="stepper${small ? ' small' : ''}">
        <button type="button" data-step="1" aria-label="زيادة">+</button>
        <output>${formatQty(qty, unit)}</output>
        <button type="button" data-step="-1" aria-label="تنقيص" ${qty <= minQty(unit) ? 'disabled' : ''}>−</button>
      </div>`;
  }
  const stepQty = (qty, unit, dir) => Math.min(100, Math.max(minQty(unit), qty + qtyStep(unit) * dir));

  function openProduct(id) {
    const p = findProduct(id);
    if (!p) return;
    let qty = Math.max(1, minQty(p.unit));
    const price = effectivePrice(p);
    const ok = canOrder(p);
    const imgs = p.images.length ? p.images : [null];

    const sheet = openSheet(`
      <div class="sheet-head">
        <span class="price"><small>${escapeHTML(catName(p.category_id))}</small></span>
        <button class="close" aria-label="إغلاق">×</button>
      </div>
      <div class="gallery" id="gal">${imgs.map(src => photo(src, src ? p.name : '')).join('')}</div>
      ${imgs.length > 1 ? `<div class="dots">${imgs.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>` : ''}
      <h2 class="p-name">${escapeHTML(p.name)}</h2>
      <p class="price">${priceHTML(p)}</p>
      ${p.description ? `<p class="p-desc">${escapeHTML(p.description)}</p>` : ''}
      ${ok && p.custom_note_label ? `
        <label class="field" style="margin-top:18px">
          <span>${escapeHTML(p.custom_note_label)}</span>
          <input id="pNote" maxlength="120" placeholder="مثلاً: أهلاً بـ «جود» 2026">
        </label>` : ''}
      <div class="buy">
        ${ok ? `
        <div class="buy-row">
          <div id="qtyBox" aria-label="الكمية">${stepperHTML(qty, p.unit)}</div>
          <b class="buy-total" id="pTotal" aria-live="polite">${formatPrice(price * qty)}</b>
        </div>
        <button class="btn" id="pAdd">أضف للسلة</button>` : `
        <button class="btn" disabled>${isSoon(p) ? 'قريباً' : 'خلص هلق، رجّع شوفه بعدين'}</button>`}
      </div>
    `, { label: p.name });
    if (!ok) return;

    const gal = $('#gal', sheet);
    if (imgs.length > 1) {
      gal.addEventListener('scroll', () => {
        const i = Math.round(Math.abs(gal.scrollLeft) / gal.clientWidth);
        sheet.querySelectorAll('.dots i').forEach((d, k) => d.classList.toggle('on', k === i));
      }, { passive: true });
    }

    $('#qtyBox', sheet).addEventListener('click', e => {
      const b = e.target.closest('[data-step]');
      if (!b) return;
      qty = stepQty(qty, p.unit, Number(b.dataset.step));
      $('#qtyBox', sheet).innerHTML = stepperHTML(qty, p.unit);
      $('#pTotal', sheet).textContent = formatPrice(price * qty);
    });

    $('#pAdd', sheet).addEventListener('click', () => {
      const note = p.custom_note_label ? $('#pNote', sheet).value.trim() : '';
      addToCart(p.id, qty, note);
      closeSheet();
      toast('انضاف ' + formatQty(qty, p.unit) + ' ' + p.name + ' للسلة');
    });
  }

  function addToCart(id, qty, note = '') {
    const line = cart.find(l => l.id === id && (l.note || '') === note);
    if (line) line.qty += qty;
    else cart.push({ id, qty, note });
    saveCart();
  }

  /* ---------- السلة ---------- */
  function openCart() {
    cleanCart();
    const sheet = openSheet('<div id="cartBody"></div>', { label: 'سلتك' });
    renderCartInto(sheet);
    sheet.addEventListener('click', e => {
      const stepBtn = e.target.closest('[data-step]');
      const rm = e.target.closest('[data-remove]');
      const row = e.target.closest('[data-line]');
      if (stepBtn && row) {
        const l = cart[Number(row.dataset.line)];
        const p = findProduct(l.id);
        l.qty = stepQty(l.qty, p.unit, Number(stepBtn.dataset.step));
        saveCart(); renderCartInto(sheet);
      } else if (rm) {
        cart.splice(Number(rm.dataset.remove), 1);
        saveCart(); renderCartInto(sheet);
      } else if (e.target.closest('#toCheckout')) {
        if (!settings.shop_open) { toast('المحل مسكّر هلق، جرّب بعدين'); return; }
        draft = null;
        refreshCatalog();   // آخر الأسعار وأجور التوصيل والحسابات
        openCheckout();
      } else if (e.target.closest('#browse')) {
        closeSheet();
      }
    });
  }

  function renderCartInto(sheet) {
    const body = $('#cartBody', sheet);
    if (!cart.length) {
      body.innerHTML = `
        <div class="sheet-head"><h2>سلتك</h2><button class="close" aria-label="إغلاق">×</button></div>
        <div class="empty"><b>سلتك فاضية</b>اختار من الأصناف وضيفها هون.</div>
        <button class="btn ghost" id="browse">تصفّح الأصناف</button>`;
      return;
    }
    body.innerHTML = `
      <div class="sheet-head"><h2>سلتك</h2><button class="close" aria-label="إغلاق">×</button></div>
      ${cart.map((l, i) => {
        const p = findProduct(l.id);
        return `
          <div class="c-item" data-line="${i}">
            ${photo(p.images[0])}
            <div>
              <h4>${escapeHTML(p.name)}</h4>
              ${l.note ? `<p class="note">${escapeHTML(l.note)}</p>` : ''}
              <div class="ctrl">
                ${stepperHTML(l.qty, p.unit, true)}
                <button class="link-btn" data-remove="${i}">إزالة</button>
              </div>
            </div>
            <span class="sum">${effectivePrice(p) !== p.price ? `<s>${formatPrice(p.price * l.qty)}</s>` : ''}${formatPrice(effectivePrice(p) * l.qty)}</span>
          </div>`;
      }).join('')}
      <div class="totals"><span>المجموع</span><b>${formatPrice(cartTotal())}</b></div>
      <button class="btn" id="toCheckout">متابعة الطلب</button>`;
  }

  /* ---------- أدوات الطلب ---------- */
  const TZ = 'Asia/Damascus';
  const ORDER_ERRORS = {
    shop_closed: 'المحل مسكّر هلق، جرّب بعدين.',
    busy: 'في ضغط طلبات هلق، جرّب بعد دقيقة.',
    too_many_orders: 'بعتت طلبات كتير من نفس الرقم. استنى شوي، أو راسلنا عالواتس.',
    invalid_name: 'اكتب اسمك.',
    invalid_phone: 'اكتب رقم موبايل صحيح.',
    invalid_address: 'اكتب العنوان لحتى يوصلك الطلب.',
    invalid_zone: 'اختار منطقة التوصيل.',
    empty_cart: 'سلتك فاضية.',
    product_unavailable: 'في صنف بسلتك خلص أو تغيّر. شيّك عالسلة وجرّب كمان مرة.',
    invalid_qty: 'في كمية مو مزبوطة بالسلة.',
    invalid_mode: 'اختار وقت التوصيل.',
    outside_hours: 'هالوقت برا دوام المحل، اختار وقت تاني.',
    not_delivered: 'بتقدر تقيّم بعد ما يوصلك الطلب.',
    invalid_rating: 'اختار عدد النجوم.',
    scheduling_disabled: 'الطلب بموعد موقّف هلق، اختار «بأقرب وقت».',
    invalid_schedule: 'الموعد لازم يكون جاي، وضمن الأيام المسموحة.',
    invalid_payment: 'اختار طريقة الدفع.',
    payment_unavailable: 'طريقة الدفع هي ما عادت متاحة، اختار غيرها.',
    invalid_coupon: 'الكود مو صحيح أو خلصت مدته.',
    coupon_min_total: 'مجموع الطلب أقل من الحد الأدنى لهالكود.',
  };
  function orderError(err) {
    if (ORDER_ERRORS[err.message]) return ORDER_ERRORS[err.message];
    console.error(err);
    return 'ما وصل الطلب، يمكن النت ضعيف. جرّب كمان مرة، وما رح ينحسب مرتين.';
  }

  // اليوم بتوقيت سوريا بصيغة yyyy-mm-dd
  const todayISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
  function addDays(iso, n) {
    const d = new Date(iso + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  const dayLabel = iso => new Date(iso).toLocaleDateString('ar-SY-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });
  const shortDay = iso => new Date(iso).toLocaleDateString('ar-SY-u-nu-latn', { day: 'numeric', month: 'long', timeZone: TZ });
  const clock = iso => new Date(iso).toLocaleTimeString('ar-SY-u-nu-latn', { hour: 'numeric', minute: '2-digit', timeZone: TZ });
  const whenLabel = iso => `${dayLabel(iso)}، الساعة ${clock(iso)}`;

  // رقم مرجعي لمحاولة الطلب (randomUUID ما بتشتغل إلا على https أو localhost)
  function newRef() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    const t = document.createElement('textarea');
    t.value = text;
    t.style.position = 'fixed';
    t.style.opacity = '0';
    document.body.appendChild(t);
    t.select();
    const ok = document.execCommand('copy');
    t.remove();
    return ok ? Promise.resolve() : Promise.reject(new Error('copy'));
  }

  // قوائم اليوم والساعة بدل خانات المتصفح، لأنها بتعرض أرقام عربية على أجهزة لغتها عربي
  // المواعيد بتطلع من دوام المحل (الإعدادات): كل نص ساعة من الفتح للسكر
  const toMin = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
  const openMin = () => toMin(settings.open_time || '09:00');
  const closeMin = () => toMin(settings.close_time || '22:00');
  const clockOf = t => clock(`2026-01-01T${t}:00+03:00`);

  // الساعات المتاحة بيوم معيّن: اللي بعد هلق، وضمن المدى المسموح
  function slots(date) {
    const now = Date.now();
    const last = now + (settings.schedule_max_days || 30) * 86400000;
    const out = [];
    for (let m = openMin(); m <= closeMin(); m += 30) {
      const t = String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
      const at = new Date(`${date}T${t}:00+03:00`).getTime();
      if (at > now && at <= last) out.push(t);
    }
    return out;
  }
  // اليوم اللي خلص دوامه ما بيبيّن بالقائمة
  function dayOptions(today, selected) {
    const days = Array.from({ length: (settings.schedule_max_days || 30) + 1 }, (_, i) => addDays(today, i))
      .filter(d => slots(d).length);
    return '<option value="">اختار</option>' + days.map(d =>
      `<option value="${d}" ${d === selected ? 'selected' : ''}>${dayLabel(`${d}T12:00:00+03:00`)}</option>`).join('');
  }
  function timeOptions(date, selected) {
    if (!date) return '<option value="">اختار اليوم أول</option>';
    return '<option value="">اختار</option>' + slots(date).map(t =>
      `<option value="${t}" ${t === selected ? 'selected' : ''}>${clockOf(t)}</option>`).join('');
  }
  // هل المحل هلق برا الدوام؟ (بتوقيت دمشق)
  function outsideHours() {
    const now = toMin(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()));
    return now < openMin() || now > closeMin();
  }

  /* ---------- الخطوة 1: تفاصيل الطلب ---------- */
  // مسودة الطلب: بتضل محفوظة إذا رجع الزبون من الدفع للتفاصيل
  let draft = null;

  function totals() {
    const subtotal = Math.round(cartTotal());
    const zone = zones.find(z => z.id === draft.zone_id);
    const discount = draft.coupon ? draft.coupon.discount : 0;
    const fee = zone ? zone.fee : undefined;   // null = حسب الاتفاق
    return { subtotal, discount, fee, total: subtotal - discount + (fee || 0) };
  }

  function totalsHTML() {
    const t = totals();
    const feeText = t.fee === undefined ? 'اختار المنطقة' : t.fee === null ? 'حسب الاتفاق' : formatPrice(t.fee);
    return `
      <div class="o-sum"><span>الأصناف (${countLabel(cart.length)})</span><span>${formatPrice(t.subtotal)}</span></div>
      ${t.discount ? `<div class="o-sum"><span>خصم <bdi dir="ltr">${escapeHTML(draft.coupon.code)}</bdi></span><span>−${formatPrice(t.discount)}</span></div>` : ''}
      <div class="o-sum"><span>التوصيل</span><span>${feeText}</span></div>
      <div class="o-sum total"><b>المجموع</b><b class="price">${formatPrice(t.total)}</b></div>`;
  }

  function openCheckout() {
    if (!draft) {
      const c = ls.get(CUSTOMER_KEY, {});
      draft = { name: c.name || '', phone: c.phone || '', address: c.address || '', zone_id: c.zone_id || null,
        mode: 'asap', date: '', time: '', notes: '', coupon: null, method: null, account_id: null };
    }
    if (!zones.some(z => z.id === draft.zone_id)) draft.zone_id = null;
    if (!settings.scheduled_enabled) draft.mode = 'asap';
    const today = todayISO();
    // الموعد المحفوظ ممكن يكون فات، أو الدوام تغيّر
    if (draft.date && !slots(draft.date).length) draft.date = '';
    if (!draft.date || !slots(draft.date).includes(draft.time)) draft.time = '';
    const late = outsideHours();

    const sheet = openSheet(`
      <div class="sheet-head"><h2>تفاصيل الطلب</h2><button class="close" aria-label="إغلاق">×</button></div>
      <form id="orderForm" novalidate>
        <label class="field" data-f="name">
          <span>الاسم</span>
          <input name="cname" autocomplete="name" maxlength="80" value="${escapeHTML(draft.name)}">
          <span class="err">اكتب اسمك.</span>
        </label>
        <label class="field" data-f="phone">
          <span>رقم الموبايل</span>
          <input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="09xxxxxxxx" value="${escapeHTML(draft.phone)}">
          <span class="err">اكتب رقم موبايل صحيح.</span>
        </label>
        <label class="field" data-f="zone">
          <span>منطقة التوصيل</span>
          <select name="zone">
            <option value="">اختار المنطقة</option>
            ${zones.map(z => `<option value="${z.id}" ${z.id === draft.zone_id ? 'selected' : ''}>${escapeHTML(z.name)}${z.fee == null ? ' (حسب الاتفاق)' : ` (${formatPrice(z.fee)})`}</option>`).join('')}
          </select>
          <span class="err">اختار منطقة التوصيل.</span>
        </label>
        <label class="field" data-f="address">
          <span>عنوان التوصيل</span>
          <textarea name="address" rows="2" maxlength="300" placeholder="الشارع، البناء، أقرب معلم">${escapeHTML(draft.address)}</textarea>
          <span class="err">اكتب العنوان لحتى يوصلك الطلب.</span>
        </label>

        <div class="field"><span>وقت التوصيل</span></div>
        <div class="seg" role="group" aria-label="وقت التوصيل">
          <button type="button" data-mode="asap" aria-pressed="${draft.mode === 'asap'}">بأقرب وقت</button>
          ${settings.scheduled_enabled ? `<button type="button" data-mode="scheduled" aria-pressed="${draft.mode === 'scheduled'}">بموعد محدد</button>` : ''}
        </div>
        <p class="caption" id="asapNote" ${late && draft.mode === 'asap' ? '' : 'hidden'}>المحل هلق برا الدوام، فطلبك بينجهز لما نفتح الساعة ${clockOf(String(settings.open_time || '09:00').slice(0, 5))}.</p>
        <div class="two" id="when" ${draft.mode === 'scheduled' ? '' : 'hidden'}>
          <label class="field" data-f="date">
            <span>اليوم</span>
            <select name="date">${dayOptions(today, draft.date)}</select>
            <span class="err">اختار اليوم.</span>
          </label>
          <label class="field" data-f="time">
            <span>الساعة</span>
            <select name="time">${timeOptions(draft.date, draft.time)}</select>
            <span class="err">اختار ساعة جاية.</span>
          </label>
        </div>

        <label class="field">
          <span>ملاحظات <small>(اختياري)</small></span>
          <textarea name="notes" rows="2" maxlength="500" placeholder="مثلاً: نوع المناسبة، لون التغليف">${escapeHTML(draft.notes)}</textarea>
        </label>

        <div class="field"><span>كود خصم <small>(اختياري)</small></span></div>
        <div class="coupon">
          <input id="cpInput" dir="ltr" autocomplete="off" autocapitalize="characters" aria-label="كود الخصم" value="${escapeHTML(draft.coupon ? draft.coupon.code : '')}">
          <button class="btn-sm" type="button" id="cpBtn">${draft.coupon ? 'شيل' : 'تطبيق'}</button>
        </div>
        <p class="form-msg" id="cpMsg" role="status"></p>

        <div class="o-box" id="sumBox">${totalsHTML()}</div>
        <button class="btn" type="submit">متابعة للدفع</button>
      </form>
    `, { tall: true, label: 'تفاصيل الطلب' });

    const form = $('#orderForm', sheet);
    const f = form.elements;
    const showTotals = () => { $('#sumBox', sheet).innerHTML = totalsHTML(); };
    const keep = () => {
      Object.assign(draft, {
        name: f.cname.value.trim(), phone: f.phone.value.trim(), address: f.address.value.trim(),
        zone_id: Number(f.zone.value) || null, date: f.date.value, time: f.time.value, notes: f.notes.value.trim(),
      });
    };

    f.zone.addEventListener('change', () => { keep(); showTotals(); });
    sheet.querySelector('.seg').addEventListener('click', e => {
      const b = e.target.closest('[data-mode]');
      if (!b) return;
      draft.mode = b.dataset.mode;
      sheet.querySelectorAll('.seg button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      $('#when', sheet).hidden = draft.mode !== 'scheduled';
      $('#asapNote', sheet).hidden = !(late && draft.mode === 'asap');
    });
    // قائمة الساعات بتتبع اليوم المختار
    f.date.addEventListener('change', () => {
      const keepTime = slots(f.date.value).includes(f.time.value) ? f.time.value : '';
      f.time.innerHTML = timeOptions(f.date.value, keepTime);
    });
    form.addEventListener('input', e => {
      const field = e.target.closest('.field');
      if (field) field.classList.remove('invalid');
    });

    // الكوبون: هاد للعرض بس، والحساب الحقيقي بـ place_order
    $('#cpBtn', sheet).addEventListener('click', async e => {
      const btn = e.target;
      const msg = $('#cpMsg', sheet);
      msg.textContent = '';
      msg.classList.remove('ok');
      if (draft.coupon) {
        draft.coupon = null;
        $('#cpInput', sheet).value = '';
        btn.textContent = 'تطبيق';
        showTotals();
        return;
      }
      const code = $('#cpInput', sheet).value.trim();
      if (!code) return;
      btn.disabled = true;
      try {
        const r = await API.rpc('check_coupon', { p_code: code, p_subtotal: Math.round(cartTotal()) });
        if (r.ok) {
          draft.coupon = { code: r.code, discount: r.discount };
          btn.textContent = 'شيل';
          msg.classList.add('ok');
          msg.textContent = `انخصم ${formatPrice(r.discount)}`;
          showTotals();
        } else {
          msg.textContent = r.reason === 'coupon_min_total'
            ? `هالكود لطلب من ${formatPrice(r.min_total)} وفوق.` : ORDER_ERRORS.invalid_coupon;
        }
      } catch (err) {
        console.error(err);
        msg.textContent = 'ما قدرنا نفحص الكود، شيّك عالنت.';
      }
      btn.disabled = false;
    });

    form.addEventListener('submit', e => {
      e.preventDefault();
      keep();
      const bad = [];
      if (draft.name.length < 2) bad.push('name');
      if (draft.phone.replace(/\D/g, '').length < 9) bad.push('phone');
      if (!draft.zone_id) bad.push('zone');
      if (draft.address.length < 3) bad.push('address');
      if (draft.mode === 'scheduled') {
        if (!draft.date) bad.push('date');
        // سوريا +03:00 طول السنة، والموعد دايماً بتوقيتها حتى لو الزبون برا
        if (!draft.time || new Date(`${draft.date}T${draft.time}:00+03:00`) <= new Date()) bad.push('time');
      }
      sheet.querySelectorAll('.field[data-f]').forEach(x => x.classList.toggle('invalid', bad.includes(x.dataset.f)));
      if (bad.length) {
        const first = sheet.querySelector('.field.invalid input, .field.invalid textarea, .field.invalid select');
        if (first) first.focus();
        return;
      }
      ls.set(CUSTOMER_KEY, { name: draft.name, phone: draft.phone, address: draft.address, zone_id: draft.zone_id });
      openPayment();
    });
  }

  /* ---------- الخطوة 2: طريقة الدفع ---------- */
  function payMethods() {
    const out = [];
    const accs = kind => accounts.filter(a => a.kind === kind);
    if (settings.cash_enabled) out.push({ id: 'cash', icon: ICON.cash, title: 'كاش عند الاستلام', sub: 'بتدفع للمندوب لما يوصلك الطلب', list: [] });
    if (accs('shamcash').length) out.push({ id: 'shamcash', icon: ICON.wallet, title: 'شام كاش', sub: 'تحويل من تطبيق شام كاش', list: accs('shamcash') });
    if (accs('bank').length) out.push({ id: 'bank', icon: ICON.bank, title: 'تحويل بنكي', sub: 'بيطلعلك رقم الحساب لما تختاره', list: accs('bank') });
    return out;
  }

  function openPayment() {
    draft.client_ref = newRef();   // نفس الرقم لكل إعادة محاولة من هالشاشة
    const methods = payMethods();
    if (!methods.some(m => m.id === draft.method)) draft.method = methods[0] ? methods[0].id : null;

    const sheet = openSheet('<div id="payBody"></div>', { tall: true, label: 'طريقة الدفع' });

    function render() {
      const t = totals();
      const m = methods.find(x => x.id === draft.method);
      if (m && m.list.length && !m.list.some(a => a.id === draft.account_id)) draft.account_id = m.list[0].id;
      const amount = `<span class="price">${formatPrice(t.total)}</span>`;
      $('#payBody', sheet).innerHTML = `
        <div class="sheet-head">
          <div><h2>طريقة الدفع</h2><p class="muted-line" style="margin:0">اختار كيف بدك تدفع</p></div>
          <button class="close" aria-label="إغلاق">×</button>
        </div>
        <div class="o-box">
          <div class="o-sum total"><b>المجموع</b><b class="price">${formatPrice(t.total)}</b></div>
          ${t.fee === null ? '<p class="hint" style="margin:0">أجور التوصيل حسب الاتفاق، ومو محسوبة هون.</p>' : ''}
        </div>
        ${methods.length ? methods.map(x => `
          <div class="pay-opt${x.id === draft.method ? ' on' : ''}">
            <button type="button" class="pay-row" data-method="${x.id}" aria-pressed="${x.id === draft.method}">
              <span class="pay-radio"></span>
              <span class="pay-ico">${x.icon}</span>
              <span><b>${x.title}</b><small>${x.sub}</small></span>
            </button>
            ${x.id === draft.method && x.list.length ? `
              <div class="pay-box">
                ${x.list.map(a => `
                  <div class="pay-acc${a.id === draft.account_id ? ' on' : ''}" data-acc="${a.id}">
                    <div>
                      <small>${escapeHTML(a.title)}${a.holder_name ? ` · ${escapeHTML(a.holder_name)}` : ''}</small>
                      <b dir="ltr">${escapeHTML(a.account_number)}</b>
                      ${a.note ? `<small>${escapeHTML(a.note)}</small>` : ''}
                    </div>
                    <button type="button" class="btn-sm" data-copy="${escapeHTML(a.account_number)}">نسخ</button>
                  </div>`).join('')}
                <ol class="pay-steps">
                  <li>حوّل ${amount} على هالحساب</li>
                  <li>اضغط «أرسل الطلب عبر واتساب»</li>
                  <li>ابعت صورة الإيصال بنفس المحادثة</li>
                </ol>
              </div>` : ''}
          </div>`).join('') : `<div class="empty"><b>ما في طريقة دفع متاحة هلق</b>راسلنا عالواتس لنكمّل طلبك.</div>`}
        <p class="form-msg" id="payMsg" role="alert"></p>
        ${methods.length ? `<button class="btn whats" id="sendOrder">${ICON.whats} أرسل الطلب عبر واتساب</button>` : ''}
        <button class="link-btn gate-link" id="backDetails">رجوع للتفاصيل</button>`;
    }
    render();

    sheet.addEventListener('click', async e => {
      const copy = e.target.closest('[data-copy]');
      if (copy) {
        try { await copyText(copy.dataset.copy); toast('انتسخ الرقم'); }
        catch (err) { toast('ما انتسخ، انسخه بإيدك'); }
        return;
      }
      const method = e.target.closest('[data-method]');
      if (method) { draft.method = method.dataset.method; render(); return; }
      const acc = e.target.closest('[data-acc]');
      if (acc) { draft.account_id = Number(acc.dataset.acc); render(); return; }
      if (e.target.closest('#backDetails')) { openCheckout(); return; }
      const send = e.target.closest('#sendOrder');
      if (send) submitOrder(send, sheet);
    });
  }

  /* ---------- الخطوة 3: الحفظ وبعدين الواتس ---------- */
  async function submitOrder(btn, sheet) {
    btn.disabled = true;
    const html = btn.innerHTML;
    btn.textContent = 'لحظة، عم نحفظ طلبك...';
    $('#payMsg', sheet).textContent = '';
    const usesAccount = draft.method !== 'cash';
    try {
      const r = await API.rpc('place_order', { p_order: {
        client_ref: draft.client_ref,
        name: draft.name,
        phone: draft.phone,
        zone_id: draft.zone_id,
        address: draft.address,
        delivery_mode: draft.mode,
        scheduled_at: draft.mode === 'scheduled' ? `${draft.date}T${draft.time}:00+03:00` : null,
        payment_method: draft.method,
        payment_account_id: usesAccount ? draft.account_id : null,
        notes: draft.notes,
        coupon_code: draft.coupon ? draft.coupon.code : null,
        items: cart.map(l => ({ product_id: l.id, qty: l.qty, note: l.note || '' })),
      } });
      orderPlaced(r);
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = html;
      $('#payMsg', sheet).textContent = orderError(err);
      if (err.message === 'product_unavailable' || err.message === 'payment_unavailable') refreshCatalog();
    }
  }

  function buildMessage(r) {
    const d = draft;
    const L = [`*طلب جديد من تطبيق ${CONFIG.shopName}*`, `رقم الطلب: #${r.code}`, '', '*الأصناف:*'];
    r.items.forEach(i => {
      L.push(`- ${i.name}: ${formatQty(Number(i.qty), i.unit)} = ${formatPrice(i.line_total)}`);
      if (i.note) L.push(`  ملاحظة: ${i.note}`);
    });
    L.push('');
    if (r.discount) L.push(`الخصم: ${formatPrice(r.discount)}`);
    L.push(`التوصيل: ${r.delivery_fee == null ? 'حسب الاتفاق' : formatPrice(r.delivery_fee)}`);
    L.push(`*المجموع: ${formatPrice(r.total)}*`, '');
    L.push(`الاسم: ${d.name}`);
    L.push(`الموبايل: ${d.phone}`);
    L.push(`العنوان: ${zones.find(z => z.id === d.zone_id).name}، ${d.address}`);
    L.push(`الموعد: ${d.mode === 'scheduled' ? whenLabel(`${d.date}T${d.time}:00+03:00`) : 'بأقرب وقت'}`);
    if (d.notes) L.push(`ملاحظات: ${d.notes}`);
    L.push(`الدفع: ${d.method === 'cash' ? 'كاش عند الاستلام' : `${d.method === 'shamcash' ? 'شام كاش' : 'تحويل بنكي'}، رح ابعت الإيصال هون`}`);
    return L.join('\n');
  }

  function orderPlaced(r) {
    // الطلب صار محفوظ بقاعدة البيانات، وهلق منفتح الواتس
    saveToken(r.token);
    const url = `https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(buildMessage(r))}`;
    const paid = draft.method !== 'cash';
    cart = [];
    saveCart();
    draft = null;
    const win = window.open(url, '_blank');
    if (win) { try { win.opener = null; } catch (e) {} }

    const sheet = openSheet(`
      <div class="center">
        <div class="done-mark">${ICON.check}</div>
        <h2 class="p-name" style="margin-top:8px">انحفظ طلبك</h2>
        <p class="p-desc">رقم طلبك <b><bdi dir="ltr">#${escapeHTML(r.code)}</bdi></b>. اضغط إرسال بواتساب لنتأكد معك${paid ? '، وابعت صورة الإيصال بنفس المحادثة' : ''}.</p>
        <a class="btn whats" href="${url}" target="_blank" rel="noopener" style="margin-top:16px;text-decoration:none">${ICON.whats} فتح واتساب</a>
        <button class="btn ghost" id="trackNew" style="margin-top:10px">تابع طلبك</button>
      </div>`, { label: 'تم حفظ الطلب' });
    $('#trackNew', sheet).addEventListener('click', () => openOrder(r.token));
  }

  /* ---------- طلباتي ومتابعة الطلب ---------- */
  // توكنات طلبات هالموبايل. هي الشي الوحيد اللي بيربط الزبون بطلبه
  function saveToken(token) {
    const list = ls.get(ORDERS_KEY, []).filter(t => t !== token);
    list.unshift(token);
    ls.set(ORDERS_KEY, list.slice(0, 50));
  }

  const ACTIVE = ['new', 'preparing', 'on_way'];
  const TRACK = [
    { key: 'new', at: 'created_at', title: 'وصل طلبك للمحل', short: 'وصل للمحل' },
    { key: 'preparing', at: 'preparing_at', title: 'عم يتحضر', short: 'عم يتحضر', sub: 'ضيافتي عم يجهزوا طلبك' },
    { key: 'on_way', at: 'on_way_at', title: 'طلع بالطريق', short: 'بالطريق', sub: 'المندوب جايي لعندك' },
    { key: 'delivered', at: 'delivered_at', title: 'وصل', short: 'وصل', sub: 'بالهنا والشفا' },
  ];
  const HERO = { new: 'وصل طلبك للمحل', preparing: 'طلبك عم يتحضر', on_way: 'طلبك بالطريق', delivered: 'وصل طلبك', cancelled: 'انلغى الطلب' };
  const CHIP = {
    new: ['st-new', 'جديد'], preparing: ['st-prep', 'عم يتحضر'], on_way: ['st-way', 'بالطريق'],
    delivered: ['st-done', 'وصل ✓'], cancelled: ['st-off', 'ملغي'],
  };
  const chipHTML = s => `<span class="st-chip ${CHIP[s][0]}">${CHIP[s][1]}</span>`;
  const stepIndex = o => TRACK.findIndex(s => s.key === o.status);
  const deliveryLine = o => o.status === 'cancelled' ? 'تواصل معنا إذا عندك سؤال'
    : o.delivery_mode === 'scheduled' ? `بيوصلك ${whenLabel(o.scheduled_at)}` : 'بأقرب وقت';
  const payLine = o => ({ cash: 'كاش عند الاستلام', shamcash: 'شام كاش', bank: 'تحويل بنكي' }[o.payment_method]);
  const thumbs = o => `<div class="o-thumbs">${o.items.slice(0, 4).map(i => photo(i.image)).join('')}</div>`;

  function orderTitle(o) {
    const first = o.items[0];
    if (!first) return `طلب #${o.code}`;
    return o.items.length === 1 ? first.name : `${first.name} و${o.items.length - 1 === 1 ? 'صنف تاني' : (o.items.length - 1) + ' أصناف'}`;
  }

  // التقييم بعد التسليم: مرة وحدة، وبعدها منعرض شو اختار
  function reviewHTML(o) {
    if (o.status !== 'delivered') return '';
    if (o.review) {
      return `
        <div class="o-box rate">
          <b>شكراً لتقييمك</b>
          ${starsText(o.review.rating)}
          ${o.review.comment ? `<p>${escapeHTML(o.review.comment)}</p>` : ''}
        </div>`;
    }
    return `
      <form class="o-box rate" id="rateForm" novalidate>
        <b>كيف كان طلبك؟</b>
        <div class="stars" role="group" aria-label="التقييم">
          ${[1, 2, 3, 4, 5].map(n => `<button type="button" data-star="${n}" aria-label="${n} من 5" aria-pressed="false">★</button>`).join('')}
        </div>
        <label class="field">
          <span>بدك تكتب شي؟ <small>(اختياري)</small></span>
          <textarea name="comment" rows="2" maxlength="500"></textarea>
        </label>
        <p class="caption">ممكن ينعرض تقييمك بالموقع باسمك الأول وأول حرف من كنيتك.</p>
        <p class="form-msg" id="rateMsg" role="alert"></p>
        <button class="btn" type="submit">ابعت التقييم</button>
      </form>`;
  }

  function trackHTML(o) {
    const cur = stepIndex(o);
    const done = o.status === 'delivered';
    return `
      <div class="sheet-head">
        <h2>طلب <bdi dir="ltr">#${escapeHTML(o.code)}</bdi></h2>
        <button class="close" aria-label="إغلاق">×</button>
      </div>
      <div class="o-hero"><b>${HERO[o.status]}</b><span>${deliveryLine(o)}</span></div>
      ${reviewHTML(o)}
      ${o.status === 'cancelled' ? '' : `
      <ul class="o-tl">
        ${TRACK.map((s, i) => `
          <li class="${i < cur || done ? 'ok' : i === cur ? 'cur' : ''}">
            <span class="dot">${i < cur || done ? '✓' : ''}</span>
            <div><b>${s.title}</b><small>${i === 0 ? `الدفع: ${payLine(o)}` : s.sub}</small></div>
            <span class="tm">${o[s.at] ? clock(o[s.at]) : ''}</span>
          </li>`).join('')}
      </ul>`}
      <div class="o-box">
        <div class="o-line">${thumbs(o)}<span>${countLabel(o.items.length)}</span></div>
        ${o.discount ? `<div class="o-sum"><span>الخصم</span><span>−${formatPrice(o.discount)}</span></div>` : ''}
        <div class="o-sum"><span>التوصيل</span><span>${o.delivery_fee == null ? 'حسب الاتفاق' : formatPrice(o.delivery_fee)}</span></div>
        <div class="o-sum total"><b>المجموع</b><b class="price">${formatPrice(o.total)}</b></div>
      </div>
      <a class="btn ghost-wa" href="https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(`سلام، عندي سؤال عن طلبي رقم #${o.code}`)}" target="_blank" rel="noopener">${ICON.whats} راسل المحل عالواتس</a>
      ${ACTIVE.includes(o.status) ? '<p class="hint">الصفحة بتتحدّث لحالها كل ما المحل يغيّر حالة الطلب</p>'
        : '<button class="btn ghost" data-reorder style="margin-top:10px">اطلب نفسه مرة تانية</button>'}
      <button class="link-btn gate-link" data-all-orders>كل طلباتي</button>`;
  }

  function openOrder(token) {
    let order = null;
    let timer = null;
    let rating = 0;
    const sheet = openSheet('<div id="trackBody"><div class="empty">لحظة...</div></div>', {
      tall: true, label: 'متابعة الطلب', onClose: () => clearTimeout(timer),
    });
    const body = $('#trackBody', sheet);

    async function load() {
      clearTimeout(timer);
      try {
        const o = await API.rpc('get_order', { p_token: token });
        if (!body.isConnected) return;
        if (!o) {
          body.innerHTML = '<div class="sheet-head"><h2>الطلب</h2><button class="close" aria-label="إغلاق">×</button></div><div class="empty"><b>ما لقينا هالطلب</b></div>';
          return;
        }
        // منعيد الرسم بس إذا تغيّرت الحالة، لحتى ما ينقز المحتوى عالموبايل
        if (!order || order.status !== o.status) body.innerHTML = trackHTML(o);
        order = o;
        if (ACTIVE.includes(o.status)) timer = setTimeout(load, 20000);
      } catch (err) {
        console.error(err);
        if (!order) body.innerHTML = '<div class="sheet-head"><h2>الطلب</h2><button class="close" aria-label="إغلاق">×</button></div><div class="empty"><b>ما قدرنا نجيب طلبك</b>شيّك عالنت، طلبك محفوظ.</div>';
        timer = setTimeout(load, 20000);
      }
    }
    load();

    // بعد التسليم الـ polling بيوقف، فالنجوم والتعليق ما بينمسحوا وهو عم يكتب
    sheet.addEventListener('submit', async e => {
      if (e.target.id !== 'rateForm') return;
      e.preventDefault();
      const msg = $('#rateMsg', sheet);
      if (!rating) { msg.textContent = ORDER_ERRORS.invalid_rating; return; }
      const btn = e.target.querySelector('button[type="submit"]');
      const comment = e.target.elements.comment.value.trim();
      btn.disabled = true;
      msg.textContent = '';
      try {
        await API.rpc('submit_review', { p_token: token, p_rating: rating, p_comment: comment });
        order.review = { rating, comment };
        body.innerHTML = trackHTML(order);
      } catch (err) {
        console.error(err);
        msg.textContent = orderError(err);
        btn.disabled = false;
      }
    });

    sheet.addEventListener('click', e => {
      const star = e.target.closest('[data-star]');
      if (star) {
        rating = Number(star.dataset.star);
        sheet.querySelectorAll('[data-star]').forEach(b => {
          b.classList.toggle('on', Number(b.dataset.star) <= rating);
          b.setAttribute('aria-pressed', String(Number(b.dataset.star) === rating));
        });
        $('#rateMsg', sheet).textContent = '';
        return;
      }
      if (e.target.closest('[data-reorder]') && order) reorder(order);
      else if (e.target.closest('[data-all-orders]')) openOrders();
    });
  }

  function openOrders() {
    const tokens = ls.get(ORDERS_KEY, []);
    let timer = null;
    let list = [];
    const sheet = openSheet('<div id="ordersBody"></div>', { tall: true, label: 'طلباتي', onClose: () => clearTimeout(timer) });
    const head = `<div class="sheet-head"><div><h2>طلباتي</h2><p class="muted-line" style="margin:0">كل طلباتك محفوظة هون</p></div><button class="close" aria-label="إغلاق">×</button></div>`;
    const body = $('#ordersBody', sheet);

    if (!tokens.length) {
      body.innerHTML = `${head}<div class="empty"><b>لسا ما عندك طلبات</b>لما تطلب، بيطلع طلبك هون.</div><button class="btn ghost" data-close>تصفّح الأصناف</button>`;
      return;
    }
    body.innerHTML = `${head}<div class="empty">لحظة...</div>`;

    function render() {
      const now = list.filter(o => ACTIVE.includes(o.status));
      const old = list.filter(o => !ACTIVE.includes(o.status));
      body.innerHTML = head + now.map(o => {
        const cur = stepIndex(o);
        return `
          <div class="o-card now">
            <div class="o-line"><b dir="ltr">#${escapeHTML(o.code)}</b>${chipHTML(o.status)}</div>
            <div class="o-bar">${TRACK.map((s, i) => `<i class="${i <= cur ? 'on' : ''}"></i>`).join('')}</div>
            <div class="o-bar-l">${TRACK.map((s, i) => `<span class="${i <= cur ? 'on' : ''}">${s.short}</span>`).join('')}</div>
            <p class="o-meta">${deliveryLine(o)}</p>
            <button class="btn" data-track="${escapeHTML(o.token)}">تابع الطلب</button>
          </div>`;
      }).join('') + (old.length ? `<h3 class="sheet-sub" style="margin-top:18px">طلبات سابقة</h3>` : '') + old.map(o => `
        <div class="o-card">
          <div class="o-line">
            <div><b>${escapeHTML(orderTitle(o))}</b><small>${shortDay(o.created_at)}</small></div>
            ${chipHTML(o.status)}
          </div>
          <div class="o-line" style="margin-top:8px">${thumbs(o)}<span class="price">${formatPrice(o.total)}</span></div>
          ${o.status !== 'delivered' ? '' : o.review
            ? `<div class="o-line" style="margin-top:8px">${starsText(o.review.rating)}<button class="link-btn" data-track="${escapeHTML(o.token)}">التفاصيل</button></div>`
            : `<button class="btn" data-track="${escapeHTML(o.token)}">قيّم طلبك</button>`}
          <button class="btn ghost" data-again="${escapeHTML(o.token)}">اطلب نفسه مرة تانية</button>
        </div>`).join('');
    }

    async function load() {
      try {
        list = await API.rpc('get_orders', { p_tokens: tokens });
        if (!body.isConnected) return;
        render();
        if (list.some(o => ACTIVE.includes(o.status))) timer = setTimeout(load, 30000);
      } catch (err) {
        console.error(err);
        if (!list.length) body.innerHTML = `${head}<div class="empty"><b>ما قدرنا نجيب طلباتك</b>شيّك عالنت، طلباتك محفوظة.</div>`;
      }
    }
    load();

    sheet.addEventListener('click', e => {
      const t = e.target.closest('[data-track]');
      if (t) { openOrder(t.dataset.track); return; }
      const a = e.target.closest('[data-again]');
      if (a) reorder(list.find(o => o.token === a.dataset.again));
    });
  }

  // إعادة الطلب: بالأسعار الحالية، والصنف اللي خلص بينشال
  function reorder(o) {
    let added = 0;
    o.items.forEach(i => {
      const p = i.product_id ? findProduct(i.product_id) : null;
      if (!canOrder(p)) return;
      addToCart(p.id, Math.max(Number(i.qty), minQty(p.unit)), i.note || '');
      added++;
    });
    if (!added) { toast('أصناف هالطلب مو متوفرة هلق'); return; }
    openCart();
    if (added < o.items.length) toast('في أصناف ما عادت متوفرة، ضفنا الباقي');
  }

  /* ---------- القصص ---------- */
  let storyState = null;   // { g, i, timer, el }

  function openStory(g) {
    if (history.state && history.state.overlay) history.replaceState({ overlay: 'story' }, '');
    else history.pushState({ overlay: 'story' }, '');
    const el = document.createElement('div');
    el.className = 'story-view';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    document.body.appendChild(el);
    document.body.style.overflow = 'hidden';
    storyState = { g, i: 0, timer: null, el };
    el.addEventListener('click', e => {
      if (e.target.closest('.s-close')) closeStory();
      else if (e.target.closest('.tap.next')) showStory(storyState.g, storyState.i + 1);
      else if (e.target.closest('.tap.prev')) showStory(storyState.g, storyState.i - 1);
      else if (e.target.closest('[data-order]')) {
        const id = e.target.closest('[data-order]').dataset.order;
        closeStoryDom();
        openProduct(id);
      }
    });
    showStory(g, 0);
  }

  function showStory(g, i) {
    if (!storyState) return;
    clearTimeout(storyState.timer);
    if (i >= stories[g].story_items.length) { g++; i = 0; }
    if (i < 0) { if (g > 0) { g--; i = stories[g].story_items.length - 1; } else i = 0; }
    if (g >= stories.length) { closeStory(); return; }

    const s = stories[g];
    const item = s.story_items[i];
    const seen = ls.get(SEEN_KEY, []);
    if (!seen.includes(s.id)) { seen.push(s.id); ls.set(SEEN_KEY, seen); }
    storyState.g = g;
    storyState.i = i;
    const p = item.product_id ? findProduct(item.product_id) : null;
    const orderable = canOrder(p);
    storyState.el.setAttribute('aria-label', s.title);
    storyState.el.innerHTML = `
      <div class="bars">${s.story_items.map((_, k) => `<i class="${k < i ? 'done' : k === i ? 'run' : ''}"><b></b></i>`).join('')}</div>
      <div class="s-head">
        <div><img src="img/logo-mark.png" alt=""><span>${escapeHTML(s.title)}</span></div>
        <button class="s-close" aria-label="إغلاق">×</button>
      </div>
      <div class="s-img">
        <img src="${escapeHTML(item.image)}" alt="${orderable ? escapeHTML(p.name) : ''}">
        <button class="tap prev" aria-label="السابق"></button>
        <button class="tap next" aria-label="التالي"></button>
      </div>
      <div class="s-foot">${orderable ? `<button class="btn" data-order="${p.id}">اطلب ${escapeHTML(p.name)}</button>` : ''}</div>`;
    storyState.timer = setTimeout(() => showStory(storyState.g, storyState.i + 1), 4500);
  }

  function closeStoryDom() {
    if (!storyState) return;
    clearTimeout(storyState.timer);
    storyState.el.remove();
    storyState = null;
    document.body.style.overflow = current ? 'hidden' : '';
    renderStories();
  }
  function closeStory() {
    if (!storyState) return;
    if (history.state && history.state.overlay) history.back();
    else closeStoryDom();
  }

  /* ---------- تثبيت التطبيق ---------- */
  let deferredPrompt = null;
  const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function maybeShowInstall() {
    if (isStandalone || ls.get(INSTALL_KEY, false)) return;
    if (deferredPrompt || isIOS) $('#installBar').hidden = false;
  }

  function openIOSInstall() {
    openSheet(`
      <div class="sheet-head"><h2>ثبّت التطبيق على الآيفون</h2><button class="close" aria-label="إغلاق">×</button></div>
      <ol class="steps">
        <li><span class="n">1</span><span>افتح هالرابط من Safari، واضغط زر المشاركة ${ICON.share} تحت</span></li>
        <li><span class="n">2</span><span>اختار «إضافة إلى الشاشة الرئيسية» ${ICON.addSquare}</span></li>
        <li><span class="n">3</span><span>اضغط «إضافة» فوق، وبيطلع تطبيق ضيافتي على شاشتك</span></li>
      </ol>
      <button class="btn" data-close>تمام</button>
    `, { label: 'تثبيت التطبيق' });
  }

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    maybeShowInstall();
  });
  window.addEventListener('appinstalled', () => {
    $('#installBar').hidden = true;
    toast('انضاف تطبيق ضيافتي لشاشتك');
  });

  /* ---------- الأحداث ---------- */
  function bind() {
    $('#chips').addEventListener('click', e => {
      const b = e.target.closest('[data-cat]');
      if (!b) return;
      activeCat = b.dataset.cat === 'all' ? 'all' : Number(b.dataset.cat);   // ids الأقسام أرقام، و dataset نص
      renderChips();
      renderGrid();
    });
    $('#search').addEventListener('input', e => { query = e.target.value; renderGrid(); });
    $('#grid').addEventListener('click', e => {
      const add = e.target.closest('[data-add]');
      if (add) {
        const p = findProduct(add.dataset.add);
        if (p.custom_note_label) { openProduct(p.id); return; }
        const q = Math.max(1, minQty(p.unit));
        addToCart(p.id, q);
        toast('انضاف ' + formatQty(q, p.unit) + ' ' + p.name + ' للسلة');
        return;
      }
      const card = e.target.closest('[data-open]');
      if (card) openProduct(card.dataset.open);
    });
    $('#stories').addEventListener('click', e => {
      const b = e.target.closest('[data-story]');
      if (b) openStory(Number(b.dataset.story));
    });
    $('#cartBtn').addEventListener('click', openCart);
    $('#cartBar').addEventListener('click', openCart);
    $('#ordersBtn').addEventListener('click', openOrders);
    $('#grid').addEventListener('click', e => { if (e.target.closest('#retry')) { e.stopPropagation(); refreshCatalog(); } }, true);

    $('#installBtn').addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const r = await deferredPrompt.userChoice;
        deferredPrompt = null;
        if (r.outcome === 'accepted') $('#installBar').hidden = true;
      } else if (isIOS) {
        openIOSInstall();
      }
    });
    $('#installClose').addEventListener('click', () => {
      $('#installBar').hidden = true;
      ls.set(INSTALL_KEY, true);
    });

    // لما يرجع الزبون عالتطبيق، منجيب آخر تعديلات اللوحة (مو أكتر من مرة بالدقيقة)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && Date.now() - lastFetch > 60000) refreshCatalog();
    });
  }

  /* ---------- البداية ---------- */
  if (history.state && history.state.overlay) history.replaceState(null, '');
  // أول شي النسخة المحفوظة (إذا في)، وبعدين من النت
  const cached = ls.get(CATALOG_KEY, null);
  if (cached) { applyCatalog(cached); cleanCart(); }
  renderAll();
  if (!cached) $('#grid').innerHTML = '<div class="empty" style="grid-column:1/-1">لحظة، عم نجيب الأصناف...</div>';
  bind();
  refreshCatalog();
  maybeShowInstall();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
