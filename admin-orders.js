/* =========================================================
   ضيافتي — لوحة التحكم: شاشة الطلبات
   الطلبات حسب الحالة، وتفاصيل كل طلب، وتغيير الحالة:
   جديد ← قيد التحضير ← بالطريق ← تم التسليم.
   الطلب الجديد بيوصل لحاله وهي مفتوحة (realtime).
   ========================================================= */
(() => {
  'use strict';

  const { $, $$, state, icon, db, fail, toast } = A;
  const TZ = 'Asia/Damascus';
  const SELECT = '*, order_items(*)';

  const STATUS = {
    new:       { label: 'جديد', cls: 'st-new' },
    preparing: { label: 'قيد التحضير', cls: 'st-prep' },
    on_way:    { label: 'بالطريق', cls: 'st-way' },
    delivered: { label: 'تم التسليم', cls: 'st-done' },
    cancelled: { label: 'ملغي', cls: 'st-off' },
  };
  const STEPS = ['new', 'preparing', 'on_way', 'delivered'];
  // الزر الكبير: شو الخطوة الجاية من كل حالة
  const NEXT = {
    new:       { to: 'preparing', text: 'قبول الطلب وبدء التحضير' },
    preparing: { to: 'on_way', text: 'الطلب طلع بالطريق' },
    on_way:    { to: 'delivered', text: 'تم التسليم' },
  };
  const TABS = [
    { id: 'new', label: 'جديدة', has: s => s === 'new' },
    { id: 'preparing', label: 'قيد التحضير', has: s => s === 'preparing' },
    { id: 'on_way', label: 'بالطريق', has: s => s === 'on_way' },
    { id: 'done', label: 'تم', has: s => s === 'delivered' || s === 'cancelled' },
  ];
  const PAY = { cash: 'كاش عند الاستلام', shamcash: 'شام كاش', bank: 'تحويل بنكي' };

  let tab = 'new';

  const when = iso => new Date(iso).toLocaleDateString('ar-SY-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });
  const clock = iso => new Date(iso).toLocaleTimeString('ar-SY-u-nu-latn', { hour: 'numeric', minute: '2-digit', timeZone: TZ });
  const delivery = o => o.delivery_mode === 'scheduled' ? `${when(o.scheduled_at)}، ${clock(o.scheduled_at)}` : 'بأقرب وقت';
  const chip = s => `<span class="st-chip ${STATUS[s].cls}">${STATUS[s].label}</span>`;
  const items = o => A.countAr(o.order_items.length, 'صنف واحد', 'صنفين', 'أصناف');
  const payShort = o => PAY[o.payment_method] || '';

  // رقم الزبون لرابط واتساب: 0944... ← 963944...
  function waNumber(phone) {
    let d = String(phone).replace(/\D/g, '');
    if (d.startsWith('00')) d = d.slice(2);
    else if (d.startsWith('09')) d = '963' + d.slice(1);
    return d;
  }

  function updateBadge() {
    const n = state.orders.filter(o => o.status === 'new').length;
    const dot = $('#navNew');
    dot.textContent = n;
    dot.hidden = n === 0;
  }

  A.views.orders = {
    title: 'الطلبات',
    sub() {
      const n = state.orders.filter(o => o.status === 'new').length;
      return n ? `${A.countAr(n, 'طلب جديد', 'طلبين جداد', 'طلبات جديدة')} بانتظارك` : 'كل طلب بينحفظ هون وبيوصلك عالواتس';
    },
    render(el) {
      el.innerHTML = `<div class="chips" id="oTabs"></div><div class="p-pad" id="oList" style="padding-top:0"></div>`;
      $('#oTabs', el).addEventListener('click', e => {
        const b = e.target.closest('[data-tab]');
        if (b) { tab = b.dataset.tab; renderList(); }
      });
      $('#oList', el).addEventListener('click', e => {
        const c = e.target.closest('[data-order]');
        if (c) openOrder(c.dataset.order);
      });
      renderList();
    },
  };

  function renderList() {
    const tabs = $('#oTabs');
    if (!tabs) return;
    tabs.innerHTML = TABS.map(t => {
      const n = state.orders.filter(o => t.has(o.status)).length;
      return `<button class="chip" data-tab="${t.id}" aria-pressed="${t.id === tab}">${t.label}${n ? `<small>${n}</small>` : ''}</button>`;
    }).join('');

    const list = state.orders.filter(o => TABS.find(t => t.id === tab).has(o.status));
    $('#oList').innerHTML = list.length ? list.map(o => `
      <button class="a-card o-row" type="button" data-order="${o.id}">
        <span class="top"><b dir="ltr">#${escapeHTML(o.code)}</b>${chip(o.status)}</span>
        <span class="nm">${escapeHTML(o.customer_name)}</span>
        <span class="ln">${delivery(o)}</span>
        <span class="ln">${escapeHTML(o.zone_name)}</span>
        <span class="bot"><span class="ln">${items(o)}، ${payShort(o)}</span><span class="price">${formatPrice(o.total)}</span></span>
      </button>`).join('')
      : '<div class="empty"><b>ما في طلبات هون</b>الطلبات الجديدة بتطلع لحالها.</div>';
  }

  /* ---------- تفاصيل الطلب ---------- */
  function stepsHTML(o) {
    const cur = STEPS.indexOf(o.status);
    return `<div class="o-steps" style="--done:${Math.max(cur, 0)}">${STEPS.map((s, i) => `
      <div class="${i < cur || o.status === 'delivered' ? 'done' : i === cur ? 'cur' : ''}">
        <i>${i < cur || o.status === 'delivered' ? '✓' : i + 1}</i>${STATUS[s].label}
      </div>`).join('')}</div>`;
  }

  function openOrder(id) {
    const o = state.orders.find(x => x.id === id);
    if (!o) return;
    const next = NEXT[o.status];
    const fee = o.delivery_fee == null ? 'حسب الاتفاق' : formatPrice(o.delivery_fee);
    const sheet = A.openSheet(`
      <div class="sheet-head">
        <div><h2>طلب <bdi dir="ltr">#${escapeHTML(o.code)}</bdi></h2><p class="muted-line" style="margin:0">وصل ${when(o.created_at)}، ${clock(o.created_at)}</p></div>
        <button class="close" aria-label="إغلاق">×</button>
      </div>
      ${o.status === 'cancelled' ? `<p class="center">${chip('cancelled')}</p>` : stepsHTML(o)}

      <div class="a-card o-cust">
        <div class="who"><b>${escapeHTML(o.customer_name)}</b><span dir="ltr">${escapeHTML(o.phone)}</span></div>
        <a class="circle c-call" href="tel:${escapeHTML(o.phone)}" aria-label="اتصال">${icon('phone')}</a>
        <a class="circle c-wa" href="https://wa.me/${waNumber(o.phone)}" target="_blank" rel="noopener" aria-label="واتساب">${icon('wa')}</a>
      </div>

      <div class="a-card o-kv">
        <p>${icon('pin')}<span>${escapeHTML(o.zone_name)}، ${escapeHTML(o.address)}</span></p>
        <p>${icon('cal')}<span>${delivery(o)}</span></p>
        <p>${icon('cash')}<span>${escapeHTML(o.payment_label || payShort(o))}</span></p>
        ${o.notes ? `<p class="o-note">${escapeHTML(o.notes)}</p>` : ''}
      </div>

      <div class="a-card">
        ${o.order_items.map(i => `
          <div class="o-item">
            ${A.thumb(i.image)}
            <div><b>${escapeHTML(i.name)}</b><span>${formatQty(Number(i.qty), i.unit)}</span></div>
            <span class="price">${formatPrice(i.line_total)}</span>
          </div>
          ${i.note ? `<p class="o-note">نص الطباعة: ${escapeHTML(i.note)}</p>` : ''}`).join('')}
        <div class="o-sum"><span>المجموع الفرعي</span><span>${formatPrice(o.subtotal)}</span></div>
        ${o.discount ? `<div class="o-sum"><span>خصم ${escapeHTML(o.coupon_code || '')}</span><span>−${formatPrice(o.discount)}</span></div>` : ''}
        <div class="o-sum"><span>التوصيل</span><span>${fee}</span></div>
        <div class="o-sum total"><b>المجموع</b><span class="price">${formatPrice(o.total)}</span></div>
      </div>

      ${next ? `<button class="btn" id="oNext" style="margin-top:14px">${next.text}</button>` : ''}
      ${next ? '<button class="btn danger" id="oCancel" style="margin-top:10px">إلغاء الطلب</button>' : ''}
    `);

    if (!next) return;
    $('#oNext', sheet).addEventListener('click', e => { e.target.disabled = true; setStatus(o, next.to); });
    A.confirmTwice($('#oCancel', sheet), 'اضغط مرة تانية لتأكيد الإلغاء', () => setStatus(o, 'cancelled'));
  }

  async function setStatus(o, status) {
    try {
      const saved = await db(sb.from('orders').update({ status }).eq('id', o.id).select(SELECT).single());
      replace(saved);
      A.closeSheet();
      toast(`#${saved.code}: ${STATUS[status].label}`);
      refresh();
    } catch (err) {
      fail(err);
      openOrder(o.id);
    }
  }

  function replace(order) {
    const i = state.orders.findIndex(x => x.id === order.id);
    if (i >= 0) state.orders[i] = order; else state.orders.unshift(order);
  }
  function refresh() {
    updateBadge();
    const name = A.current();
    if (name === 'orders') { renderList(); A.refreshHead(); }
    if (name === 'home') A.views.home.render($('#view'));
  }

  // شاشة الرئيسية بتستعمل نفس الأدوات
  A.openOrder = openOrder;
  A.setOrderStatus = setStatus;
  A.orderLine = o => `${items(o)}، ${o.delivery_mode === 'scheduled'
    ? `بموعد ${new Date(o.scheduled_at).toLocaleDateString('ar-SY-u-nu-latn', { weekday: 'long', timeZone: TZ })} ${clock(o.scheduled_at)}`
    : 'بأقرب وقت'}`;

  /* ---------- realtime ---------- */
  async function loadOne(id) {
    return db(sb.from('orders').select(SELECT).eq('id', id).single());
  }

  // بتشتغل مرة وحدة بعد ما تفتح اللوحة
  A.ordersLive = () => {
    updateBadge();
    sb.channel('orders-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async ev => {
        try {
          if (ev.eventType === 'DELETE') {
            state.orders = state.orders.filter(o => o.id !== ev.old.id);
          } else {
            const fresh = await loadOne(ev.new.id);
            const isNew = !state.orders.some(o => o.id === fresh.id);
            replace(fresh);
            if (isNew) toast(`طلب جديد #${fresh.code}`);
          }
          refresh();
        } catch (err) { console.warn(err); }
      })
      .subscribe();

    // الموبايل بيسكّر الاتصال بالخلفية، فلما ترجع عاللوحة منجيب آخر الطلبات
    document.addEventListener('visibilitychange', async () => {
      if (document.hidden || !A.user) return;
      try { state.orders = await A.loadOrders(); refresh(); }
      catch (err) { console.warn(err); }
    });
  };
})();
