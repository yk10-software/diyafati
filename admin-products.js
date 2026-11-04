/* =========================================================
   ضيافتي — لوحة التحكم: شاشة الأصناف
   بحث، فلترة بالقسم، متوفر/خلص بكبسة، وإضافة وتعديل وحذف مع الصور.
   ========================================================= */
(() => {
  'use strict';

  const { $, state, icon, db, fail, toast } = A;
  const UNITS = ['كيلو', 'قطعة', 'علبة', 'باقة'];
  const NOTE_DEFAULT = 'اكتب التفاصيل اللي بدك ياها (اسم، تاريخ...)';

  let query = '';
  let catFilter = 'all';   // all، أو id القسم، أو none (بلا قسم)

  const catName = id => (state.cats.find(c => c.id === id) || {}).name || 'بلا قسم';

  A.views.products = {
    title: 'الأصناف',
    sub() {
      const total = state.products.length;
      const on = state.products.filter(p => p.available && !p.hidden).length;
      return total ? `${A.countAr(total, 'صنف', 'صنفين', 'أصناف')}، منهن ${on} متوفر` : 'لسا ما في أصناف';
    },
    render(el) {
      // إذا القسم المختار انحذف، منرجع للكل
      if (catFilter !== 'all' && catFilter !== 'none' && !state.cats.some(c => c.id === catFilter)) catFilter = 'all';

      el.innerHTML = `
        <label class="search">
          <span class="visually-hidden">ابحث عن صنف</span>
          ${icon('search')}
          <input type="search" id="pSearch" placeholder="ابحث عن صنف" autocomplete="off" value="${escapeHTML(query)}">
        </label>
        <div class="chips" id="pChips"></div>
        <div class="a-list" id="pList"></div>
        <button class="fab" id="pAdd">${icon('plus')} صنف جديد</button>
      `;
      $('#pSearch', el).addEventListener('input', e => { query = e.target.value; renderList(); });
      $('#pChips', el).addEventListener('click', e => {
        const b = e.target.closest('[data-cat]');
        if (!b) return;
        catFilter = b.dataset.cat === 'all' || b.dataset.cat === 'none' ? b.dataset.cat : Number(b.dataset.cat);
        renderChips();
        renderList();
      });
      $('#pList', el).addEventListener('click', e => {
        const ed = e.target.closest('[data-edit]');
        if (ed) openEditor(Number(ed.dataset.edit));
      });
      $('#pList', el).addEventListener('change', e => {
        const t = e.target.closest('[data-toggle]');
        if (t) toggleAvailable(Number(t.dataset.toggle), t.checked);
      });
      $('#pAdd', el).addEventListener('click', () => openEditor(null));
      renderChips();
      renderList();
    },
  };

  function renderChips() {
    const chip = (id, name) =>
      `<button class="chip" data-cat="${id}" aria-pressed="${String(catFilter) === String(id)}">${escapeHTML(name)}</button>`;
    const hasNone = state.products.some(p => p.category_id == null);
    $('#pChips').innerHTML =
      chip('all', 'الكل') +
      state.cats.map(c => chip(c.id, c.name)).join('') +
      (hasNone ? chip('none', 'بلا قسم') : '');
  }

  function renderList() {
    let list = state.products;
    if (catFilter === 'none') list = list.filter(p => p.category_id == null);
    else if (catFilter !== 'all') list = list.filter(p => p.category_id === catFilter);
    if (query) {
      const q = normalizeAr(query);
      list = list.filter(p => normalizeAr(p.name).includes(q));
    }

    if (!list.length) {
      $('#pList').innerHTML = query || catFilter !== 'all'
        ? '<div class="empty"><b>ما في نتائج</b>جرّب كلمة تانية أو قسم تاني.</div>'
        : '<div class="empty"><b>ما في أصناف لسا</b>اضغط «صنف جديد» لتضيف أول صنف.</div>';
      return;
    }
    $('#pList').innerHTML = list.map(p => `
      <div class="a-row${p.available && !p.hidden ? '' : ' off'}">
        ${A.thumb(p.images[0])}
        <div class="a-info">
          <b>${escapeHTML(p.name)}${!p.available ? '<span class="tag">خلص</span>' : ''}${p.hidden ? '<span class="tag muted">مخفي</span>' : ''}</b>
          <span>${escapeHTML(catName(p.category_id))}</span>
          <span class="price">${effectivePrice(p) !== p.price ? `<s>${formatPrice(p.price)}</s> ` : ''}${formatPrice(effectivePrice(p))} <small>/ ${escapeHTML(p.unit)}</small></span>
        </div>
        <div class="a-actions">
          <label class="switch" title="متوفر">
            <input type="checkbox" data-toggle="${p.id}" ${p.available ? 'checked' : ''} aria-label="${escapeHTML(p.name)} متوفر">
            <span></span>
          </label>
          <button class="link-btn" data-edit="${p.id}">تعديل</button>
        </div>
      </div>`).join('');
  }

  // متوفر / خلص بكبسة. منغيّر الشاشة دغري، وإذا فشل الحفظ منرجّعها
  async function toggleAvailable(id, on) {
    const p = state.products.find(x => x.id === id);
    p.available = on;
    renderList();
    A.refreshHead();
    try {
      await db(sb.from('products').update({ available: on }).eq('id', id));
      toast(on ? `«${p.name}» رجع متوفر` : `«${p.name}» صار «خلص»`);
    } catch (err) {
      p.available = !on;
      renderList();
      A.refreshHead();
      fail(err);
    }
  }

  /* ---------- نافذة الإضافة والتعديل ---------- */
  function openEditor(id) {
    const existing = state.products.find(p => p.id === id);
    const isNew = !existing;
    const p = existing || {
      name: '', price: '', unit: 'كيلو', description: '', images: [],
      category_id: catFilter !== 'all' && catFilter !== 'none' ? catFilter : (state.cats[0] || {}).id ?? null,
      custom_note_label: null, available: true, hidden: false,
    };
    // الصور: يا رابط محفوظ { url }، يا صورة جديدة لسا ما ارتفعت { blob, preview }
    const imgs = p.images.map(url => ({ url }));

    const sheet = A.openSheet(`
      <div class="sheet-head"><h2>${isNew ? 'صنف جديد' : 'تعديل الصنف'}</h2><button class="close" aria-label="إغلاق">×</button></div>
      <form id="pForm" novalidate>
        <div class="field"><span>الصور <small>(أول صورة هي اللي بتبيّن بالقائمة)</small></span></div>
        <div class="imgs" id="imgs"></div>
        <label class="field" data-f="name">
          <span>اسم الصنف</span>
          <input name="name" value="${escapeHTML(p.name)}" maxlength="80">
          <span class="err">اكتب اسم الصنف.</span>
        </label>
        <div class="two">
          <label class="field" data-f="price">
            <span>السعر (${CONFIG.currency})</span>
            <input name="price" type="text" inputmode="numeric" dir="ltr" autocomplete="off" value="${escapeHTML(p.price)}">
            <span class="err">اكتب السعر.</span>
          </label>
          <label class="field">
            <span>السعر لكل</span>
            <select name="unit">${UNITS.map(u => `<option ${u === p.unit ? 'selected' : ''}>${u}</option>`).join('')}</select>
          </label>
        </div>
        <div class="two">
          <label class="field" data-f="sale">
            <span>سعر الخصم <small>(اختياري)</small></span>
            <input name="sale" type="text" inputmode="numeric" dir="ltr" autocomplete="off" value="${p.sale_price ?? ''}">
            <span class="err">لازم يكون أقل من السعر.</span>
          </label>
          <label class="field">
            <span>آخر يوم للخصم</span>
            <select name="sale_until">${A.expiryOptions(p.sale_until)}</select>
          </label>
        </div>
        <label class="field" data-f="pieces" id="piecesField" ${p.unit === 'كيلو' ? '' : 'hidden'}>
          <span>عدد الحبات بالكيلو <small>(اختياري)</small></span>
          <input name="pieces" type="text" inputmode="numeric" dir="ltr" autocomplete="off" value="${p.pieces_per_kg ?? ''}">
          <span class="err">اكتب رقم صحيح أكبر من صفر.</span>
        </label>
        <label class="field">
          <span>القسم</span>
          <select name="category_id">
            ${state.cats.map(c => `<option value="${c.id}" ${c.id === p.category_id ? 'selected' : ''}>${escapeHTML(c.name)}</option>`).join('')}
            <option value="" ${p.category_id == null ? 'selected' : ''}>بلا قسم</option>
          </select>
        </label>
        <label class="field">
          <span>الوصف <small>(اختياري)</small></span>
          <textarea name="description" rows="3" maxlength="400">${escapeHTML(p.description)}</textarea>
        </label>
        <label class="check"><input type="checkbox" name="available" ${p.available ? 'checked' : ''}> متوفر (إذا لأ، بيبيّن للزباين «خلص»)</label>
        <label class="check"><input type="checkbox" name="hidden" ${p.hidden ? 'checked' : ''}> مخفي عن الزباين بالكامل</label>
        <label class="check"><input type="checkbox" name="custom" ${p.custom_note_label ? 'checked' : ''}> الزبون بيكتب تفاصيل خاصة (متل نص الطباعة)</label>
        <label class="field" id="noteField" ${p.custom_note_label ? '' : 'hidden'}>
          <span>السؤال اللي بيبيّن للزبون</span>
          <input name="custom_note_label" maxlength="120" value="${escapeHTML(p.custom_note_label || NOTE_DEFAULT)}">
        </label>
        <p class="form-msg" id="pMsg" role="alert"></p>
        <button class="btn" type="submit" style="margin-top:18px">${isNew ? 'إضافة الصنف' : 'حفظ التعديلات'}</button>
        ${isNew ? '' : '<button class="btn danger" type="button" id="delBtn" style="margin-top:10px">حذف الصنف</button>'}
      </form>
    `);
    const form = $('#pForm', sheet);
    const f = form.elements;   // form.name و form.hidden محجوزين للفورم نفسه، فمنقرأ الحقول من elements
    A.clearOnInput(form, $('#pMsg', sheet));

    function renderImgs() {
      $('#imgs', sheet).innerHTML = imgs.map((im, i) => `
        <div class="img-slot"><img src="${escapeHTML(im.url || im.preview)}" alt=""><button type="button" data-rm="${i}" aria-label="شيل الصورة">×</button></div>
      `).join('') + `
        <label class="img-slot add-img">
          <input type="file" accept="image/*" multiple hidden id="imgInput">
          <span>+</span><small>صورة</small>
        </label>`;
    }
    renderImgs();

    sheet.addEventListener('change', async e => {
      if (e.target.name === 'custom') { $('#noteField', sheet).hidden = !e.target.checked; return; }
      if (e.target.name === 'unit') { $('#piecesField', sheet).hidden = e.target.value !== 'كيلو'; return; }
      if (e.target.id !== 'imgInput') return;
      for (const file of e.target.files) {
        try {
          const blob = await A.resizeImage(file);
          imgs.push({ blob, preview: URL.createObjectURL(blob) });
        } catch (err) {
          toast('ما قدرنا نفتح وحدة من الصور. جرّب صورة تانية.');
        }
      }
      renderImgs();
    });
    sheet.addEventListener('click', e => {
      const rm = e.target.closest('[data-rm]');
      if (rm) { imgs.splice(Number(rm.dataset.rm), 1); renderImgs(); }
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const name = f.name.value.trim();
      const price = A.num(f.price.value);
      form.querySelector('[data-f="name"]').classList.toggle('invalid', !name);
      form.querySelector('[data-f="price"]').classList.toggle('invalid', !(price > 0));
      const sale = A.num(f.sale.value);
      const badSale = sale !== null && !(Number.isInteger(sale) && sale > 0 && sale < price);
      form.querySelector('[data-f="sale"]').classList.toggle('invalid', badSale);
      const kilo = f.unit.value === 'كيلو';
      const pieces = kilo ? A.num(f.pieces.value) : null;
      const badPieces = pieces !== null && !(Number.isInteger(pieces) && pieces > 0);
      form.querySelector('[data-f="pieces"]').classList.toggle('invalid', badPieces);
      if (!name || !(price > 0) || badSale || badPieces) return;

      A.busy(form, true);
      const uploaded = [];
      try {
        // نرفع الصور الجديدة أول
        const urls = [];
        for (const im of imgs) {
          if (im.url) { urls.push(im.url); continue; }
          const url = await A.uploadImage(im.blob, 'products');
          uploaded.push(url);
          urls.push(url);
        }
        const row = {
          name,
          price: Math.round(price),
          sale_price: sale,
          pieces_per_kg: pieces,
          sale_until: sale === null ? null : A.endOfDay(f.sale_until.value),
          unit: f.unit.value,
          category_id: f.category_id.value ? Number(f.category_id.value) : null,
          description: f.description.value.trim(),
          images: urls,
          available: f.available.checked,
          hidden: f.hidden.checked,
          custom_note_label: f.custom.checked ? (f.custom_note_label.value.trim() || NOTE_DEFAULT) : null,
        };

        if (isNew) {
          const saved = await db(sb.from('products').insert(row).select().single());
          state.products.unshift(saved);
        } else {
          const saved = await db(sb.from('products').update(row).eq('id', p.id).select().single());
          state.products[state.products.findIndex(x => x.id === p.id)] = saved;
          // الصور اللي انشالت منحذفها من السطل
          A.removeImages(p.images.filter(u => !urls.includes(u)));
        }
        A.closeSheet();
        toast(isNew ? 'انضاف الصنف' : 'انحفظت التعديلات');
        A.render();
      } catch (err) {
        A.removeImages(uploaded);   // ما في داعي تضل صور لصنف ما انحفظ
        $('#pMsg', sheet).textContent = 'ما انحفظ الصنف. شيّك عالنت وجرّب كمان مرة.';
        console.error(err);
      } finally {
        A.busy(form, false);
      }
    });

    const del = $('#delBtn', sheet);
    if (del) {
      A.confirmTwice(del, 'اضغط مرة تانية لتأكيد الحذف', async () => {
        try {
          await db(sb.from('products').delete().eq('id', p.id));
          state.products = state.products.filter(x => x.id !== p.id);
          A.removeImages(p.images);
          A.closeSheet();
          toast('انحذف الصنف');
          A.render();
        } catch (err) { fail(err); }
      });
    }
  }
})();
