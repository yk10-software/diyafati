/* =========================================================
   ضيافتي — لوحة التحكم
   إضافة وتعديل وإخفاء وحذف الأصناف
   ========================================================= */
(() => {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const AUTH_KEY = 'diyafati_admin_ok';
  const UNITS = ['كيلو', 'قطعة', 'علبة', 'باقة'];
  const NOTE_DEFAULT = 'اكتب التفاصيل اللي بدك ياها (اسم، تاريخ...)';

  let products = Store.load();
  let query = '';

  /* ---------- الدخول ---------- */
  function isAuthed() {
    try { return sessionStorage.getItem(AUTH_KEY) === '1'; } catch (e) { return false; }
  }
  function showPanel() {
    $('#gate').hidden = true;
    $('#panel').hidden = false;
    render();
  }

  if (CONFIG.demo) $('#pinHint').textContent = 'كلمة السر بالنسخة التجريبية: ' + CONFIG.adminPin;
  else $('#demoNote').hidden = true;

  $('#gateForm').addEventListener('submit', e => {
    e.preventDefault();
    // بالنسخة الحقيقية: تسجيل الدخول بيصير عن طريق Supabase Auth مو هيك
    if ($('#pin').value.trim() === CONFIG.adminPin) {
      try { sessionStorage.setItem(AUTH_KEY, '1'); } catch (err) {}
      showPanel();
    } else {
      $('#pinField').classList.add('invalid');
      $('#pin').select();
    }
  });
  $('#pin').addEventListener('input', () => $('#pinField').classList.remove('invalid'));

  /* ---------- القائمة ---------- */
  const catName = id => (CATEGORIES.find(c => c.id === id) || {}).name || '';

  function render() {
    const total = products.length;
    const on = products.filter(p => p.available !== false).length;
    $('#summary').textContent = `${total} ${total === 1 ? 'صنف' : total === 2 ? 'صنفين' : total <= 10 ? 'أصناف' : 'صنف'}، منهن ${on} متوفر`;

    let list = products;
    if (query) {
      const q = normalizeAr(query);
      list = list.filter(p => normalizeAr(p.name).includes(q));
    }
    if (!list.length) {
      $('#list').innerHTML = query
        ? '<div class="empty"><b>ما في نتائج</b>جرّب كلمة تانية.</div>'
        : '<div class="empty"><b>ما في أصناف لسا</b>اضغط «إضافة صنف» لتضيف أول صنف.</div>';
      return;
    }
    $('#list').innerHTML = list.map(p => `
      <div class="a-row${p.available === false ? ' off' : ''}" data-id="${p.id}">
        <img src="${escapeHTML(p.images[0] || 'icons/icon-192.png')}" alt="">
        <div class="a-info">
          <b>${escapeHTML(p.name)}</b>
          <span>${escapeHTML(catName(p.cat))}</span>
          <span class="price">${formatPrice(p.price)} <small>/ ${escapeHTML(p.unit)}</small></span>
        </div>
        <div class="a-actions">
          <label class="switch" title="متوفر">
            <input type="checkbox" data-toggle="${p.id}" ${p.available !== false ? 'checked' : ''} aria-label="${escapeHTML(p.name)} متوفر">
            <span></span>
          </label>
          <button class="link-btn" data-edit="${p.id}">تعديل</button>
        </div>
      </div>`).join('');
  }

  function persist(msg) {
    if (Store.save(products)) {
      if (msg) toast(msg);
      return true;
    }
    toast('ما انحفظ: ذاكرة الجهاز امتلت. جرّب صورة أصغر.');
    products = Store.load();
    return false;
  }

  /* ---------- نافذة الإضافة والتعديل ---------- */
  let current = null;
  function openSheet(html) {
    closeSheet();
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `<div class="sheet tall" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
    ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('.close')) closeSheet(); });
    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';
    current = ov;
    return ov.firstElementChild;
  }
  function closeSheet() {
    if (!current) return;
    current.remove();
    current = null;
    document.body.style.overflow = '';
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

  function resizeImage(file, max = 900) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const r = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * r);
        c.height = Math.round(img.height * r);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.78));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
      img.src = url;
    });
  }

  function openEditor(id) {
    const existing = products.find(p => p.id === id);
    const p = existing ? JSON.parse(JSON.stringify(existing)) : {
      id: 'p' + Date.now().toString(36), name: '', cat: CATEGORIES[1].id, price: '',
      unit: 'كيلو', images: [], desc: '', available: true,
    };
    const isNew = !existing;

    const sheet = openSheet(`
      <div class="sheet-head"><h2>${isNew ? 'صنف جديد' : 'تعديل الصنف'}</h2><button class="close" aria-label="إغلاق">×</button></div>
      <form id="pForm" novalidate>
        <div class="field"><span>الصور</span></div>
        <div class="imgs" id="imgs"></div>
        <label class="field" data-f="name">
          <span>اسم الصنف</span>
          <input name="name" value="${escapeHTML(p.name)}" maxlength="60">
          <span class="err">اكتب اسم الصنف.</span>
        </label>
        <div class="two">
          <label class="field" data-f="price">
            <span>السعر (${CONFIG.currency})</span>
            <input name="price" type="number" inputmode="numeric" min="0" step="50" value="${escapeHTML(p.price)}">
            <span class="err">اكتب السعر.</span>
          </label>
          <label class="field">
            <span>السعر لكل</span>
            <select name="unit">${UNITS.map(u => `<option ${u === p.unit ? 'selected' : ''}>${u}</option>`).join('')}</select>
          </label>
        </div>
        <label class="field">
          <span>القسم</span>
          <select name="cat">${CATEGORIES.filter(c => c.id !== 'all').map(c => `<option value="${c.id}" ${c.id === p.cat ? 'selected' : ''}>${escapeHTML(c.name)}</option>`).join('')}</select>
        </label>
        <label class="field">
          <span>الوصف <small>(اختياري)</small></span>
          <textarea name="desc" rows="3" maxlength="300">${escapeHTML(p.desc)}</textarea>
        </label>
        <label class="check"><input type="checkbox" name="available" ${p.available !== false ? 'checked' : ''}> متوفر وبيبيّن للزباين</label>
        <label class="check"><input type="checkbox" name="custom" ${p.customNote ? 'checked' : ''}> الزبون بيكتب تفاصيل خاصة (متل نص الطباعة)</label>
        <button class="btn" type="submit" style="margin-top:18px">${isNew ? 'إضافة الصنف' : 'حفظ التعديلات'}</button>
        ${isNew ? '' : '<button class="btn danger" type="button" id="delBtn" style="margin-top:10px">حذف الصنف</button>'}
      </form>
    `);

    function renderImgs() {
      $('#imgs', sheet).innerHTML = p.images.map((src, i) => `
        <div class="img-slot"><img src="${escapeHTML(src)}" alt=""><button type="button" data-rm="${i}" aria-label="شيل الصورة">×</button></div>
      `).join('') + `
        <label class="img-slot add-img">
          <input type="file" accept="image/*" hidden id="imgInput">
          <span>+</span><small>صورة</small>
        </label>`;
    }
    renderImgs();

    sheet.addEventListener('change', async e => {
      if (e.target.id !== 'imgInput' || !e.target.files[0]) return;
      try {
        p.images.push(await resizeImage(e.target.files[0]));
        renderImgs();
      } catch (err) {
        toast('ما قدرنا نفتح هالصورة. جرّب صورة تانية.');
      }
    });
    sheet.addEventListener('click', e => {
      const rm = e.target.closest('[data-rm]');
      if (rm) { p.images.splice(Number(rm.dataset.rm), 1); renderImgs(); }
    });

    const form = $('#pForm', sheet);
    form.addEventListener('input', e => { const f = e.target.closest('.field'); if (f) f.classList.remove('invalid'); });
    form.addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(form);
      const name = String(fd.get('name')).trim();
      const price = Number(fd.get('price'));
      form.querySelector('[data-f="name"]').classList.toggle('invalid', !name);
      form.querySelector('[data-f="price"]').classList.toggle('invalid', !(price > 0));
      if (!name || !(price > 0)) return;

      Object.assign(p, {
        name, price,
        unit: fd.get('unit'),
        cat: fd.get('cat'),
        desc: String(fd.get('desc')).trim(),
        available: fd.get('available') === 'on',
      });
      if (fd.get('custom') === 'on') p.customNote = p.customNote || NOTE_DEFAULT;
      else delete p.customNote;

      const before = JSON.stringify(products);
      if (isNew) products.unshift(p);
      else products[products.findIndex(x => x.id === p.id)] = p;
      if (!persist(isNew ? 'انضاف الصنف' : 'انحفظت التعديلات')) { products = JSON.parse(before); return; }
      closeSheet();
      render();
    });

    const del = $('#delBtn', sheet);
    if (del) {
      let armed = false;
      del.addEventListener('click', () => {
        if (!armed) { armed = true; del.textContent = 'اضغط مرة تانية لتأكيد الحذف'; return; }
        products = products.filter(x => x.id !== p.id);
        persist('انحذف الصنف');
        closeSheet();
        render();
      });
    }
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
    toastTimer = setTimeout(() => t.remove(), 2400);
  }

  /* ---------- الأحداث ---------- */
  $('#addBtn').addEventListener('click', () => openEditor(null));
  $('#aSearch').addEventListener('input', e => { query = e.target.value; render(); });
  $('#list').addEventListener('click', e => {
    const ed = e.target.closest('[data-edit]');
    if (ed) openEditor(ed.dataset.edit);
  });
  $('#list').addEventListener('change', e => {
    const t = e.target.closest('[data-toggle]');
    if (!t) return;
    const p = products.find(x => x.id === t.dataset.toggle);
    p.available = t.checked;
    persist(t.checked ? 'رجع «' + p.name + '» يبيّن للزباين' : 'انخفى «' + p.name + '» عن الزباين');
    render();
  });

  let resetArmed = false;
  $('#resetBtn').addEventListener('click', e => {
    if (!resetArmed) { resetArmed = true; e.target.textContent = 'اضغط مرة تانية لترجيع الأصناف الأصلية'; return; }
    Store.reset();
    products = Store.load();
    resetArmed = false;
    e.target.textContent = 'رجّع الأصناف الأصلية';
    toast('رجعت الأصناف الأصلية');
    render();
  });

  if (isAuthed()) showPanel();
})();
