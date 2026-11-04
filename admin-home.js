/* =========================================================
   ضيافتي — لوحة التحكم: الرئيسية
   فتح وسكر المحل، وأرقام اليوم، والطلبات الجديدة بقبول بكبسة،
   والأكثر طلباً هالأسبوع. الأرقام كلها من آخر الطلبات المحمّلة
   باللوحة (A.loadOrders)، ولهيك بتتحدّث لحالها مع الـ realtime.
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

    view.innerHTML = `
      <div class="p-pad">
        <div class="a-card open-row">
          <p><b>المحل مفتوح للطلبات</b><span>بتسكّره بكبسة إذا بدك توقف الطلبات</span></p>
          <label class="switch"><input type="checkbox" id="hOpen" ${state.settings.shop_open ? 'checked' : ''} aria-label="المحل مفتوح للطلبات"><span></span></label>
        </div>

        <div class="stats">
          <div class="stat hero"><div class="v">${s.sales.toLocaleString('en-US')}</div><div class="l">مبيعات اليوم (${CONFIG.currency})</div></div>
          <div class="stat"><div class="v">${s.count}</div><div class="l">طلب اليوم</div></div>
          <div class="stat"><div class="v new">${s.fresh}</div><div class="l">طلبات جديدة</div></div>
          <div class="stat"><div class="v">${s.tomorrow}</div><div class="l">مواعيد بكرا</div></div>
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

    $('#hOpen', view).addEventListener('change', e => A.saveSettings({ shop_open: e.target.checked },
      e.target.checked ? 'المحل مفتوح، الطلبات رجعت' : 'المحل مسكّر، ما رح توصل طلبات', e.target));

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
