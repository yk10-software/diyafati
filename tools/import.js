/* =========================================================
   ضيافتي — إدخال الأصناف من حزمة zip
   بتشتغل من Live Server بس، وبتدخل بحساب الأدمن (RLS)،
   وما فيها ولا بتحتاج أي مفتاح سري.
   الخطوات: دخول، اختيار الحزمة، مراجعة وتعديل، إدخال، ملخص.
   لو انعاد التشغيل، القسم أو الصنف بنفس الاسم ما بيتكرر.
   ========================================================= */
(() => {
  'use strict';

  const $ = s => document.querySelector(s);
  const BUCKET = 'images';
  const UNITS = ['كيلو', 'قطعة', 'علبة', 'باقة'];

  // اللي بيضيفه 04_seed.sql: هدول بس بينعدّوا «نسخة تجريبية»
  const DEMO_CATS = ['ضيافة مواليد', 'شوكولا', 'ملبس', 'أزهار'];
  const DEMO_PRODUCTS = ['هريسة لوز بيبي صبي', 'هريسة لوز بيبي بنت', 'شوكولا ضيافتي ميكس', 'شوكولا ضيافتي ويفر باللوتس', 'ملبس مطبوع خاص'];

  let pack = null;   // { cats, products }
  let db_ = { cats: [], products: [], items: [] };
  const demo = { on: false, cats: new Set(), products: new Set() };

  const show = (...ids) => ['login', 'pick', 'review', 'progress', 'done'].forEach(id => { $('#' + id).hidden = !ids.includes(id); });
  const status = text => { $('#status').textContent = text; };
  const norm = s => String(s ?? '').trim().replace(/\s+/g, ' ');

  // بيقرأ رقم، وبيقبل الأرقام العربية والفواصل. فاضي ← null
  function readNum(str) {
    const s = String(str ?? '').trim()
      .replace(/[٠-٩]/g, d => d.charCodeAt(0) - 0x0660)
      .replace(/[۰-۹]/g, d => d.charCodeAt(0) - 0x06F0)
      .replace(/[,\s٬]/g, '');
    return s === '' ? null : Number(s);
  }
  const positiveInt = n => Number.isInteger(n) && n > 0;

  async function q(query) {
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  /* ---------- الدخول ---------- */
  async function isAdmin() {
    const { data, error } = await sb.rpc('is_admin');
    if (error) throw error;
    return data === true;
  }

  async function enter() {
    $('#logout').hidden = false;
    status('اختار ملف الأصناف.');
    show('pick');
  }

  async function boot() {
    if (!['localhost', '127.0.0.1'].includes(location.hostname)) {
      status('هالصفحة بتشتغل من Live Server بس.');
      show();
      return;
    }
    if (!sb) { status('Supabase مو مضبوط: شيّك على config.js.'); show(); return; }
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (session && await isAdmin()) return enter();
      if (session) await sb.auth.signOut();
    } catch (err) { console.warn(err); }
    status('سجّل دخول بحساب الأدمن.');
    show('login');
  }

  $('#login').addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.target;
    const msg = $('#loginMsg');
    msg.textContent = '';
    const btn = form.querySelector('button');
    btn.disabled = true;
    try {
      const { error } = await sb.auth.signInWithPassword({
        email: form.elements.email.value.trim(), password: form.elements.password.value,
      });
      if (error) { msg.textContent = authErrorAr(error); return; }
      if (!(await isAdmin())) {
        await sb.auth.signOut();
        msg.textContent = 'هالحساب ما إله صلاحية.';
        return;
      }
      form.elements.password.value = '';
      enter();
    } catch (err) { msg.textContent = authErrorAr(err); }
    finally { btn.disabled = false; }
  });

  $('#logout').addEventListener('click', async () => {
    await sb.auth.signOut();
    location.reload();
  });

  /* ---------- قراءة الحزمة ---------- */
  const TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
  const typeOf = path => TYPES[path.split('.').pop().toLowerCase()] || 'image/jpeg';

  async function loadPic(zip, base, path) {
    const entry = zip.file(base + path);
    if (!entry) return null;
    const type = typeOf(path);
    const blob = new Blob([await entry.async('arraybuffer')], { type });
    return { blob, url: URL.createObjectURL(blob), ext: path.split('.').pop().toLowerCase() };
  }

  async function readZip(file) {
    const zip = await JSZip.loadAsync(file);
    const paths = Object.keys(zip.files).filter(p => /(^|\/)products\.json$/.test(p) && !p.startsWith('__MACOSX'));
    if (!paths.length) throw new Error('ما لقينا products.json جوا الملف.');
    const path = paths.sort((a, b) => a.length - b.length)[0];
    const base = path.slice(0, path.length - 'products.json'.length);
    const data = JSON.parse(await zip.file(path).async('string'));
    if (!Array.isArray(data.categories) || !Array.isArray(data.products)) throw new Error('products.json ناقص.');

    const cats = [];
    for (const c of data.categories) {
      cats.push({
        key: c.key, name: norm(c.name), sort_order: c.sort_order ?? cats.length + 1,
        flags: [...(c.flags || [])], pic: c.image ? await loadPic(zip, base, c.image) : null,
      });
    }

    const products = [];
    for (const [i, p] of data.products.entries()) {
      status(`عم نقرأ الصور... ${i + 1} من ${data.products.length}`);
      const flags = [...(p.flags || [])];
      const pics = [];
      for (const img of p.images || []) {
        const pic = await loadPic(zip, base, img);
        if (pic) pics.push(pic); else flags.push(`صورة ناقصة بالملف: ${img}`);
      }
      products.push({
        cat: p.category, name: norm(p.name), description: norm(p.description), price: p.price ?? '',
        pieces: p.pieces_per_kg ?? '', unit: UNITS.includes(p.unit) ? p.unit : 'كيلو',
        note: p.custom_note_label || null, sort_order: p.sort_order ?? i + 1, flags, pics, skip: false,
      });
    }
    return { cats, products };
  }

  async function loadDb() {
    const [cats, products, items] = await Promise.all([
      q(sb.from('categories').select('*')),
      q(sb.from('products').select('*')),
      q(sb.from('story_items').select('*')),
    ]);
    db_ = { cats, products, items };
    // التجريبي: نفس الاسم، وصوره لسا من مجلد img تبع الموقع، مو مرفوعة
    const demoProducts = products.filter(p => DEMO_PRODUCTS.includes(p.name) && p.images.every(u => u.startsWith('img/')));
    demo.products = new Set(demoProducts.map(p => p.id));
    demo.cats = new Set(cats.filter(c => DEMO_CATS.includes(c.name)).map(c => c.id));
  }

  $('#zip').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const msg = $('#zipMsg');
    msg.textContent = '';
    try {
      status('عم نقرأ الملف...');
      pack = await readZip(file);
      await loadDb();
      renderReview();
      show('review');
      status('راجع الأصناف، وعدّل اللي بدك ياه، وبعدها اكبس الإدخال.');
    } catch (err) {
      console.error(err);
      msg.textContent = err.message && /[؀-ۿ]/.test(err.message) ? err.message : 'ما قدرنا نقرأ الملف، أو الاتصال ضعيف.';
      status('اختار ملف الأصناف.');
    }
  });

  /* ---------- المراجعة ---------- */
  const existsCat = name => db_.cats.some(c => norm(c.name) === norm(name));
  const existsProduct = name => db_.products.some(p => norm(p.name) === norm(name) && !(demo.on && demo.products.has(p.id)));
  const flagsHTML = list => list.map(f => `<span class="flag">${escapeHTML(f)}</span>`).join('');

  function priceProblem(p) {
    const n = readNum(p.price);
    if (n === null) return 'بدو سعر';
    return positiveInt(n) ? '' : 'السعر غلط';
  }
  function piecesProblem(p) {
    const n = readNum(p.pieces);
    return n === null || positiveInt(n) ? '' : 'العدد غلط';
  }
  const ready = p => !p.skip && p.name && !priceProblem(p) && !piecesProblem(p) && !existsProduct(p.name);

  function renderCats() {
    $('#cats').innerHTML = `
      <tr><th>الصورة</th><th>اسم القسم</th><th>الترتيب</th><th>ملاحظات</th></tr>
      ${pack.cats.map((c, i) => `
        <tr class="${c.flags.length ? 'warn' : ''}">
          <td>
            <div class="imp-pics">
              ${c.pic ? `<div class="imp-pic"><img src="${c.pic.url}" alt=""><button type="button" data-cat-rm="${i}" aria-label="شيل الصورة">×</button></div>` : `<label class="imp-add">+<input type="file" accept="image/*" hidden data-cat-file="${i}"></label>`}
            </div>
          </td>
          <td><input type="text" data-cat-name="${i}" value="${escapeHTML(c.name)}" aria-label="اسم القسم"></td>
          <td>${escapeHTML(c.sort_order)}</td>
          <td>${flagsHTML(c.flags)}${existsCat(c.name) ? '<span class="ok">موجود، ما رح يتكرر</span>' : ''}</td>
        </tr>`).join('')}`;
  }

  function renderDemo() {
    const prods = db_.products.filter(p => demo.products.has(p.id));
    const cats = db_.cats.filter(c => demo.cats.has(c.id));
    const old = db_.items.filter(i => i.image.startsWith('img/')).length;
    $('#demo').innerHTML = `
      <div class="imp-demo">
        <label class="check"><input type="checkbox" id="demoOn" ${demo.on ? 'checked' : ''}> احذف أصناف وأقسام النسخة التجريبية أول</label>
        ${prods.length || cats.length ? `
          <ul ${demo.on ? '' : 'hidden'}>
            ${prods.map(p => `<li><label><input type="checkbox" data-demo-p="${p.id}" checked> صنف: ${escapeHTML(p.name)}</label></li>`).join('')}
            ${cats.map(c => `<li><label><input type="checkbox" data-demo-c="${c.id}" checked> قسم: ${escapeHTML(c.name)}</label></li>`).join('')}
          </ul>
          <p class="caption" ${demo.on ? '' : 'hidden'}>بينحذف كمان ${old} ${old === 1 ? 'صورة قصة قديمة' : 'صور قصص قديمة'} من مجلد img. القصة اللي صورتها مرفوعة بتضل، وبترجع تنربط بالصنف الجديد إذا إله نفس الاسم. والقسم اللي فيه صنف تاني ما بينحذف، والقسم اللي بالحزمة بيضل.</p>
        ` : '<p class="caption">ما لقينا شي من النسخة التجريبية.</p>'}
      </div>`;
  }

  function productRow(p, i) {
    const dup = existsProduct(p.name);
    const need = priceProblem(p);
    const bad = piecesProblem(p);
    const cls = [p.flags.length ? 'warn' : '', p.skip || dup ? 'off' : '', need ? 'need' : ''].join(' ');
    return `
      <tr class="${cls}" data-row="${i}">
        <td>
          <div class="imp-pics">
            ${p.pics.map((pic, k) => `<div class="imp-pic"><img src="${pic.url}" alt="" data-first="${k}" title="خليها الأولى"><button type="button" data-rm="${k}" aria-label="شيل الصورة">×</button></div>`).join('')}
            <label class="imp-add">+<input type="file" accept="image/*" hidden data-file></label>
          </div>
        </td>
        <td><input type="text" data-f="name" value="${escapeHTML(p.name)}" aria-label="الاسم"></td>
        <td><textarea data-f="description" aria-label="الوصف">${escapeHTML(p.description)}</textarea></td>
        <td><input type="text" class="num price" data-f="price" inputmode="numeric" dir="ltr" value="${escapeHTML(p.price)}" aria-label="السعر"><div class="bad" data-msg="price">${need}</div></td>
        <td><input type="text" class="num" data-f="pieces" inputmode="numeric" dir="ltr" value="${escapeHTML(p.pieces)}" aria-label="عدد الحبات"><div class="bad" data-msg="pieces">${bad}</div></td>
        <td><select data-f="cat" aria-label="القسم">${pack.cats.map(c => `<option value="${escapeHTML(c.key)}" ${c.key === p.cat ? 'selected' : ''}>${escapeHTML(c.name)}</option>`).join('')}</select></td>
        <td>${flagsHTML(p.flags)}${dup ? '<span class="ok">موجود، ما رح يتكرر</span>' : ''}</td>
        <td><button class="skip" type="button" data-skip>${p.skip ? 'رجّعه' : 'تجاهل'}</button></td>
      </tr>`;
  }

  function renderProducts() {
    $('#prods').innerHTML = `
      <tr><th>الصور</th><th>الاسم</th><th>الوصف</th><th>السعر</th><th>العدد بالكيلو</th><th>القسم</th><th>ملاحظات</th><th></th></tr>
      ${pack.products.map(productRow).join('')}`;
  }

  function refreshSum() {
    const ps = pack.products;
    const go = ps.filter(ready).length;
    const noPrice = ps.filter(p => !p.skip && priceProblem(p) && !existsProduct(p.name)).length;
    const flagged = ps.filter(p => p.flags.length).length;
    const skipped = ps.filter(p => p.skip).length;
    const dups = ps.filter(p => !p.skip && existsProduct(p.name)).length;
    $('#sum').textContent = `${ps.length} صنف بـ${pack.cats.length} أقسام: ${go} جاهز، ${noPrice} بلا سعر صحيح، ${flagged} عليه ملاحظات، ${skipped} متجاهل، ${dups} موجود من قبل.`;
    $('#run').textContent = go ? `أدخل ${go} صنف` : 'ما في أصناف جاهزة';
    $('#run').disabled = !go && !pack.cats.some(c => !existsCat(c.name));
    armed = false;
  }

  function renderReview() {
    renderCats();
    renderDemo();
    renderProducts();
    refreshSum();
  }

  // خانات الصنف: منحدّث البيانات بلا إعادة رسم، لحتى ما يضيع المؤشر
  $('#prods').addEventListener('input', e => {
    const row = e.target.closest('[data-row]');
    const f = e.target.dataset.f;
    if (!row || !f) return;
    const p = pack.products[Number(row.dataset.row)];
    p[f] = e.target.value;
    row.querySelector('[data-msg="price"]').textContent = priceProblem(p);
    row.querySelector('[data-msg="pieces"]').textContent = piecesProblem(p);
    row.classList.toggle('need', !!priceProblem(p));
    refreshSum();
  });

  $('#prods').addEventListener('click', e => {
    const row = e.target.closest('[data-row]');
    if (!row) return;
    const p = pack.products[Number(row.dataset.row)];
    const rm = e.target.closest('[data-rm]');
    const first = e.target.closest('[data-first]');
    if (rm) p.pics.splice(Number(rm.dataset.rm), 1);
    else if (first) p.pics.unshift(...p.pics.splice(Number(first.dataset.first), 1));
    else if (e.target.closest('[data-skip]')) p.skip = !p.skip;
    else return;
    row.outerHTML = productRow(p, Number(row.dataset.row));
    refreshSum();
  });

  // صورة من الجهاز: منصغّرها لـ 900px متل اللوحة
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
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(b => (b ? resolve({ blob: b, url: URL.createObjectURL(b), ext: 'jpg' }) : reject(new Error('bad image'))), 'image/jpeg', 0.8);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
      img.src = url;
    });
  }

  $('#prods').addEventListener('change', async e => {
    if (e.target.dataset.file === undefined || !e.target.files[0]) return;
    const row = e.target.closest('[data-row]');
    const i = Number(row.dataset.row);
    try {
      pack.products[i].pics.push(await resizeImage(e.target.files[0]));
      row.outerHTML = productRow(pack.products[i], i);
    } catch (err) { console.warn(err); }
  });

  $('#cats').addEventListener('input', e => {
    const i = e.target.dataset.catName;
    if (i === undefined) return;
    pack.cats[Number(i)].name = norm(e.target.value);
  });
  $('#cats').addEventListener('change', async e => {
    if (e.target.dataset.catName !== undefined) { renderReview(); return; }
    const i = e.target.dataset.catFile;
    if (i === undefined || !e.target.files[0]) return;
    try {
      pack.cats[Number(i)].pic = await resizeImage(e.target.files[0]);
      renderCats();
    } catch (err) { console.warn(err); }
  });
  $('#cats').addEventListener('click', e => {
    const b = e.target.closest('[data-cat-rm]');
    if (!b) return;
    pack.cats[Number(b.dataset.catRm)].pic = null;
    renderCats();
  });

  $('#demo').addEventListener('change', e => {
    if (e.target.id === 'demoOn') {
      demo.on = e.target.checked;
      renderDemo();
      renderProducts();
      refreshSum();
      return;
    }
    const p = e.target.dataset.demoP;
    const c = e.target.dataset.demoC;
    if (p) { demo.products[e.target.checked ? 'add' : 'delete'](Number(p)); renderProducts(); refreshSum(); }
    if (c) demo.cats[e.target.checked ? 'add' : 'delete'](Number(c));
  });

  /* ---------- الإدخال ---------- */
  async function upload(pic, folder) {
    const path = `${folder}/${crypto.randomUUID()}.${pic.ext === 'jpeg' ? 'jpg' : pic.ext}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, pic.blob, { contentType: pic.blob.type, cacheControl: '31536000' });
    if (error) throw error;
    return { path, url: sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
  }
  async function unupload(paths) {
    if (!paths.length) return;
    try { await sb.storage.from(BUCKET).remove(paths); }
    catch (err) { console.warn('ما انحذفت صور', err); }
  }

  // بيحذف التجريبي، وبيرجّع القصص المرفوعة اللي لازم ترجع تنربط بصنف نفس الاسم
  async function removeDemo(report) {
    const importing = new Set(pack.cats.map(c => norm(c.name)));
    const relink = db_.items
      .filter(i => demo.products.has(i.product_id) && !i.image.startsWith('img/'))
      .map(i => ({ id: i.id, name: db_.products.find(p => p.id === i.product_id).name }));

    // صور القصص القديمة، والقصة اللي بتفضى بتنحذف
    const oldItems = db_.items.filter(i => i.image.startsWith('img/'));
    for (const it of oldItems) await q(sb.from('story_items').delete().eq('id', it.id));
    report.stories = oldItems.length;
    const left = new Set(db_.items.filter(i => !i.image.startsWith('img/')).map(i => i.story_id));
    for (const id of new Set(oldItems.map(i => i.story_id))) {
      if (!left.has(id)) await q(sb.from('stories').delete().eq('id', id));
    }

    for (const id of demo.products) {
      await q(sb.from('products').delete().eq('id', id));
      report.demoProducts++;
    }
    const still = await q(sb.from('products').select('*'));
    for (const id of demo.cats) {
      const c = db_.cats.find(x => x.id === id);
      if (importing.has(norm(c.name))) continue;
      if (still.some(p => p.category_id === id)) { report.keptCats.push(c.name); continue; }
      await q(sb.from('categories').delete().eq('id', id));
      report.demoCats++;
    }
    return relink;
  }

  async function runImport() {
    const ps = pack.products;
    const todo = ps.filter(ready);
    const report = {
      catsAdded: 0, catsKept: 0, added: 0, exists: 0, skipped: 0, noPrice: 0, failed: [],
      demoProducts: 0, demoCats: 0, stories: 0, relinked: 0, keptCats: [],
    };
    report.skipped = ps.filter(p => p.skip).length;
    report.noPrice = ps.filter(p => !p.skip && p.name && (priceProblem(p) || piecesProblem(p)) && !existsProduct(p.name)).length;
    report.exists = ps.filter(p => !p.skip && existsProduct(p.name)).length;

    const total = pack.cats.length + todo.length + (demo.on ? 1 : 0);
    let doneSteps = 0;
    const tick = text => {
      doneSteps++;
      $('#bar').style.width = `${Math.round(doneSteps / total * 100)}%`;
      $('#step').textContent = text;
    };

    show('progress');
    let relink = [];
    if (demo.on) {
      try { relink = await removeDemo(report); }
      catch (err) { console.error(err); report.failed.push({ name: 'حذف النسخة التجريبية', why: err.message }); }
      tick('خلص حذف النسخة التجريبية');
    }

    // منقرأ من جديد، لحتى ما يتكرر شي إذا تغيّرت القاعدة وقت المراجعة
    await loadDbFresh();

    const catId = {};
    for (const c of pack.cats) {
      const found = db_.cats.find(x => norm(x.name) === norm(c.name));
      try {
        if (found) {
          catId[c.key] = found.id;
          report.catsKept++;
          const patch = {};
          if (demo.on && DEMO_CATS.includes(found.name)) patch.sort_order = c.sort_order;
          if (!found.image && c.pic) patch.image = (await upload(c.pic, 'categories')).url;
          if (Object.keys(patch).length) await q(sb.from('categories').update(patch).eq('id', found.id));
        } else {
          const image = c.pic ? (await upload(c.pic, 'categories')).url : null;
          const saved = await q(sb.from('categories').insert({ name: c.name, sort_order: c.sort_order, image }).select().single());
          catId[c.key] = saved.id;
          db_.cats.push(saved);
          report.catsAdded++;
        }
      } catch (err) {
        console.error(err);
        report.failed.push({ name: `قسم ${c.name}`, why: err.message });
      }
      tick(`قسم: ${c.name}`);
    }

    const fresh = new Set(db_.products.map(p => norm(p.name)));
    const newIds = {};
    for (const p of todo) {
      const uploaded = [];
      try {
        if (fresh.has(norm(p.name))) { report.exists++; tick(p.name); continue; }
        if (catId[p.cat] === undefined) throw new Error('القسم ما انضاف');
        const urls = [];
        for (const pic of p.pics) {
          const up = await upload(pic, 'products');
          uploaded.push(up.path);
          urls.push(up.url);
        }
        const pieces = p.unit === 'كيلو' ? readNum(p.pieces) : null;
        const saved = await q(sb.from('products').insert({
          category_id: catId[p.cat], name: norm(p.name), description: norm(p.description),
          price: readNum(p.price), unit: p.unit, pieces_per_kg: pieces, images: urls,
          custom_note_label: p.note, sort_order: p.sort_order,
        }).select().single());
        fresh.add(norm(p.name));
        newIds[norm(p.name)] = saved.id;
        report.added++;
      } catch (err) {
        console.error(err);
        await unupload(uploaded);   // ما في داعي تضل صور لصنف ما انضاف
        report.failed.push({ name: p.name, why: err.message });
      }
      tick(p.name);
    }

    for (const r of relink) {
      const id = newIds[norm(r.name)];
      if (!id) continue;
      try {
        await q(sb.from('story_items').update({ product_id: id }).eq('id', r.id));
        report.relinked++;
      } catch (err) { report.failed.push({ name: `ربط قصة بـ ${r.name}`, why: err.message }); }
    }
    return report;
  }

  async function loadDbFresh() {
    const [cats, products] = await Promise.all([q(sb.from('categories').select('*')), q(sb.from('products').select('*'))]);
    db_.cats = cats;
    db_.products = products;
  }

  function showReport(r) {
    const line = (text, n) => (n ? `<li>${text}: ${n}</li>` : '');
    $('#report').innerHTML = [
      line('انضاف من الأصناف', r.added),
      line('انضاف من الأقسام', r.catsAdded),
      line('أقسام موجودة من قبل', r.catsKept),
      line('أصناف موجودة، ما تكررت', r.exists),
      line('أصناف ما انضافت لأن سعرها ناقص أو في رقم غلط', r.noPrice),
      line('أصناف متجاهلة', r.skipped),
      line('انحذف من أصناف النسخة التجريبية', r.demoProducts),
      line('انحذف من أقسام النسخة التجريبية', r.demoCats),
      line('انحذف من صور القصص القديمة', r.stories),
      line('قصص رجعت انربطت بصنفها', r.relinked),
      r.keptCats.length ? `<li>أقسام تجريبية ما انحذفت لأن فيها أصناف: ${escapeHTML(r.keptCats.join('، '))}</li>` : '',
      ...r.failed.map(f => `<li class="bad">فشل: ${escapeHTML(f.name)} (${escapeHTML(f.why || 'خطأ')})</li>`),
    ].join('');
    $('#doneMsg').textContent = r.failed.length
      ? 'رجوع للمراجعة وإعادة الإدخال بتكمّل اللي فشل بس، وما بتكرر شي.' : '';
    show('done');
    status('خلص.');
  }

  let armed = false;
  $('#run').addEventListener('click', async () => {
    // إذا في حذف، منطلب كبسة تانية
    if (demo.on && !armed) {
      armed = true;
      $('#run').textContent = 'اضغط مرة تانية لتأكيد الحذف والإدخال';
      return;
    }
    armed = false;
    status('لا تسكّر الصفحة.');
    try {
      showReport(await runImport());
    } catch (err) {
      console.error(err);
      showReport({ added: 0, catsAdded: 0, catsKept: 0, exists: 0, noPrice: 0, skipped: 0, demoProducts: 0, demoCats: 0, stories: 0, relinked: 0, keptCats: [], failed: [{ name: 'الإدخال وقف', why: err.message }] });
    }
  });

  $('#again').addEventListener('click', async () => {
    try {
      await loadDb();
      demo.on = false;
      renderReview();
      show('review');
      status('راجع الأصناف، وعدّل اللي بدك ياه، وبعدها اكبس الإدخال.');
    } catch (err) { $('#doneMsg').textContent = 'ما قدرنا نقرأ القاعدة، شيّك عالنت.'; }
  });

  boot();
})();
