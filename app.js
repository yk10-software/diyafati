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
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    whats: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.5-.3Z"/></svg>',
    cash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>',
    addSquare: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8.5v7M8.5 12h7"/></svg>',
  };

  /* ---------- الحالة ---------- */
  let products = Store.load();
  let cart = ls.get(CART_KEY, []);           // [{ id, qty, note }]
  let activeCat = 'all';
  let query = '';

  const findProduct = id => products.find(p => p.id === id);
  const visibleProducts = () => products.filter(p => p.available !== false);
  const catName = id => (CATEGORIES.find(c => c.id === id) || {}).name || '';

  function cleanCart() {
    cart = cart.filter(l => { const p = findProduct(l.id); return p && p.available !== false; });
  }
  function saveCart() { ls.set(CART_KEY, cart); updateCartUI(); }
  function cartTotal() {
    return cart.reduce((sum, l) => { const p = findProduct(l.id); return p ? sum + p.price * l.qty : sum; }, 0);
  }
  function countLabel(n) {
    if (n === 1) return 'صنف واحد';
    if (n === 2) return 'صنفين';
    if (n <= 10) return n + ' أصناف';
    return n + ' صنف';
  }

  /* ---------- العرض ---------- */
  function renderChips() {
    $('#chips').innerHTML = CATEGORIES.map(c => `
      <button class="chip" data-cat="${c.id}" aria-pressed="${c.id === activeCat}">
        ${escapeHTML(c.name)}${c.soon ? '<small>قريباً</small>' : ''}
      </button>`).join('');
  }

  function renderGrid() {
    let list = visibleProducts();
    if (activeCat !== 'all') list = list.filter(p => p.cat === activeCat);
    if (query) {
      const q = normalizeAr(query);
      list = list.filter(p => normalizeAr(p.name + ' ' + (p.desc || '')).includes(q));
    }
    const grid = $('#grid');
    if (!list.length) {
      const cat = CATEGORIES.find(c => c.id === activeCat);
      grid.innerHTML = (cat && cat.soon && !query)
        ? `<div class="empty" style="grid-column:1/-1"><b>${escapeHTML(cat.name)}</b>رح تنضاف أصناف هالقسم قريباً.</div>`
        : `<div class="empty" style="grid-column:1/-1"><b>ما في نتائج</b>جرّب كلمة تانية أو اختار قسم تاني.</div>`;
      return;
    }
    grid.innerHTML = list.map(p => `
      <article class="card" data-open="${p.id}">
        <div class="photo">
          <img src="${escapeHTML(p.images[0] || '')}" alt="" loading="lazy">
          <button class="add" data-add="${p.id}" aria-label="أضف ${escapeHTML(p.name)} للسلة">${ICON.plus}</button>
        </div>
        <h3><button class="name-btn" data-open="${p.id}">${escapeHTML(p.name)}</button></h3>
        <p class="price">${formatPrice(p.price)} <small>/ ${escapeHTML(p.unit)}</small></p>
      </article>`).join('');
  }

  function renderStories() {
    const seen = ls.get(SEEN_KEY, []);
    $('#stories').innerHTML = STORIES.map((s, i) => `
      <button class="story${seen.includes(s.id) ? ' seen' : ''}" data-story="${i}">
        <div class="frame"><img src="${s.items[0].img}" alt=""></div>
        <span>${escapeHTML(s.title)}</span>
      </button>`).join('');
  }

  function updateCartUI() {
    const n = cart.length;
    const badge = $('#cartCount');
    badge.textContent = n;
    badge.hidden = n === 0;
    $('#cartBar').hidden = n === 0;
    $('#cartBarCount').textContent = 'السلة (' + countLabel(n) + ')';
    $('#cartBarTotal').textContent = formatPrice(cartTotal());
  }

  function renderAll() {
    renderChips();
    renderGrid();
    renderStories();
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

  function openSheet(html, opts = {}) {
    document.querySelectorAll('.toast').forEach(t => t.remove());
    if (current) {
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
    const sheet = ov.firstElementChild;
    sheet.addEventListener('click', e => { if (e.target.closest('.close, [data-close]')) closeSheet(); });
    if (opts.onMount) opts.onMount(sheet);
    const f = sheet.querySelector('.close');
    if (f) f.focus({ preventScroll: true });
    return sheet;
  }
  function removeSheet() {
    if (!current) return;
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
  function stepperHTML(qty, unit, small) {
    const step = qtyStep(unit);
    return `
      <div class="stepper${small ? ' small' : ''}">
        <button type="button" data-step="1" aria-label="زيادة">+</button>
        <output>${formatQty(qty, unit)}</output>
        <button type="button" data-step="-1" aria-label="تنقيص" ${qty <= step ? 'disabled' : ''}>−</button>
      </div>`;
  }

  function openProduct(id) {
    const p = findProduct(id);
    if (!p) return;
    let qty = 1;
    const imgs = p.images.length ? p.images : [''];

    const sheet = openSheet(`
      <div class="sheet-head">
        <span class="price"><small>${escapeHTML(catName(p.cat))}</small></span>
        <button class="close" aria-label="إغلاق">×</button>
      </div>
      <div class="gallery" id="gal">${imgs.map(src => `<img src="${escapeHTML(src)}" alt="${escapeHTML(p.name)}">`).join('')}</div>
      ${imgs.length > 1 ? `<div class="dots">${imgs.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>` : ''}
      <h2 class="p-name">${escapeHTML(p.name)}</h2>
      <p class="price">${formatPrice(p.price)} <small>/ ${escapeHTML(p.unit)}</small></p>
      ${p.desc ? `<p class="p-desc">${escapeHTML(p.desc)}</p>` : ''}
      ${p.customNote ? `
        <label class="field" style="margin-top:18px">
          <span>${escapeHTML(p.customNote)}</span>
          <input id="pNote" maxlength="120" placeholder="مثلاً: أهلاً بـ «جود» ٢٠٢٦">
        </label>` : ''}
      <div class="buy">
        <div class="buy-row">
          <div id="qtyBox" aria-label="الكمية">${stepperHTML(qty, p.unit)}</div>
          <b class="buy-total" id="pTotal" aria-live="polite">${formatPrice(p.price * qty)}</b>
        </div>
        <button class="btn" id="pAdd">أضف للسلة</button>
      </div>
    `, { label: p.name });

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
      const step = qtyStep(p.unit);
      qty = Math.min(100, Math.max(step, qty + step * Number(b.dataset.step)));
      $('#qtyBox', sheet).innerHTML = stepperHTML(qty, p.unit);
      $('#pTotal', sheet).textContent = formatPrice(p.price * qty);
    });

    $('#pAdd', sheet).addEventListener('click', () => {
      const note = p.customNote ? $('#pNote', sheet).value.trim() : '';
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
        const step = qtyStep(p.unit);
        l.qty = Math.min(100, Math.max(step, l.qty + step * Number(stepBtn.dataset.step)));
        saveCart(); renderCartInto(sheet);
      } else if (rm) {
        cart.splice(Number(rm.dataset.remove), 1);
        saveCart(); renderCartInto(sheet);
      } else if (e.target.closest('#toCheckout')) {
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
            <img src="${escapeHTML(p.images[0] || '')}" alt="">
            <div>
              <h4>${escapeHTML(p.name)}</h4>
              ${l.note ? `<p class="note">${escapeHTML(l.note)}</p>` : ''}
              <div class="ctrl">
                ${stepperHTML(l.qty, p.unit, true)}
                <button class="link-btn" data-remove="${i}">إزالة</button>
              </div>
            </div>
            <span class="sum">${formatPrice(p.price * l.qty)}</span>
          </div>`;
      }).join('')}
      <div class="totals"><span>المجموع</span><b>${formatPrice(cartTotal())}</b></div>
      <button class="btn" id="toCheckout">متابعة الطلب</button>`;
  }

  /* ---------- تفاصيل الطلب ---------- */
  function todayISO() {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
  function formatDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('ar-SY-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  function formatTime(hm) {
    let [h, m] = hm.split(':').map(Number);
    const period = h < 12 ? 'صباحاً' : 'مساءً';
    h = h % 12 || 12;
    return h + ':' + String(m).padStart(2, '0') + ' ' + period;
  }

  function openCheckout() {
    const c = ls.get(CUSTOMER_KEY, {});
    let mode = 'asap';
    const sheet = openSheet(`
      <div class="sheet-head"><h2>تفاصيل الطلب</h2><button class="close" aria-label="إغلاق">×</button></div>
      <form id="orderForm" novalidate>
        <label class="field" data-f="name">
          <span>الاسم</span>
          <input name="name" autocomplete="name" value="${escapeHTML(c.name)}">
          <span class="err">اكتب اسمك.</span>
        </label>
        <label class="field" data-f="phone">
          <span>رقم الموبايل</span>
          <input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="09xxxxxxxx" value="${escapeHTML(c.phone)}">
          <span class="err">اكتب رقم موبايل صحيح.</span>
        </label>
        <label class="field" data-f="address">
          <span>عنوان التوصيل</span>
          <textarea name="address" rows="2" placeholder="المنطقة، الشارع، أقرب معلم">${escapeHTML(c.address)}</textarea>
          <span class="err">اكتب العنوان لحتى يوصلك الطلب.</span>
        </label>

        <div class="field"><span>وقت التوصيل</span></div>
        <div class="seg" role="group" aria-label="وقت التوصيل">
          <button type="button" data-mode="asap" aria-pressed="true">بأقرب وقت</button>
          <button type="button" data-mode="scheduled" aria-pressed="false">بموعد محدد</button>
        </div>
        <div class="two" id="when" hidden>
          <label class="field" data-f="date">
            <span>اليوم</span>
            <input name="date" type="date" min="${todayISO()}">
            <span class="err">اختار اليوم.</span>
          </label>
          <label class="field" data-f="time">
            <span>الساعة</span>
            <input name="time" type="time">
            <span class="err">اختار الساعة.</span>
          </label>
        </div>

        <label class="field">
          <span>ملاحظات <small>(اختياري)</small></span>
          <textarea name="notes" rows="2" placeholder="مثلاً: نوع المناسبة، لون التغليف"></textarea>
        </label>

        <div class="paybox">${ICON.cash}<p><b>الدفع كاش عند الاستلام</b><br><small>المجموع ${formatPrice(cartTotal())}، ${countLabel(cart.length)}</small></p></div>

        <button class="btn whats" type="submit">${ICON.whats} أرسل الطلب عبر واتساب</button>
        <p class="hint">رح ينفتح واتساب والطلب مكتوب جاهز، بس اضغط إرسال.</p>
      </form>
    `, { tall: true, label: 'تفاصيل الطلب' });

    const form = $('#orderForm', sheet);
    sheet.querySelector('.seg').addEventListener('click', e => {
      const b = e.target.closest('[data-mode]');
      if (!b) return;
      mode = b.dataset.mode;
      sheet.querySelectorAll('.seg button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      $('#when', sheet).hidden = mode !== 'scheduled';
    });
    form.addEventListener('input', e => {
      const f = e.target.closest('.field');
      if (f) f.classList.remove('invalid');
    });
    form.addEventListener('submit', e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      Object.keys(data).forEach(k => { data[k] = String(data[k]).trim(); });
      const bad = [];
      if (!data.name) bad.push('name');
      if (data.phone.replace(/\D/g, '').length < 9) bad.push('phone');
      if (!data.address) bad.push('address');
      if (mode === 'scheduled') {
        if (!data.date) bad.push('date');
        if (!data.time) bad.push('time');
      }
      sheet.querySelectorAll('.field[data-f]').forEach(f => f.classList.toggle('invalid', bad.includes(f.dataset.f)));
      if (bad.length) {
        const first = sheet.querySelector('.field.invalid input, .field.invalid textarea');
        if (first) first.focus();
        return;
      }
      ls.set(CUSTOMER_KEY, { name: data.name, phone: data.phone, address: data.address });
      sendOrder(data, mode);
    });
  }

  function buildMessage(d, mode, orderId) {
    const L = [];
    L.push(`*طلب جديد من تطبيق ${CONFIG.shopName}*${CONFIG.demo ? ' (تجريبي)' : ''}`);
    L.push(`رقم الطلب: #${orderId}`);
    L.push('');
    L.push('*الأصناف:*');
    cart.forEach(l => {
      const p = findProduct(l.id);
      L.push(`- ${p.name}: ${formatQty(l.qty, p.unit)} = ${formatPrice(p.price * l.qty)}`);
      if (l.note) L.push(`  ملاحظة: ${l.note}`);
    });
    L.push('');
    L.push(`*المجموع: ${formatPrice(cartTotal())}*`);
    L.push('');
    L.push(`الاسم: ${d.name}`);
    L.push(`الموبايل: ${d.phone}`);
    L.push(`العنوان: ${d.address}`);
    L.push(`الموعد: ${mode === 'scheduled' ? formatDate(d.date) + '، الساعة ' + formatTime(d.time) : 'بأقرب وقت'}`);
    if (d.notes) L.push(`ملاحظات: ${d.notes}`);
    L.push('الدفع: كاش عند الاستلام');
    return L.join('\n');
  }

  function sendOrder(d, mode) {
    const orderId = 'D' + String(Date.now()).slice(-5);
    const url = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(buildMessage(d, mode, orderId))}`;
    const win = window.open(url, '_blank', 'noopener');
    if (!win) window.location.href = url;
    cart = [];
    saveCart();
    openSheet(`
      <div class="center">
        <div class="done-mark">${ICON.check}</div>
        <h2 class="p-name" style="margin-top:8px">طلبك جاهز بواتساب</h2>
        <p class="p-desc">اضغط إرسال بواتساب لحتى يوصلنا الطلب رقم <b><bdi dir="ltr">#${orderId}</bdi></b>، ومنتواصل معك للتأكيد.</p>
        <p class="hint" style="margin-bottom:18px">إذا ما انفتح واتساب، <a href="${url}" target="_blank" rel="noopener">اضغط هون</a>.</p>
        <button class="btn" data-close>تم</button>
      </div>`, { label: 'تم تجهيز الطلب' });
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
    if (i >= STORIES[g].items.length) { g++; i = 0; }
    if (i < 0) { if (g > 0) { g--; i = STORIES[g].items.length - 1; } else i = 0; }
    if (g >= STORIES.length) { closeStory(); return; }

    const s = STORIES[g];
    const item = s.items[i];
    const seen = ls.get(SEEN_KEY, []);
    if (!seen.includes(s.id)) { seen.push(s.id); ls.set(SEEN_KEY, seen); }
    storyState.g = g;
    storyState.i = i;
    const p = findProduct(item.product);
    const canOrder = p && p.available !== false;
    storyState.el.setAttribute('aria-label', s.title);
    storyState.el.innerHTML = `
      <div class="bars">${s.items.map((_, k) => `<i class="${k < i ? 'done' : k === i ? 'run' : ''}"><b></b></i>`).join('')}</div>
      <div class="s-head">
        <div><img src="img/logo-mark.png" alt=""><span>${escapeHTML(s.title)}</span></div>
        <button class="s-close" aria-label="إغلاق">×</button>
      </div>
      <div class="s-img">
        <img src="${escapeHTML(item.img)}" alt="${canOrder ? escapeHTML(p.name) : ''}">
        <button class="tap prev" aria-label="السابق"></button>
        <button class="tap next" aria-label="التالي"></button>
      </div>
      <div class="s-foot">${canOrder ? `<button class="btn" data-order="${p.id}">اطلب ${escapeHTML(p.name)}</button>` : ''}</div>`;
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
      activeCat = b.dataset.cat;
      renderChips();
      renderGrid();
    });
    $('#search').addEventListener('input', e => { query = e.target.value; renderGrid(); });
    $('#grid').addEventListener('click', e => {
      const add = e.target.closest('[data-add]');
      if (add) {
        const p = findProduct(add.dataset.add);
        if (p.customNote) { openProduct(p.id); return; }
        addToCart(p.id, 1);
        toast('انضاف ' + formatQty(1, p.unit) + ' ' + p.name + ' للسلة');
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

    // إذا انعدّل شي من لوحة التحكم، بيتحدّث التطبيق لحاله
    const refresh = () => { products = Store.load(); cleanCart(); saveCart(); renderAll(); };
    window.addEventListener('storage', e => { if (e.key === PRODUCTS_KEY) refresh(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  }

  /* ---------- البداية ---------- */
  if (demoExpired()) { showDemoExpired(); return; }
  addDemoStrip();
  if (history.state && history.state.overlay) history.replaceState(null, '');
  $('#waLink').href = `https://wa.me/${CONFIG.whatsapp}`;
  if (!CONFIG.demo) {
    $('#credit').innerHTML = 'تصميم وتطوير <a href="https://yk10-software.netlify.app" target="_blank" rel="noopener">YK10 Software</a>';
  }
  cleanCart();
  renderAll();
  bind();
  maybeShowInstall();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
