/* =========================================================
   ضيافتي — لوحة التحكم: الرئيسية
   حالة المحل والدوام أول شي، وبعدها أرقام اليوم، والكوبونات والتقييمات،
   والطلبات الجديدة بقبول بكبسة، والأكثر طلباً هالأسبوع. الأرقام من آخر
   الطلبات المحمّلة باللوحة (A.loadOrders)، ولهيك بتتحدّث لحالها مع الـ realtime.
   ========================================================= */
(() => {
  'use strict';

  const { $, state } = A;
  const TZ = 'Asia/Damascus';
  const DAY = 86400000;

  const dayKey = date => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date);
  const hourNow = () => Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  const live = o => o.status !== 'cancelled';

  // أرقام المربعات الأربعة
  function stats() {
    const now = new Date();
    const today = dayKey(now);
    const tomorrow = dayKey(new Date(now.getTime() + DAY));
    const todays = state.orders.filter(o => live(o) && dayKey(new Date(o.created_at)) === today);
    return {
      sales: todays.reduce((sum, o) => sum + Number(o.total), 0),
      count: todays.length,
      fresh: state.orders.filter(o => o.status === 'new').length,
      tomorrow: state.orders.filter(o => live(o) && o.scheduled_at && dayKey(new Date(o.scheduled_at)) === tomorrow).length,
    };
  }

  // أكتر 3 أصناف انطلبت آخر 7 أيام
  function topItems() {
    const since = Date.now() - 7 * DAY;
    const map = new Map();
    state.orders.filter(o => live(o) && new Date(o.created_at).getTime() > since).forEach(o => {
      o.order_items.forEach(i => {
        const key = i.product_id ?? i.name;
        const row = map.get(key) || { name: i.name, unit: i.unit, qty: 0 };
        row.qty += Number(i.qty);
        map.set(key, row);
      });
    });
    return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 3);
  }

  // عدد التقييمات اللي وصلت بعد آخر مرة انفتحت شاشتها عهالموبايل
  const newReviews = () => {
    const seen = A.reviewsSeenAt();
    return state.reviewStamps.filter(r => !seen || r.created_at > seen).length;
  };

  /* ---------- الدوام ---------- */
  const short = t => String(t).slice(0, 5);
  const clockOf = t => new Date(`2026-01-01T${short(t)}:00+03:00`)
    .toLocaleTimeString('ar-SY-u-nu-latn', { hour: 'numeric', minute: '2-digit', timeZone: TZ });
  const hoursText = (open, close) => `كل يوم من ${clockOf(open)} لـ ${clockOf(close)}`;

  function hourOptions(selected) {
    let out = '';
    for (let m = 0; m < 24 * 60; m += 30) {
      const t = String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
      out += `<option value="${t}" ${t === short(selected) ? 'selected' : ''}>${clockOf(t)}</option>`;
    }
    return out;
  }

  function openHours() {
    const s = state.settings;
    const sheet = A.openSheet(`
      <div class="sheet-head"><h2>دوام المحل</h2><button class="close" aria-label="إغلاق">×</button></div>
      <form id="hForm" novalidate>
        <div class="two">
          <label class="field"><span>بيفتح</span><select name="open">${hourOptions(s.open_time || '09:00')}</select></label>
          <label class="field" data-f="close"><span>بيسكّر</span><select name="close">${hourOptions(s.close_time || '22:00')}</select>
            <span class="err">لازم يكون بعد الفتح.</span></label>
        </div>
        <p class="caption" style="margin-top:-6px">الزبون بيختار موعد التوصيل ضمن هالساعات بس، كل نص ساعة.</p>
        <button class="btn" type="submit" style="margin-top:14px">حفظ</button>
      </form>
    `);
    const form = $('#hForm', sheet);
    const f = form.elements;
    form.addEventListener('change', () => form.querySelector('[data-f="close"]').classList.remove('invalid'));
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (f.close.value <= f.open.value) { form.querySelector('[data-f="close"]').classList.add('invalid'); return; }
      A.busy(form, true);
      const ok = await A.saveSettings({
        open_time: f.open.value, close_time: f.close.value, hours_label: hoursText(f.open.value, f.close.value),
      }, 'انحفظ الدوام');
      A.busy(form, false);
      if (ok) { A.closeSheet(); render($('#view')); }
    });
  }

  function newRow(o) {
    return `
      <div class="mini">
        <button class="who" type="button" data-open="${o.id}">
          <b>${escapeHTML(o.customer_name)}</b>
          <span>${A.orderLine(o)}</span>
        </button>
        <span class="price">${Number(o.total).toLocaleString('en-US')}</span>
        <button class="btn sm" type="button" data-accept="${o.id}">قبول</button>
      </div>`;
  }

  function render(view) {
    const s = stats();
    const fresh = state.orders.filter(o => o.status === 'new').slice(0, 3);
    const top = topItems();
    const max = top.length ? top[0].qty : 1;
    const open = state.settings.shop_open;
    const coupons = state.coupons.filter(A.couponRunning).length;
    const fresh2 = newReviews();

    view.innerHTML = `
      <div class="p-pad">
        <div class="a-card shop-card${open ? '' : ' closed'}">
          <div class="open-row">
            <p>
              <b>${open ? 'المحل مفتوح للطلبات' : 'المحل مسكّر'}</b>
              <span>${open ? 'بتسكّره بكبسة إذا بدك توقف الطلبات' : 'الزباين ما بيقدروا يطلبوا هلق'}</span>
            </p>
            <label class="switch"><input type="checkbox" id="hOpen" ${open ? 'checked' : ''} aria-label="المحل مفتوح للطلبات"><span></span></label>
          </div>
          <div class="srow">
            <div class="lbl"><b>دوام المحل</b><span>${hoursText(state.settings.open_time || '09:00', state.settings.close_time || '22:00')}</span></div>
            <button class="link-btn" type="button" id="hoursBtn">تغيير</button>
          </div>
        </div>

        <div class="stats">
          <div class="stat hero"><div class="v">${s.sales.toLocaleString('en-US')}</div><div class="l">مبيعات اليوم (${CONFIG.currency})</div></div>
          <div class="stat"><div class="v">${s.count}</div><div class="l">طلب اليوم</div></div>
          <div class="stat"><div class="v new">${s.fresh}</div><div class="l">طلبات جديدة</div></div>
          <div class="stat"><div class="v">${s.tomorrow}</div><div class="l">مواعيد بكرا</div></div>
        </div>

        <div class="h-links">
          <a class="stat h-link" href="#coupons">
            <b>الكوبونات</b>
            <span><i>${coupons}</i> ${coupons === 1 || !coupons ? 'شغّال' : 'شغّالين'}</span>
          </a>
          <a class="stat h-link${fresh2 ? ' has-new' : ''}" href="#reviews">
            <b>التقييمات</b>
            <span><i>${fresh2}</i> ${fresh2 > 1 ? 'جداد' : 'جديد'}</span>
          </a>
        </div>

        <div class="sec"><h2>طلبات جديدة</h2><a class="link-btn" href="#orders">عرض الكل</a></div>
        <div class="a-card" id="hNew">
          ${fresh.length ? fresh.map(newRow).join('') : '<p class="caption">ما في طلبات جديدة هلق.</p>'}
        </div>

        <div class="sec"><h2>الأكثر طلباً هالأسبوع</h2></div>
        <div class="a-card bars">
          ${top.length ? top.map(i => `
            <div class="row">
              <span>${escapeHTML(i.name)}</span><span class="q">${formatQty(i.qty, i.unit)}</span>
              <div class="track"><i style="width:${Math.max(4, Math.round(i.qty / max * 100))}%"></i></div>
            </div>`).join('') : '<p class="caption">لسا ما في طلبات هالأسبوع.</p>'}
        </div>
      </div>`;

    $('#hOpen', view).addEventListener('change', async e => {
      const ok = await A.saveSettings({ shop_open: e.target.checked },
        e.target.checked ? 'المحل مفتوح، الطلبات رجعت' : 'المحل مسكّر، ما رح توصل طلبات', e.target);
      if (ok) render(view);
    });
    $('#hoursBtn', view).addEventListener('click', openHours);

    $('#hNew', view).addEventListener('click', e => {
      const open = e.target.closest('[data-open]');
      if (open) return A.openOrder(open.dataset.open);
      const accept = e.target.closest('[data-accept]');
      if (!accept) return;
      accept.disabled = true;
      A.setOrderStatus(state.orders.find(o => o.id === accept.dataset.accept), 'preparing');
    });
  }

  A.views.home = {
    get title() { return hourNow() < 12 ? 'صباح الخير' : 'مسا الخير'; },
    sub: () => 'لوحة تحكم ضيافتي',
    render,
  };
})();
