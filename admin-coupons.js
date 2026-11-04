/* =========================================================
   ضيافتي — لوحة التحكم: شاشة الكوبونات
   بتفتح من الإعدادات. الحساب الحقيقي للخصم بـ place_order،
   وهون بس منضيف ومنعدّل ومنوقّف الأكواد.
   ========================================================= */
(() => {
  'use strict';

  const { $, state, db, fail, toast } = A;

  const valueText = c => c.kind === 'percent' ? `${c.value}%` : formatPrice(c.value);

  function statusOf(c) {
    if (c.expires_at && new Date(c.expires_at) < new Date()) return { text: 'انتهى', cls: 'st-off' };
    if (c.max_uses != null && c.used_count >= c.max_uses) return { text: 'خلص', cls: 'st-off' };
    if (!c.active) return { text: 'موقّف', cls: 'st-off' };
    return { text: 'شغّال', cls: 'st-done' };
  }

  function metaLine(c) {
    const out = [`انستعمل ${c.used_count}${c.max_uses != null ? ` من ${c.max_uses}` : ''}`];
    if (c.min_total) out.push(`من ${formatPrice(c.min_total)} وفوق`);
    if (c.expires_at) out.push(`لحد ${A.dayName(new Date(c.expires_at))}`);
    return out.join('، ');
  }

  A.views.coupons = {
    title: 'الكوبونات',
    parent: 'settings',
    sub() {
      const n = state.coupons.filter(c => statusOf(c).cls === 'st-done').length;
      return n ? A.countAr(n, 'كوبون شغّال', 'كوبونين شغّالين', 'كوبونات شغّالة') : 'أكواد خصم للزباين';
    },
    render,
  };

  function render() {
    const el = document.createElement('div');
    el.className = 'p-pad';
    el.innerHTML = `
      <div class="a-card">
        ${state.coupons.map(c => {
          const st = statusOf(c);
          return `
          <div class="srow">
            <button class="lbl" type="button" data-cp="${c.id}">
              <b><bdi dir="ltr">${escapeHTML(c.code)}</bdi> <small>خصم ${valueText(c)}</small></b>
              <span><i class="st-chip ${st.cls}">${st.text}</i> ${metaLine(c)}</span>
            </button>
            <label class="switch"><input type="checkbox" data-cp-on="${c.id}" ${c.active ? 'checked' : ''} aria-label="${escapeHTML(c.code)} مفعّل"><span></span></label>
          </div>`;
        }).join('')}
        <button class="add-row" type="button" id="cpAdd">+ كوبون جديد</button>
      </div>
      <p class="caption">اكبس على الكوبون لتعدّله. الزبون بيكتب الكود بصفحة الطلب، وما بيفرق كبير وصغير.</p>
    `;
    $('#view').replaceChildren(el);

    el.addEventListener('change', e => {
      const on = e.target.closest('[data-cp-on]');
      if (on) toggle(Number(on.dataset.cpOn), on);
    });
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-cp]');
      if (b) openCoupon(Number(b.dataset.cp));
    });
    $('#cpAdd', el).addEventListener('click', () => openCoupon(null));
  }

  function afterChange(msg) {
    A.closeSheet();
    render();
    A.refreshHead();
    if (msg) toast(msg);
  }

  async function toggle(id, input) {
    const c = state.coupons.find(x => x.id === id);
    try {
      await db(sb.from('coupons').update({ active: input.checked }).eq('id', id));
      c.active = input.checked;
      afterChange(input.checked ? `«${c.code}» شغّال` : `«${c.code}» موقّف`);
    } catch (err) {
      input.checked = !input.checked;
      fail(err);
    }
  }

  function openCoupon(id) {
    const isNew = id === null;
    const c = state.coupons.find(x => x.id === id)
      || { code: '', kind: 'percent', value: '', min_total: 0, max_uses: null, expires_at: null };
    let kind = c.kind;

    const sheet = A.openSheet(`
      <div class="sheet-head"><h2>${isNew ? 'كوبون جديد' : 'تعديل الكوبون'}</h2><button class="close" aria-label="إغلاق">×</button></div>
      <form id="cpForm" novalidate>
        <label class="field" data-f="code">
          <span>الكود</span>
          <input name="code" maxlength="20" dir="ltr" autocomplete="off" autocapitalize="characters" value="${escapeHTML(c.code)}" placeholder="EID10">
          <span class="err">من 3 لـ 20 حرف ورقم، بلا فراغات.</span>
        </label>
        <div class="seg" id="cpKind">
          <button type="button" data-kind="percent" aria-pressed="${kind === 'percent'}">نسبة %</button>
          <button type="button" data-kind="amount" aria-pressed="${kind === 'amount'}">مبلغ ثابت</button>
        </div>
        <label class="field" data-f="value">
          <span id="cpValueLbl"></span>
          <input name="value" type="text" inputmode="numeric" dir="ltr" autocomplete="off" value="${c.value}">
          <span class="err" id="cpValueErr"></span>
        </label>
        <div class="two">
          <label class="field" data-f="min">
            <span>أقل مجموع <small>(اختياري)</small></span>
            <input name="min" type="text" inputmode="numeric" dir="ltr" autocomplete="off" value="${c.min_total || ''}">
            <span class="err">اكتب رقم صحيح.</span>
          </label>
          <label class="field" data-f="max">
            <span>عدد الاستعمالات <small>(اختياري)</small></span>
            <input name="max" type="text" inputmode="numeric" dir="ltr" autocomplete="off" value="${c.max_uses ?? ''}" placeholder="بلا حد">
            <span class="err">اكتب رقم صحيح.</span>
          </label>
        </div>
        <label class="field">
          <span>آخر يوم</span>
          <select name="expires">${A.expiryOptions(c.expires_at)}</select>
        </label>
        <button class="btn" type="submit" style="margin-top:6px">${isNew ? 'إضافة' : 'حفظ'}</button>
        ${isNew ? '' : '<button class="btn danger" type="button" id="cpDel" style="margin-top:10px">حذف الكوبون</button>'}
      </form>
    `);

    const form = $('#cpForm', sheet);
    const f = form.elements;
    A.clearOnInput(form);

    const showKind = () => {
      $('#cpValueLbl', sheet).textContent = kind === 'percent' ? 'نسبة الخصم (من 1 لـ 100)' : `مبلغ الخصم (${CONFIG.currency})`;
      $('#cpValueErr', sheet).textContent = kind === 'percent' ? 'اكتب نسبة من 1 لـ 100.' : 'اكتب مبلغ أكبر من صفر.';
    };
    showKind();
    $('#cpKind', sheet).addEventListener('click', e => {
      const b = e.target.closest('[data-kind]');
      if (!b) return;
      kind = b.dataset.kind;
      sheet.querySelectorAll('#cpKind button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      showKind();
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const code = f.code.value.trim().toUpperCase();
      const value = A.num(f.value.value);
      const min = A.num(f.min.value) ?? 0;
      const max = A.num(f.max.value);
      const bad = {
        code: !/^[\p{L}\p{N}_-]{3,20}$/u.test(code),
        value: !Number.isInteger(value) || value <= 0 || (kind === 'percent' && value > 100),
        min: !Number.isInteger(min) || min < 0,
        max: max !== null && (!Number.isInteger(max) || max < 1),
      };
      Object.entries(bad).forEach(([k, on]) => form.querySelector(`[data-f="${k}"]`).classList.toggle('invalid', on));
      if (Object.values(bad).some(Boolean)) return;

      const row = {
        code, kind, value, min_total: min, max_uses: max,
        expires_at: A.endOfDay(f.expires.value),
      };
      A.busy(form, true);
      try {
        if (isNew) {
          state.coupons.unshift(await db(sb.from('coupons').insert(row).select().single()));
        } else {
          const saved = await db(sb.from('coupons').update(row).eq('id', id).select().single());
          state.coupons[state.coupons.findIndex(x => x.id === id)] = saved;
        }
        afterChange(isNew ? 'انضاف الكوبون' : 'انحفظ الكوبون');
      } catch (err) { fail(err); }
      finally { A.busy(form, false); }
    });

    const del = $('#cpDel', sheet);
    if (del) A.confirmTwice(del, 'اضغط مرة تانية لتأكيد الحذف', async () => {
      try {
        await db(sb.from('coupons').delete().eq('id', id));
        state.coupons = state.coupons.filter(x => x.id !== id);
        afterChange('انحذف الكوبون');
      } catch (err) { fail(err); }
    });
  }
})();
