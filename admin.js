/* =========================================================
   ضيافتي — لوحة التحكم: الأساس
   هون: تسجيل الدخول، والتنقل بين الشاشات، وتحميل البيانات من Supabase،
   وأدوات مشتركة (نوافذ، إشعارات، صور).
   كل شاشة بملف لحالها:
     admin-products.js   الأصناف
     admin-categories.js الأقسام
     admin-settings.js   الإعدادات (التوصيل، الدفع، الطلبات)
   الملفات بتتشارك بالكائن `A`.
   ========================================================= */
const A = (() => {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // كل بيانات المحل بعد التحميل
  const state = { settings: null, cats: [], products: [], zones: [], accounts: [] };
  const views = {};          // كل ملف شاشة بيسجّل حاله هون
  let user = null;

  /* ---------- أدوات صغيرة ---------- */
  const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;

  // العدد بالعربي: 1 صنف، 2 صنفين، 3-10 أصناف، 11+ صنف
  function countAr(n, one, two, few) {
    if (n === 1) return one;
    if (n === 2) return two;
    return n + ' ' + (n >= 3 && n <= 10 ? few : one);
  }

  // بيقرأ رقم من خانة: بيقبل الأرقام العربية (٢٥٠) والإنكليزية، وبيتجاهل الفواصل والمسافات.
  // خانة فاضية ← null، شي مو رقم ← NaN
  function num(str) {
    const s = String(str ?? '').trim()
      .replace(/[٠-٩]/g, d => d.charCodeAt(0) - 0x0660)
      .replace(/[۰-۹]/g, d => d.charCodeAt(0) - 0x06F0)
      .replace(/[,\s٬]/g, '').replace('٫', '.');
    return s === '' ? null : Number(s);
  }

  // كل طلب لـ Supabase بيمرّ من هون: إذا في خطأ منرميه لحتى يمسكه catch
  async function db(query) {
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  function dbErrorAr(err) {
    const code = (err && err.code) || '';
    if (/fetch|network/i.test((err && err.message) || '')) return 'ما في نت، أو الاتصال ضعيف. جرّب كمان مرة.';
    if (code === '42501' || code === 'PGRST301') return 'ما عندك صلاحية. سجّل خروج وفوت من جديد.';
    if (code === '23505') return 'هاد موجود من قبل.';
    console.error(err);
    return 'ما انحفظ، جرّب كمان مرة.';
  }
  const fail = err => toast(dbErrorAr(err));

  /* ---------- تحميل كل البيانات ---------- */
  async function loadAll() {
    const [settings, cats, products, zones, accounts] = await Promise.all([
      db(sb.from('settings').select('*').eq('id', 1).single()),
      db(sb.from('categories').select('*').order('sort_order').order('id')),
      db(sb.from('products').select('*').order('id', { ascending: false })),
      db(sb.from('delivery_zones').select('*').order('sort_order').order('id')),
      db(sb.from('payment_accounts').select('*').order('sort_order').order('id')),
    ]);
    Object.assign(state, { settings, cats, products, zones, accounts });
  }

  /* ---------- التنقل بين الشاشات (#products، #categories، #settings) ---------- */
  function current() {
    const name = location.hash.slice(1);
    return views[name] ? name : 'products';
  }
  function render() {
    if (!user) return;
    const name = current();
    const view = views[name];
    $('#pTitle').textContent = view.title;
    refreshHead();
    $$('.a-nav button').forEach(b => b.setAttribute('aria-current', b.dataset.go === name ? 'page' : 'false'));
    closeSheet();
    view.render($('#view'));
    window.scrollTo(0, 0);
  }
  // العنوان الصغير تحت عنوان الشاشة (متل «152 صنف، منهن 147 متوفر»)
  function refreshHead() {
    const view = views[current()];
    $('#pSub').textContent = view.sub ? view.sub() : '';
  }
  window.addEventListener('hashchange', render);

  /* ---------- النوافذ اللي بتطلع من تحت ---------- */
  let sheetEl = null;
  function openSheet(html) {
    closeSheet();
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
    ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('.close, [data-close]')) closeSheet(); });
    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';
    sheetEl = ov;
    return ov.firstElementChild;
  }
  function closeSheet() {
    if (!sheetEl) return;
    sheetEl.remove();
    sheetEl = null;
    document.body.style.overflow = '';
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

  // زر بدّه كبستين (للحذف): أول كبسة بتغيّر النص، التانية بتنفّذ
  function confirmTwice(btn, text, action) {
    let armed = false;
    btn.addEventListener('click', () => {
      if (!armed) { armed = true; btn.dataset.label = btn.textContent; btn.textContent = text; return; }
      action();
    });
  }

  /* ---------- أدوات الفورمات ---------- */
  function clearOnInput(form, msgEl) {
    form.addEventListener('input', e => {
      const f = e.target.closest('.field');
      if (f) f.classList.remove('invalid');
      if (msgEl) { msgEl.textContent = ''; msgEl.classList.remove('ok'); }
    });
  }
  function requireFields(form, names) {
    let ok = true;
    names.forEach(n => {
      const empty = !form.elements[n].value.trim();
      form.querySelector(`[data-f="${n}"]`).classList.toggle('invalid', empty);
      if (empty) ok = false;
    });
    return ok;
  }
  function busy(form, on) {
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = on;
    if (on) { btn.dataset.label = btn.textContent; btn.textContent = 'لحظة...'; }
    else if (btn.dataset.label) btn.textContent = btn.dataset.label;
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
    toastTimer = setTimeout(() => t.remove(), 2600);
  }

  /* ---------- الصور ----------
     منصغّر الصورة بالمتصفح لـ 900px قبل الرفع، وبترتفع على سطل images. */
  const BUCKET = 'images';

  function resizeImage(file, max = 900) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const r = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * r);
        c.height = Math.round(img.height * r);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';               // الـ PNG الشفاف بيصير أبيض بدل أسود
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(b => (b ? resolve(b) : reject(new Error('bad image'))), 'image/jpeg', 0.8);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
      img.src = url;
    });
  }

  async function uploadImage(blob, folder) {
    // randomUUID بتشتغل بس على https أو localhost، فإذا فتحت اللوحة من الموبايل على IP اللابتوب منستعمل البديل
    const id = crypto.randomUUID ? crypto.randomUUID()
      : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    const path = `${folder}/${id}.jpg`;
    await db(sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' }));
    return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  // بيحذف الصور من السطل (بس اللي إلنا، مش صور img/ تبع الموقع)
  async function removeImages(urls) {
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const paths = urls.filter(u => u && u.includes(marker)).map(u => decodeURIComponent(u.split(marker)[1]));
    if (!paths.length) return;
    try { await db(sb.storage.from(BUCKET).remove(paths)); }
    catch (err) { console.warn('ما قدرنا نحذف صور قديمة', err); }   // مو مشكلة كبيرة، بتضل بالسطل
  }

  // الصنف اللي ما إله صورة: كرت بهوية ضيافتي (قوس زبدي ولوغو)
  function thumb(src, cls = '') {
    return src
      ? `<img class="${cls}" src="${escapeHTML(src)}" alt="" loading="lazy">`
      : `<span class="ph ${cls}"><img src="img/logo-mark.png" alt=""></span>`;
  }

  /* =========================================================
     تسجيل الدخول (Supabase Auth)
     بالإيميل وكلمة السر، وبعدها منسأل is_admin().
     إذا الحساب مو بجدول admins منطلّعه فوراً.
     ========================================================= */
  function showGate() {
    user = null;
    document.body.classList.remove('in-panel');
    $('#booting').hidden = true;
    $('#panel').hidden = true;
    $('#gate').hidden = false;
    closeSheet();
  }
  async function showPanel(u) {
    user = u;
    $('#booting').hidden = false;
    $('#booting').textContent = 'عم نحمّل بيانات المحل...';
    $('#gate').hidden = true;
    try {
      await loadAll();
    } catch (err) {
      $('#booting').textContent = dbErrorAr(err);
      return;
    }
    $('#booting').hidden = true;
    document.body.classList.add('in-panel');
    $('#panel').hidden = false;
    render();
  }

  async function isAdmin() {
    const { data, error } = await sb.rpc('is_admin');
    if (error) throw error;
    return data === true;
  }

  const loginForm = $('#loginForm');
  const forgotForm = $('#forgotForm');
  clearOnInput(loginForm, $('#loginMsg'));
  clearOnInput(forgotForm, $('#forgotMsg'));

  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (!requireFields(loginForm, ['email', 'password'])) return;
    busy(loginForm, true);
    try {
      const { data, error } = await sb.auth.signInWithPassword({
        email: loginForm.email.value.trim(),
        password: loginForm.password.value,
      });
      if (error) { $('#loginMsg').textContent = authErrorAr(error); return; }
      if (!(await isAdmin())) {
        await sb.auth.signOut();
        $('#loginMsg').textContent = 'هالحساب ما إله صلاحية على لوحة التحكم.';
        return;
      }
      loginForm.password.value = '';
      showPanel(data.user);
    } catch (err) {
      $('#loginMsg').textContent = authErrorAr(err);
    } finally {
      busy(loginForm, false);
    }
  });

  // نسيت كلمة السر
  function showForgot(on) {
    loginForm.hidden = on;
    forgotForm.hidden = !on;
    if (on) forgotForm.email.value = loginForm.email.value;
  }
  $('#forgotLink').addEventListener('click', () => showForgot(true));
  $('#backLink').addEventListener('click', () => showForgot(false));

  forgotForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (!requireFields(forgotForm, ['email'])) return;
    busy(forgotForm, true);
    // الرابط بالإيميل بيرجع على reset.html بنفس مكان هالصفحة (Live Server أو الدومين)
    const redirectTo = new URL('reset.html', location.href).href;
    const { error } = await sb.auth.resetPasswordForEmail(forgotForm.email.value.trim(), { redirectTo });
    busy(forgotForm, false);
    const msg = $('#forgotMsg');
    if (error) { msg.textContent = authErrorAr(error); return; }
    // نفس الرسالة سواء الإيميل موجود أو لأ، لحتى ما نكشف مين عنده حساب
    msg.classList.add('ok');
    msg.textContent = 'إذا الإيميل مسجّل عنا، رح يوصلك رابط خلال دقايق. شيّك كمان على الـ Spam.';
  });

  // حسابي: تغيير كلمة السر وتسجيل الخروج (بيفتح من شاشة الإعدادات)
  function openAccount() {
    const sheet = openSheet(`
      <div class="sheet-head"><h2>حسابي</h2><button class="close" aria-label="إغلاق">×</button></div>
      <p class="muted-line">داخل بـ <bdi dir="ltr">${escapeHTML(user.email)}</bdi></p>
      <form id="pwForm" novalidate>
        <h3 class="sheet-sub">تغيير كلمة السر</h3>
        <label class="field" data-f="current">
          <span>كلمة السر الحالية</span>
          <input name="current" type="password" autocomplete="current-password" dir="ltr">
          <span class="err">اكتب كلمة السر الحالية.</span>
        </label>
        <label class="field" data-f="next">
          <span>كلمة السر الجديدة</span>
          <input name="next" type="password" autocomplete="new-password" dir="ltr">
          <span class="err">لازم تكون 8 أحرف وأكتر.</span>
        </label>
        <label class="field" data-f="confirm">
          <span>اكتب الجديدة مرة تانية</span>
          <input name="confirm" type="password" autocomplete="new-password" dir="ltr">
          <span class="err">الكلمتين مو متل بعض.</span>
        </label>
        <p class="form-msg" id="pwMsg" role="alert"></p>
        <button class="btn" type="submit">حفظ كلمة السر</button>
      </form>
      <button class="btn danger" type="button" id="logoutBtn" style="margin-top:24px">تسجيل خروج</button>
    `);

    const form = $('#pwForm', sheet);
    const msg = $('#pwMsg', sheet);
    clearOnInput(form, msg);

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const next = form.next.value;
      const okCurrent = requireFields(form, ['current']);
      const short = next.length < 8;
      const mismatch = next !== form.confirm.value;
      form.querySelector('[data-f="next"]').classList.toggle('invalid', short);
      form.querySelector('[data-f="confirm"]').classList.toggle('invalid', !short && mismatch);
      if (!okCurrent || short || mismatch) return;

      busy(form, true);
      try {
        // منتأكد من كلمة السر الحالية أول، لحتى ما حدا يغيّرها إذا لقى الموبايل مفتوح
        const check = await sb.auth.signInWithPassword({ email: user.email, password: form.current.value });
        if (check.error) {
          msg.textContent = check.error.code === 'invalid_credentials'
            ? 'كلمة السر الحالية غلط.' : authErrorAr(check.error);
          return;
        }
        const { error } = await sb.auth.updateUser({ password: next });
        if (error) { msg.textContent = authErrorAr(error); return; }
        closeSheet();
        toast('تغيّرت كلمة السر');
      } catch (err) {
        msg.textContent = authErrorAr(err);
      } finally {
        busy(form, false);
      }
    });

    $('#logoutBtn', sheet).addEventListener('click', async () => {
      await sb.auth.signOut();
      showGate();
    });
  }

  // أول ما تفتح الصفحة: إذا في جلسة محفوظة وصاحبها أدمن، منفتح اللوحة دغري
  async function boot() {
    if (!sb) {
      $('#booting').textContent = 'اللوحة مو مربوطة بـ Supabase. شيّك على config.js.';
      return;
    }
    // إذا انتهت الجلسة أو انعمل خروج من مكان تاني
    sb.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT' && user) showGate();
    });
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (session && await isAdmin()) showPanel(session.user);
      else {
        if (session) await sb.auth.signOut();
        showGate();
      }
    } catch (err) {
      showGate();
      $('#loginMsg').textContent = authErrorAr(err);
    }
  }
  // منستنى ملفات الشاشات تنحمّل كلها قبل ما نبلّش
  document.addEventListener('DOMContentLoaded', boot);

  // الـ service worker هو اللي بيستقبل الإشعارات
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(err => console.warn(err));

  return {
    $, $$, state, views, icon, countAr, num, db, fail, toast,
    openSheet, closeSheet, confirmTwice, clearOnInput, requireFields, busy,
    resizeImage, uploadImage, removeImages, thumb,
    render, refreshHead, openAccount,
    get user() { return user; },
  };
})();
