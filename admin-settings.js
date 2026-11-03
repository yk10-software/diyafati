/* =========================================================
   ضيافتي — لوحة التحكم: شاشة الإعدادات
   المحل مفتوح/مسكّر، أجور التوصيل، طرق الدفع والحسابات، إعدادات الطلبات، والحساب.
   ========================================================= */
(() => {
  'use strict';

  const { $, state, db, fail, toast } = A;

  A.views.settings = {
    title: 'الإعدادات',
    sub: () => 'التوصيل والدفع وإعدادات الطلبات',
    render,
  };

  // رقم الواتس للعرض: 963953334642 ← ‎+963 953 334 642
  const prettyPhone = d => '+' + d.slice(0, 3) + ' ' + d.slice(3).replace(/(\d{3})(?=\d)/g, '$1 ');

  function render() {
    const s = state.settings;
    // غلاف جديد بكل مرة، لحتى ما تتراكم الـ listeners على #view
    const el = document.createElement('div');
    el.className = 'p-pad';
    el.innerHTML = `
      <div class="a-card open-row">
        <p><b>المحل مفتوح للطلبات</b><span>بتسكّره بكبسة إذا بدك توقف الطلبات</span></p>
        <label class="switch"><input type="checkbox" id="sOpen" ${s.shop_open ? 'checked' : ''} aria-label="المحل مفتوح للطلبات"><span></span></label>
      </div>

      <div class="sec"><h2>أجور التوصيل</h2><small>${CONFIG.currency}</small></div>
      <div class="a-card">
        ${state.zones.map(z => `
          <div class="srow">
            <button class="lbl" type="button" data-zone="${z.id}">
              <b>${escapeHTML(z.name)}</b>
              <span>${z.active ? escapeHTML(z.note) : 'موقّفة، ما بتبيّن للزباين'}</span>
            </button>
            <input class="fee" type="text" inputmode="numeric" dir="ltr" autocomplete="off" data-fee="${z.id}"
                   value="${z.fee ?? ''}" placeholder="حسب الاتفاق" aria-label="أجرة التوصيل لـ ${escapeHTML(z.name)}">
          </div>`).join('')}
        <button class="add-row" type="button" id="zAdd">+ منطقة جديدة</button>
      </div>
      <p class="caption">اكبس على اسم المنطقة لتعدّلها. خلّي الأجرة فاضية إذا بتتحدد حسب الاتفاق (متل خارج سوريا).</p>

      <div class="sec"><h2>طرق الدفع</h2></div>
      <div class="a-card">
        <div class="srow">
          <div class="lbl"><b>كاش عند الاستلام</b><span>بيدفع للمندوب لما يوصله الطلب</span></div>
          <label class="switch"><input type="checkbox" id="sCash" ${s.cash_enabled ? 'checked' : ''} aria-label="كاش عند الاستلام"><span></span></label>
        </div>
        ${state.accounts.map(a => `
          <div class="srow">
            <button class="lbl" type="button" data-acc="${a.id}">
              <b>${escapeHTML(a.title)} <small>${a.kind === 'shamcash' ? 'شام كاش' : 'تحويل بنكي'}</small></b>
              <span><bdi dir="ltr">${escapeHTML(a.account_number)}</bdi>${a.holder_name ? ' · ' + escapeHTML(a.holder_name) : ''}</span>
            </button>
            <label class="switch"><input type="checkbox" data-acc-on="${a.id}" ${a.active ? 'checked' : ''} aria-label="${escapeHTML(a.title)} مفعّل"><span></span></label>
          </div>`).join('')}
        <button class="add-row" type="button" id="aAdd">+ حساب جديد (شام كاش أو بنك)</button>
      </div>
      <p class="caption">الزبون بيشوف الحسابات المفعّلة بس، مع زر نسخ للرقم.</p>

      <div class="sec"><h2>الطلبات</h2></div>
      <div class="a-card">
        <div class="srow">
          <div class="lbl"><b>رقم واتساب الطلبات</b><span><bdi dir="ltr">${prettyPhone(s.whatsapp)}</bdi></span></div>
          <button class="link-btn" type="button" data-set="whatsapp">تغيير</button>
        </div>
        <div class="srow">
          <div class="lbl"><b>ساعات العمل</b><span>${escapeHTML(s.hours_label)}</span></div>
          <button class="link-btn" type="button" data-set="hours_label">تغيير</button>
        </div>
        <div class="srow">
          <div class="lbl"><b>أقل كمية للطلب</b><span>${formatQty(Number(s.min_kilo), 'كيلو')} <small>(للأصناف بالكيلو)</small></span></div>
          <button class="link-btn" type="button" data-set="min_kilo">تغيير</button>
        </div>
        <div class="srow">
          <div class="lbl"><b>استقبال طلبات بموعد</b><span>${s.scheduled_enabled ? `لحد ${A.countAr(s.schedule_max_days, 'يوم', 'يومين', 'أيام')} لقدام` : 'مسكّر: بس «بأقرب وقت»'}</span></div>
          <label class="switch"><input type="checkbox" id="sSched" ${s.scheduled_enabled ? 'checked' : ''} aria-label="استقبال طلبات بموعد"><span></span></label>
        </div>
        ${s.scheduled_enabled ? `
        <div class="srow">
          <div class="lbl"><b>لحد كم يوم لقدام</b><span>${A.countAr(s.schedule_max_days, 'يوم', 'يومين', 'أيام')}</span></div>
          <button class="link-btn" type="button" data-set="schedule_max_days">تغيير</button>
        </div>` : ''}
      </div>

      <div class="sec"><h2>الحساب</h2></div>
      <div class="a-card">
        <div class="srow">
          <div class="lbl"><b>حسابي</b><span><bdi dir="ltr">${escapeHTML(A.user.email)}</bdi></span></div>
          <button class="link-btn" type="button" id="accBtn">كلمة السر والخروج</button>
        </div>
        <div class="srow">
          <div class="lbl"><b>تطبيق الزباين</b><span>شوف كيف بيبيّن للزباين</span></div>
          <a class="link-btn" href="./" target="_blank" rel="noopener">فتح</a>
        </div>
      </div>
    `;
    $('#view').replaceChildren(el);

    // المفاتيح (switches)
    $('#sOpen', el).addEventListener('change', e => saveSettings({ shop_open: e.target.checked },
      e.target.checked ? 'المحل مفتوح، الطلبات رجعت' : 'المحل مسكّر، ما رح توصل طلبات', e.target));
    $('#sCash', el).addEventListener('change', e => saveSettings({ cash_enabled: e.target.checked },
      e.target.checked ? 'الكاش رجع مفعّل' : 'الكاش موقّف', e.target));
    $('#sSched', el).addEventListener('change', e => saveSettings({ scheduled_enabled: e.target.checked },
      e.target.checked ? 'صار في طلبات بموعد' : 'الطلبات صارت بأقرب وقت بس', e.target, true));

    // أجرة التوصيل: بتنحفظ لما تطلع من الخانة
    el.addEventListener('change', async e => {
      const fee = e.target.closest('[data-fee]');
      if (fee) return saveFee(Number(fee.dataset.fee), fee);
      const on = e.target.closest('[data-acc-on]');
      if (on) return toggleAccount(Number(on.dataset.accOn), on);
    });
    el.addEventListener('click', e => {
      const z = e.target.closest('[data-zone]');
      if (z) return openZone(Number(z.dataset.zone));
      const a = e.target.closest('[data-acc]');
      if (a) return openAccountSheet(Number(a.dataset.acc));
      const set = e.target.closest('[data-set]');
      if (set) return openSetting(set.dataset.set);
    });
    $('#zAdd', el).addEventListener('click', () => openZone(null));
    $('#aAdd', el).addEventListener('click', () => openAccountSheet(null));
    $('#accBtn', el).addEventListener('click', A.openAccount);
  }

  /* ---------- حفظ الإعدادات ---------- */
  // input: إذا فشل الحفظ منرجّع المفتاح لمحله. rerender: إذا الشاشة لازم تتحدّث
  async function saveSettings(patch, msg, input, rerender) {
    try {
      state.settings = await db(sb.from('settings').update(patch).eq('id', 1).select().single());
      toast(msg);
      if (rerender) render();
      return true;
    } catch (err) {
      if (input) input.checked = !input.checked;
      fail(err);
      return false;
    }
  }

  async function saveFee(id, input) {
    const z = state.zones.find(x => x.id === id);
    const fee = A.num(input.value);
    if (fee !== null && !(Number.isInteger(fee) && fee >= 0)) { input.value = z.fee ?? ''; toast('اكتب رقم صحيح، أو خليها فاضية'); return; }
    if (fee === z.fee) return;
    try {
      await db(sb.from('delivery_zones').update({ fee }).eq('id', id));
      z.fee = fee;
      toast(fee === null ? `${z.name}: حسب الاتفاق` : `${z.name}: ${formatPrice(fee)}`);
    } catch (err) {
      input.value = z.fee ?? '';
      fail(err);
    }
  }

  async function toggleAccount(id, input) {
    const a = state.accounts.find(x => x.id === id);
    try {
      await db(sb.from('payment_accounts').update({ active: input.checked }).eq('id', id));
      a.active = input.checked;
      toast(input.checked ? `«${a.title}» بيبيّن للزباين` : `«${a.title}» انخفى عن الزباين`);
    } catch (err) {
      input.checked = !input.checked;
      fail(err);
    }
  }

  /* ---------- تعديل إعداد واحد (واتس، ساعات، أقل كمية، أيام الموعد) ---------- */
  const FIELDS = {
    whatsapp: {
      title: 'رقم واتساب الطلبات',
      input: v => `<input name="v" type="tel" dir="ltr" inputmode="tel" value="${escapeHTML(v)}">`,
      hint: 'مع رمز البلد. ممكن تكتبه 0953... وبيتحوّل لحاله لـ 963953...',
      err: 'الرقم مو مزبوط.',
      // بيقبل: ‎+963 953 334 642 أو 00963... أو 0953... ← 963953334642
      parse(v) {
        let d = v.replace(/\D/g, '');
        if (d.startsWith('00')) d = d.slice(2);
        else if (d.startsWith('09')) d = '963' + d.slice(1);
        return d.length >= 10 && d.length <= 15 ? d : null;
      },
    },
    hours_label: {
      title: 'ساعات العمل',
      input: v => `<input name="v" maxlength="80" value="${escapeHTML(v)}">`,
      hint: 'متل: كل يوم من 9 الصبح لـ 10 بالليل',
      err: 'اكتب ساعات العمل.',
      parse: v => v.trim() || null,
    },
    min_kilo: {
      title: 'أقل كمية للطلب (بالكيلو)',
      input: v => `<select name="v">${[0.5, 1, 1.5, 2, 3, 5].map(q =>
        `<option value="${q}" ${Number(v) === q ? 'selected' : ''}>${formatQty(q, 'كيلو')}</option>`).join('')}</select>`,
      hint: 'أقل كمية بيقدر الزبون يطلبها من صنف بالكيلو.',
      parse: v => Number(v),
    },
    schedule_max_days: {
      title: 'لحد كم يوم لقدام',
      input: v => `<input name="v" type="text" inputmode="numeric" dir="ltr" autocomplete="off" value="${escapeHTML(v)}">`,
      hint: 'الزبون ما بيقدر يختار موعد أبعد من هيك.',
      err: 'اكتب رقم من 1 لـ 90.',
      parse: v => { const n = A.num(v); return Number.isInteger(n) && n >= 1 && n <= 90 ? n : null; },
    },
  };

  function openSetting(key) {
    const F = FIELDS[key];
    const sheet = A.openSheet(`
      <div class="sheet-head"><h2>${F.title}</h2><button class="close" aria-label="إغلاق">×</button></div>
      <form id="setForm" novalidate>
        <label class="field" data-f="v">
          ${F.input(state.settings[key])}
          <span class="err">${F.err || ''}</span>
        </label>
        <p class="caption" style="margin-top:-6px">${F.hint}</p>
        <button class="btn" type="submit" style="margin-top:14px">حفظ</button>
      </form>
    `);
    const form = $('#setForm', sheet);
    A.clearOnInput(form);
    form.elements.v.focus();
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const value = F.parse(form.elements.v.value);
      if (value === null) { form.querySelector('[data-f="v"]').classList.add('invalid'); return; }
      A.busy(form, true);
      const ok = await saveSettings({ [key]: value }, 'انحفظ');
      A.busy(form, false);
      if (ok) { A.closeSheet(); render(); }
    });
  }

  /* ---------- منطقة توصيل ---------- */
  function openZone(id) {
    const z = state.zones.find(x => x.id === id) || { name: '', fee: null, note: '', active: true };
    const isNew = id === null;
    const sheet = A.openSheet(`
      <div class="sheet-head"><h2>${isNew ? 'منطقة جديدة' : 'تعديل المنطقة'}</h2><button class="close" aria-label="إغلاق">×</button></div>
      <form id="zForm" novalidate>
        <label class="field" data-f="zname">
          <span>اسم المنطقة</span>
          <input name="zname" maxlength="50" value="${escapeHTML(z.name)}" placeholder="متل: حمص">
          <span class="err">اكتب اسم المنطقة.</span>
        </label>
        <label class="field" data-f="fee">
          <span>أجرة التوصيل (${CONFIG.currency}) <small>فاضية = حسب الاتفاق</small></span>
          <input name="fee" type="text" inputmode="numeric" dir="ltr" autocomplete="off" value="${z.fee ?? ''}">
          <span class="err">اكتب رقم صحيح، أو خليها فاضية.</span>
        </label>
        <label class="field">
          <span>ملاحظة <small>(اختياري، متل «شحن»)</small></span>
          <input name="note" maxlength="60" value="${escapeHTML(z.note)}">
        </label>
        <label class="check"><input type="checkbox" name="active" ${z.active ? 'checked' : ''}> بتبيّن للزباين</label>
        <button class="btn" type="submit" style="margin-top:18px">${isNew ? 'إضافة' : 'حفظ'}</button>
        ${isNew ? '' : '<button class="btn danger" type="button" id="zDel" style="margin-top:10px">حذف المنطقة</button>'}
      </form>
    `);
    const form = $('#zForm', sheet);
    const f = form.elements;
    A.clearOnInput(form);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!A.requireFields(form, ['zname'])) return;
      const fee = A.num(f.fee.value);
      if (fee !== null && !(Number.isInteger(fee) && fee >= 0)) { form.querySelector('[data-f="fee"]').classList.add('invalid'); return; }
      const row = { name: f.zname.value.trim(), fee, note: f.note.value.trim(), active: f.active.checked };
      A.busy(form, true);
      try {
        if (isNew) {
          row.sort_order = state.zones.reduce((m, x) => Math.max(m, x.sort_order), 0) + 1;
          state.zones.push(await db(sb.from('delivery_zones').insert(row).select().single()));
        } else {
          const saved = await db(sb.from('delivery_zones').update(row).eq('id', id).select().single());
          state.zones[state.zones.findIndex(x => x.id === id)] = saved;
        }
        A.closeSheet();
        render();
        toast(isNew ? 'انضافت المنطقة' : 'انحفظت المنطقة');
      } catch (err) { fail(err); }
      finally { A.busy(form, false); }
    });
    const del = $('#zDel', sheet);
    if (del) A.confirmTwice(del, 'اضغط مرة تانية لتأكيد الحذف', async () => {
      try {
        await db(sb.from('delivery_zones').delete().eq('id', id));
        state.zones = state.zones.filter(x => x.id !== id);
        A.closeSheet();
        render();
        toast('انحذفت المنطقة');
      } catch (err) { fail(err); }
    });
  }

  /* ---------- حساب دفع (شام كاش أو بنك) ---------- */
  function openAccountSheet(id) {
    const a = state.accounts.find(x => x.id === id)
      || { kind: 'shamcash', title: 'شام كاش', holder_name: '', account_number: '', note: '', active: true };
    const isNew = id === null;
    const sheet = A.openSheet(`
      <div class="sheet-head"><h2>${isNew ? 'حساب جديد' : 'تعديل الحساب'}</h2><button class="close" aria-label="إغلاق">×</button></div>
      <form id="aForm" novalidate>
        <label class="field">
          <span>النوع</span>
          <select name="kind">
            <option value="shamcash" ${a.kind === 'shamcash' ? 'selected' : ''}>شام كاش</option>
            <option value="bank" ${a.kind === 'bank' ? 'selected' : ''}>تحويل بنكي</option>
          </select>
        </label>
        <label class="field" data-f="atitle">
          <span>الاسم اللي بيشوفه الزبون</span>
          <input name="atitle" maxlength="50" value="${escapeHTML(a.title)}" placeholder="متل: بنك سوريا الدولي الإسلامي">
          <span class="err">اكتب الاسم.</span>
        </label>
        <label class="field" data-f="number">
          <span>رقم الحساب</span>
          <input name="number" dir="ltr" maxlength="60" value="${escapeHTML(a.account_number)}">
          <span class="err">اكتب رقم الحساب.</span>
        </label>
        <label class="field">
          <span>اسم صاحب الحساب <small>(اختياري)</small></span>
          <input name="holder" maxlength="60" value="${escapeHTML(a.holder_name)}">
        </label>
        <label class="field">
          <span>ملاحظة للزبون <small>(اختياري)</small></span>
          <input name="note" maxlength="120" value="${escapeHTML(a.note)}">
        </label>
        <label class="check"><input type="checkbox" name="active" ${a.active ? 'checked' : ''}> بيبيّن للزباين</label>
        <button class="btn" type="submit" style="margin-top:18px">${isNew ? 'إضافة' : 'حفظ'}</button>
        ${isNew ? '' : '<button class="btn danger" type="button" id="aDel" style="margin-top:10px">حذف الحساب</button>'}
      </form>
    `);
    const form = $('#aForm', sheet);
    const f = form.elements;
    A.clearOnInput(form);

    // لما تغيّر النوع، إذا الاسم لسا الافتراضي منغيّره معه
    f.kind.addEventListener('change', () => {
      if (f.kind.value === 'shamcash' && !f.atitle.value.trim()) f.atitle.value = 'شام كاش';
      if (f.kind.value === 'bank' && f.atitle.value.trim() === 'شام كاش') f.atitle.value = '';
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!A.requireFields(form, ['atitle', 'number'])) return;
      const row = {
        kind: f.kind.value,
        title: f.atitle.value.trim(),
        account_number: f.number.value.trim(),
        holder_name: f.holder.value.trim(),
        note: f.note.value.trim(),
        active: f.active.checked,
      };
      A.busy(form, true);
      try {
        if (isNew) {
          row.sort_order = state.accounts.reduce((m, x) => Math.max(m, x.sort_order), 0) + 1;
          state.accounts.push(await db(sb.from('payment_accounts').insert(row).select().single()));
        } else {
          const saved = await db(sb.from('payment_accounts').update(row).eq('id', id).select().single());
          state.accounts[state.accounts.findIndex(x => x.id === id)] = saved;
        }
        A.closeSheet();
        render();
        toast(isNew ? 'انضاف الحساب' : 'انحفظ الحساب');
      } catch (err) { fail(err); }
      finally { A.busy(form, false); }
    });
    const del = $('#aDel', sheet);
    if (del) A.confirmTwice(del, 'اضغط مرة تانية لتأكيد الحذف', async () => {
      try {
        await db(sb.from('payment_accounts').delete().eq('id', id));
        state.accounts = state.accounts.filter(x => x.id !== id);
        A.closeSheet();
        render();
        toast('انحذف الحساب');
      } catch (err) { fail(err); }
    });
  }
})();
