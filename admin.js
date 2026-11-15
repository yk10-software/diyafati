/* =========================================================
   ضيافتي — لوحة التحكم: الأساس
   هون: تسجيل الدخول، والتنقل بين الشاشات، وتحميل البيانات من Supabase،
   وأدوات مشتركة (نوافذ، إشعارات، صور).
   كل شاشة بملف لحالها:
     admin-home.js       الرئيسية
     admin-orders.js     الطلبات
     admin-coupons.js    الكوبونات
     admin-products.js   الأصناف
     admin-categories.js الأقسام
     admin-hero.js       فيديوهات أول الصفحة (تحت الأقسام)
     admin-stories.js    القصص (تحت الأقسام)
     admin-reviews.js    التقييمات
     admin-help.js       المساعدة
     admin-settings.js   الإعدادات (التوصيل، الدفع، الطلبات)
   الملفات بتتشارك بالكائن `A`.
   ========================================================= */
const A = (() => {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // كل بيانات المحل بعد التحميل
  const state = { settings: null, cats: [], products: [], zones: [], accounts: [], coupons: [], stories: [], heroVideos: [], reviewStamps: [], orders: [] };
  const views = {};          // كل ملف شاشة بيسجّل حاله هون
  let user = null;
  let liveStarted = false;   // الـ realtime للطلبات بيشتغل مرة وحدة

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
  // آخر 300 طلب مع أصنافها. شاشة الرئيسية كمان بتحسب منهن أرقامها
  const loadOrders = () => db(sb.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).limit(300));

  // بس التواريخ، لرقم «جديد» بالرئيسية. التقييمات نفسها بتنحمّل بشاشتها
  const loadReviewStamps = () => db(sb.from('reviews').select('created_at').order('created_at', { ascending: false }).limit(200));

  async function loadAll() {
    const [settings, cats, products, zones, accounts, coupons, stories, heroVideos, reviewStamps, orders] = await Promise.all([
      db(sb.from('settings').select('*').eq('id', 1).single()),
      db(sb.from('categories').select('*').order('sort_order').order('id')),
      db(sb.from('products').select('*').order('id', { ascending: false })),
      db(sb.from('delivery_zones').select('*').order('sort_order').order('id')),
      db(sb.from('payment_accounts').select('*').order('sort_order').order('id')),
      db(sb.from('coupons').select('*').order('created_at', { ascending: false })),
      db(sb.from('stories').select('*, story_items(*)').order('sort_order').order('id')),
      db(sb.from('hero_videos').select('*').order('sort_order').order('id')),
      loadReviewStamps(),
      loadOrders(),
    ]);
    Object.assign(state, { settings, cats, products, zones, accounts, coupons, stories, heroVideos, reviewStamps, orders });
  }

  /* ---------- التنقل بين الشاشات (#home، #orders، #products، #categories، #settings، #coupons، #reviews، #help) ---------- */
  function current() {
    const name = location.hash.slice(1);
    return views[name] ? name : 'home';
  }
  function render() {
    if (!user) return;
    const name = current();
    const view = views[name];
    $('#pTitle').textContent = view.title;
    refreshHead();
    $$('.a-nav button').forEach(b => b.setAttribute('aria-current', b.dataset.go === (view.parent || name) ? 'page' : 'false'));
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

  /* ---------- تاريخ انتهاء (كوبون أو خصم) ----------
     قائمة أيام بدل خانة التاريخ، لأن الخانة بتعرض أرقام عربية. */
  const dayKey = date => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Damascus' }).format(date);
  const dayName = date => date.toLocaleDateString('ar-SY-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Damascus' });

  function expiryOptions(iso) {
    const chosen = iso ? dayKey(new Date(iso)) : '';
    const days = Array.from({ length: 180 }, (_, i) => dayKey(new Date(Date.now() + i * 86400000)));
    if (chosen && !days.includes(chosen)) days.unshift(chosen);
    return '<option value="">بلا تاريخ انتهاء</option>' + days.map(d =>
      `<option value="${d}" ${d === chosen ? 'selected' : ''}>${dayName(new Date(`${d}T12:00:00+03:00`))}</option>`).join('');
  }
  // لآخر الليل بتوقيت دمشق
  const endOfDay = day => (day ? `${day}T23:59:59+03:00` : null);

  /* ---------- الصور ----------
     منصغّر الصورة بالمتصفح لـ 1280px قبل الرفع، وبترتفع على سطل images. */
  const BUCKET = 'images';

  function resizeImage(file, max = 1280) {
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

  // اسم عشوائي للملف. randomUUID بتشتغل بس على https أو localhost،
  // فإذا فتحت اللوحة من الموبايل على IP اللابتوب منستعمل البديل
  const newId = () => (crypto.randomUUID ? crypto.randomUUID()
    : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10));

  // small: نسخة 480px بنفس الاسم وآخرها -sm (لصور الأصناف). إذا فشلت، منشيل الكبيرة كمان
  async function uploadImage(blob, folder, small) {
    const id = newId();
    const path = `${folder}/${id}.jpg`;
    const opts = { contentType: 'image/jpeg', cacheControl: '31536000' };
    await db(sb.storage.from(BUCKET).upload(path, blob, opts));
    if (small) {
      try { await db(sb.storage.from(BUCKET).upload(`${folder}/${id}-sm.jpg`, small, opts)); }
      catch (err) { await sb.storage.from(BUCKET).remove([path]); throw err; }
    }
    return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  // بيحذف الصور من السطل (بس اللي إلنا، مش صور img/ تبع الموقع)
  async function removeImages(urls) {
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const paths = urls.filter(u => u && u.includes(marker)).map(u => decodeURIComponent(u.split(marker)[1]));
    // صور الأصناف إلها نسخة صغيرة، منحذفها معها (إذا مو موجودة، الحذف ما بيعطي خطأ)
    paths.push(...paths.filter(p => p.startsWith('products/')).map(p => p.replace(/(\.[a-z0-9]+)$/i, '-sm$1')));
    if (!paths.length) return;
    try { await db(sb.storage.from(BUCKET).remove(paths)); }
    catch (err) { console.warn('ما قدرنا نحذف صور قديمة', err); }   // مو مشكلة كبيرة، بتضل بالسطل
  }

  /* ---------- الفيديو (للقصص) ----------
     قبل الرفع منتأكد من 3 شغلات: الحجم، والطول، وإنو الفيديو H.264.
     فيديو الآيفون العادي (HEVC) بيشتغل على الآيفون بس، وما بيشتغل
     عند كتير من زباين الأندرويد، فمنرفضه ومنقول لصاحب المحل شو يعمل.
     ومن الفيديو منطلّع صورة غلاف بتبيّن بالقوس وقبل ما يحمّل الفيديو. */
  const VIDEO_BUCKET = 'videos';
  const VIDEO_MAX_MB = 10;    // نفس حد السطل بـ 17_story_videos.sql
  const VIDEO_MAX_SEC = 60;

  // منقرأ نوع الضغط من الملف نفسه، من صندوق moov تبع MP4 (بلا مكتبات)
  function videoCodec(buf) {
    const dv = new DataView(buf);
    const len = buf.byteLength;
    let off = 0;
    let moov = null;
    while (off + 8 <= len) {
      let size = dv.getUint32(off);
      const type = String.fromCharCode(dv.getUint8(off + 4), dv.getUint8(off + 5), dv.getUint8(off + 6), dv.getUint8(off + 7));
      let head = 8;
      if (size === 1) {                      // حجم كبير بـ 64 بت
        if (off + 16 > len) break;
        size = dv.getUint32(off + 8) * 2 ** 32 + dv.getUint32(off + 12);
        head = 16;
      } else if (size === 0) size = len - off;   // للآخر
      if (size < head) break;
      if (type === 'moov') { moov = new Uint8Array(buf, off + head, Math.min(len, off + size) - off - head); break; }
      off += size;
    }
    if (!moov) return null;
    const codes = { avc1: 'h264', avc3: 'h264', hvc1: 'hevc', hev1: 'hevc' };
    const found = new Set();
    for (let i = 0; i + 4 <= moov.length; i++) {
      const c = String.fromCharCode(moov[i], moov[i + 1], moov[i + 2], moov[i + 3]);
      if (codes[c]) found.add(codes[c]);
    }
    if (found.has('hevc')) return 'hevc';
    if (found.has('h264')) return 'h264';
    return 'other';
  }

  // بيستنى حدث وحدة مرة، وبيفشل إذا صار خطأ أو طوّل
  function once(el, ev, ms) {
    return new Promise((resolve, reject) => {
      const done = ok => () => { clearTimeout(t); el.removeEventListener(ev, yes); el.removeEventListener('error', no); ok(); };
      const yes = done(resolve);
      const no = done(() => reject(new Error('video error')));
      const t = setTimeout(() => { el.removeEventListener(ev, yes); el.removeEventListener('error', no); reject(new Error('timeout')); }, ms);
      el.addEventListener(ev, yes);
      el.addEventListener('error', no);
    });
  }

  function canvasJpeg(c) {
    return new Promise((resolve, reject) =>
      c.toBlob(b => (b ? resolve(b) : reject(new Error('bad frame'))), 'image/jpeg', 0.8));
  }

  // غلاف احتياطي إذا الموبايل ما عطانا لقطة: لون الكاكاو ومثلث تشغيل زبدي
  function fallbackPoster() {
    const c = document.createElement('canvas');
    c.width = 720;
    c.height = 900;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#5D3E22';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#F9F7A4';
    ctx.beginPath();
    ctx.moveTo(310, 380);
    ctx.lineTo(310, 520);
    ctx.lineTo(430, 450);
    ctx.closePath();
    ctx.fill();
    return canvasJpeg(c);
  }

  // بيرجّع { duration, poster } أو بيرمي خطأ رسالته وحدة من: big, hevc, format, long
  async function prepareVideo(file) {
    if (file.size > VIDEO_MAX_MB * 1048576) throw new Error('big');
    const codec = videoCodec(await file.arrayBuffer());
    if (codec === 'hevc') throw new Error('hevc');
    if (codec !== 'h264') throw new Error('format');

    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.preload = 'auto';
    try {
      v.src = url;
      try { await once(v, 'loadedmetadata', 10000); }
      catch (err) { throw new Error('format'); }
      const duration = v.duration;
      if (!isFinite(duration) || duration <= 0) throw new Error('format');
      if (duration > VIDEO_MAX_SEC + 0.5) throw new Error('long');

      let poster = null;
      try {
        // الآيفون أحياناً ما بيرسم لقطة قبل ما يشتغل الفيديو، فمنشغّله لحظة ومنوقفه
        try {
          await Promise.race([v.play(), new Promise((_, no) => setTimeout(() => no(new Error('slow')), 3000))]);
        } catch (err) { /* مو ضروري */ }
        v.pause();
        v.currentTime = Math.min(0.5, duration / 3);
        await once(v, 'seeked', 6000);
        if (v.videoWidth) {
          const r = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
          const c = document.createElement('canvas');
          c.width = Math.round(v.videoWidth * r);
          c.height = Math.round(v.videoHeight * r);
          c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
          poster = await canvasJpeg(c);
        }
      } catch (err) { console.warn('ما قدرنا ناخد لقطة من الفيديو', err); }
      if (!poster) poster = await fallbackPoster();
      return { duration: Math.round(duration), poster };
    } finally {
      v.removeAttribute('src');
      v.load();
      URL.revokeObjectURL(url);
    }
  }

  // دايماً منرفعه كـ MP4: فيديو H.264 من الآيفون (mov) بيشتغل كـ MP4 عادي
  async function uploadVideo(file, folder) {
    const path = `${folder}/${newId()}.mp4`;
    await db(sb.storage.from(VIDEO_BUCKET).upload(path, file, { contentType: 'video/mp4', cacheControl: '31536000' }));
    return sb.storage.from(VIDEO_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  async function removeVideos(urls) {
    const marker = `/storage/v1/object/public/${VIDEO_BUCKET}/`;
    const paths = urls.filter(u => u && u.includes(marker)).map(u => decodeURIComponent(u.split(marker)[1]));
    if (!paths.length) return;
    try { await db(sb.storage.from(VIDEO_BUCKET).remove(paths)); }
    catch (err) { console.warn('ما قدرنا نحذف فيديو قديم', err); }
  }

  // الصنف اللي ما إله صورة: كرت بهوية ضيافتي (قوس زبدي ولوغو)
  function thumb(src, cls = '') {
    return src
      ? smallImg(src, `class="${cls}" alt="" loading="lazy"`)
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
    if (!liveStarted && api.ordersLive) { liveStarted = true; api.ordersLive(); }
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

  const api = {
    $, $$, state, views, icon, countAr, num, db, fail, toast, loadOrders, loadReviewStamps,
    openSheet, closeSheet, confirmTwice, clearOnInput, requireFields, busy,
    resizeImage, uploadImage, removeImages, thumb, dayName, expiryOptions, endOfDay,
    prepareVideo, uploadVideo, removeVideos, VIDEO_MAX_MB, VIDEO_MAX_SEC,
    render, refreshHead, openAccount, current,
    get user() { return user; },
  };
  return api;
})();
