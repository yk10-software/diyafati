/* =========================================================
   ضيافتي — لوحة التحكم: القصص
   قسم تحت الأقسام: إضافة وتعديل وحذف وترتيب.
   كل صورة أو فيديو بيختفي عن الزباين بعد أسبوع لحاله (expires_at بقاعدة البيانات)،
   والصور بتتصغّر قبل الرفع متل الأصناف.
   الفيديو: عمود video، وعمود image بيصير الغلاف (لقطة من الفيديو).
   الفحص والرفع بـ A.prepareVideo و A.uploadVideo (admin.js).
   ========================================================= */
(() => {
  'use strict';

  const { $, state, icon, db, fail, toast } = A;
  const DAY = 86400000;

  const items = s => [...s.story_items].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  const isVid = r => Boolean(r.video || r.videoFile);

  // رسالة واضحة لكل سبب رفض للفيديو
  function videoError(code, name) {
    const n = `«${name}»`;
    switch (code) {
      case 'big': return `الفيديو ${n} أكبر من ${A.VIDEO_MAX_MB}MB. ابعته لحالك عالواتس واحفظه (الواتس بيصغّره)، وبعدين ارفعه.`;
      case 'hevc': return `الفيديو ${n} بصيغة الآيفون (HEVC)، وما بيشتغل عند كتير من زباين الأندرويد. ابعته لحالك عالواتس واحفظه، وبعدين ارفعه.`;
      case 'long': return `الفيديو ${n} أطول من ${A.VIDEO_MAX_SEC} ثانية. قصّه وجرّب كمان مرة.`;
      default: return `ما قدرنا نفتح الفيديو ${n}. ابعته لحالك عالواتس واحفظه، وبعدين ارفعه.`;
    }
  }
  const alive = it => !it.expires_at || new Date(it.expires_at) > new Date();

  function left(it) {
    if (!it.expires_at) return 'ما بتختفي';
    if (!alive(it)) return 'خلصت، ما بتبيّن للزباين';
    const days = Math.ceil((new Date(it.expires_at) - new Date()) / DAY);
    return `بتختفي بعد ${A.countAr(days, 'يوم', 'يومين', 'أيام')}`;
  }

  function render() {
    const list = $('#sList');
    if (!list) return;
    list.innerHTML = `
      <button class="s s-new" type="button" data-new><span class="f">+</span>قصة جديدة</button>
      ${state.stories.map(s => {
        const all = items(s);
        const first = all.find(alive) || all[0];
        return `
          <button class="s${all.some(alive) ? '' : ' off'}" type="button" data-story="${s.id}">
            <span class="f">${first ? `<img src="${escapeHTML(first.image)}" alt="">` : ''}</span>
            <span class="t">${escapeHTML(s.title)}</span>
          </button>`;
      }).join('')}`;
  }

  // بيتنادى مرة وحدة من شاشة الأقسام
  function mount() {
    render();
    $('#sList').addEventListener('click', e => {
      if (e.target.closest('[data-new]')) return openStory(null);
      const b = e.target.closest('[data-story]');
      if (b) openStory(Number(b.dataset.story));
    });
  }

  /* ---------- ترتيب القصص: منبدّل القصة مع اللي جنبها ---------- */
  async function move(id, dir) {
    const i = state.stories.findIndex(s => s.id === id);
    const j = i + dir;
    if (j < 0 || j >= state.stories.length) return;
    const before = state.stories.map(s => ({ ...s }));
    [state.stories[i], state.stories[j]] = [state.stories[j], state.stories[i]];
    const changed = state.stories
      .map((s, k) => ({ s, sort_order: k + 1 }))
      .filter(x => x.s.sort_order !== x.sort_order);
    changed.forEach(x => { x.s.sort_order = x.sort_order; });
    render();
    try {
      await Promise.all(changed.map(x =>
        db(sb.from('stories').update({ sort_order: x.sort_order }).eq('id', x.s.id))));
      toast('انحفظ الترتيب');
    } catch (err) {
      state.stories = before;
      render();
      fail(err);
    }
  }

  /* ---------- نافذة الإضافة والتعديل ---------- */
  function openStory(id) {
    const existing = state.stories.find(s => s.id === id);
    const isNew = !existing;
    // كل عنصر: يا محفوظ { id, image, video }، يا جديد لسا ما ارتفع { blob, preview }
    // والفيديو الجديد معه { videoFile, duration }، و blob هو الغلاف
    const rows = (existing ? items(existing) : []).map(it => ({ ...it }));

    const sheet = A.openSheet(`
      <div class="sheet-head"><h2>${isNew ? 'قصة جديدة' : 'تعديل القصة'}</h2><button class="close" aria-label="إغلاق">×</button></div>
      <form id="sForm" novalidate>
        <div id="sMain">
        <label class="field" data-f="title">
          <span>اسم القصة</span>
          <input name="title" maxlength="30" value="${escapeHTML(existing ? existing.title : '')}" placeholder="متل: مواليد">
          <span class="err">اكتب اسم القصة.</span>
        </label>
        <div class="field"><span>الصور والفيديو <small>(الأول بيبيّن قبل الباقي)</small></span></div>
        <div id="sRows"></div>
        <label class="add-row si-add">
          <input type="file" accept="image/*,video/*" multiple hidden id="sImg">+ صورة أو فيديو
        </label>
        <p class="hint si-hint">الفيديو لحد ${A.VIDEO_MAX_SEC} ثانية و${A.VIDEO_MAX_MB}MB، وبيشتغل عند الزباين بلا صوت لحتى يكبسوا عالصوت.</p>
        <p class="form-msg" id="sMsg" role="alert"></p>
        ${isNew ? '' : `
        <div class="two" style="margin-bottom:10px">
          <button class="btn ghost" type="button" data-move="-1">نقل لقدّام</button>
          <button class="btn ghost" type="button" data-move="1">نقل لورا</button>
        </div>`}
        <button class="btn" type="submit">${isNew ? 'إضافة القصة' : 'حفظ'}</button>
        ${isNew ? '' : '<button class="btn danger" type="button" id="sDel" style="margin-top:10px">حذف القصة</button>'}
        </div>
        <div id="sPick" hidden>
          <div class="sp-head">
            <button class="sq" type="button" data-pick-back aria-label="رجوع">→</button>
            <p class="sheet-sub" id="sPickTitle">اربط بصنف</p>
          </div>
          <label class="search sp-search">
            <span class="visually-hidden">ابحث عن صنف</span>
            ${icon('search')}
            <input type="search" id="sQ" placeholder="ابحث باسم الصنف أو القسم" autocomplete="off" enterkeyhint="search">
          </label>
          <div id="sPickList"></div>
        </div>
      </form>
    `);

    const form = $('#sForm', sheet);
    const f = form.elements;
    const msg = $('#sMsg', sheet);
    A.clearOnInput(form, msg);

    const productName = id => { const p = state.products.find(x => x.id === id); return p ? p.name : ''; };

    function drawRows() {
      $('#sRows', sheet).innerHTML = rows.map((r, i) => {
        const kind = isVid(r) ? 'الفيديو' : 'الصورة';
        const when = r.id ? left(r) : (isVid(r) ? 'بيختفي بعد أسبوع' : 'بتختفي بعد أسبوع');
        const what = isVid(r) ? `فيديو${r.duration ? ` ${A.countAr(r.duration, 'ثانية', 'ثانيتين', 'ثواني')}` : ''}، ` : '';
        return `
        <div class="si-row">
          <div class="si-pic">
            <img src="${escapeHTML(r.image || r.preview)}" alt="">
            ${isVid(r) ? '<span class="si-play" aria-hidden="true"></span>' : ''}
          </div>
          <div class="si-mid">
            <button class="si-link${productName(r.product_id) ? ' on' : ''}" type="button" data-link="${i}"
              aria-label="الصنف المرتبط ب${kind} ${i + 1}: ${escapeHTML(productName(r.product_id) || 'بلا صنف')}">
              ${icon('search')}<span>${escapeHTML(productName(r.product_id) || 'اربط بصنف (اختياري)')}</span>
            </button>
            <small>${what}${when}</small>
          </div>
          <div class="si-act">
            <button class="sq" type="button" data-up="${i}" aria-label="قدّم ${kind} ${i + 1}" ${i ? '' : 'disabled'}>↑</button>
            <button class="sq" type="button" data-down="${i}" aria-label="أخّر ${kind} ${i + 1}" ${i < rows.length - 1 ? '' : 'disabled'}>↓</button>
            <button class="sq" type="button" data-rm="${i}" aria-label="شيل ${kind} ${i + 1}">${icon('trash')}</button>
          </div>
        </div>`;
      }).join('');
    }
    drawRows();

    const swap = (i, j) => { [rows[i], rows[j]] = [rows[j], rows[i]]; drawRows(); };

    /* ---------- ربط الصورة بصنف: بحث بدل قائمة طويلة ----------
       منخبّي النموذج ومنفرجي البحث بنفس النافذة، لحتى ما يضيع شي ما انحفظ.
       البحث بكل كلمة لحالها، بالاسم أو باسم القسم (normalizeAr بـ data.js). */
    let pickFor = null;
    const byOrder = (a, b) => a.sort_order - b.sort_order || a.id - b.id;

    function openPicker(i) {
      pickFor = i;
      $('#sMain', sheet).hidden = true;
      $('#sPick', sheet).hidden = false;
      sheet.classList.add('tall');   // لحتى ما تنط النافذة مع كل حرف بالبحث
      $('#sPickTitle', sheet).textContent = `اربط ${isVid(rows[i]) ? 'الفيديو' : 'الصورة'} ${i + 1} بصنف`;
      const q = $('#sQ', sheet);
      q.value = '';
      drawPick('');
      sheet.scrollTop = 0;
      q.focus();
    }

    function closePicker() {
      const i = pickFor;
      pickFor = null;
      $('#sPick', sheet).hidden = true;
      $('#sMain', sheet).hidden = false;
      sheet.classList.remove('tall');
      drawRows();
      const b = $(`[data-link="${i}"]`, sheet);
      if (b) { b.scrollIntoView({ block: 'center' }); b.focus(); }
    }

    function drawPick(query) {
      const words = normalizeAr(query).split(/\s+/).filter(Boolean);
      const cur = rows[pickFor] ? rows[pickFor].product_id : null;
      const cats = [...state.cats].sort(byOrder);
      const groups = [
        ...cats.map(c => ({ name: c.name, list: state.products.filter(p => p.category_id === c.id) })),
        { name: 'بلا قسم', list: state.products.filter(p => !cats.some(c => c.id === p.category_id)) },
      ];
      const item = p => `
        <button class="sp-item${p.id === cur ? ' on' : ''}" type="button" data-pick="${p.id}">
          ${A.thumb(p.images && p.images[0], 'sp-th')}
          <span>${escapeHTML(p.name)}${p.hidden ? ' <small>(مخفي)</small>' : ''}</span>
        </button>`;
      let html = words.length ? ''
        : `<button class="sp-item sp-none${cur ? '' : ' on'}" type="button" data-pick="">بلا صنف</button>`;
      let found = 0;
      for (const g of groups) {
        const hay = p => normalizeAr(`${p.name} ${g.name}`);
        const list = g.list.filter(p => words.every(w => hay(p).includes(w))).sort(byOrder);
        if (!list.length) continue;
        found += list.length;
        html += `<p class="sp-cat">${escapeHTML(g.name)}</p>${list.map(item).join('')}`;
      }
      if (words.length && !found) {
        html = '<p class="sp-empty">ما في صنف بهالاسم. إذا لسا ما انضاف، ضيفه من شاشة الأصناف وبعدين ارجع لهون.</p>';
      }
      $('#sPickList', sheet).innerHTML = html;
    }

    $('#sQ', sheet).addEventListener('input', e => drawPick(e.target.value));
    // Enter بيختار أول نتيجة بدل ما يحفظ القصة
    $('#sQ', sheet).addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const first = $('#sPickList [data-pick]:not(.sp-none)', sheet);
      if (first) first.click();
    });

    sheet.addEventListener('click', e => {
      const link = e.target.closest('[data-link]');
      if (link) return openPicker(Number(link.dataset.link));
      const pick = e.target.closest('[data-pick]');
      if (pick && pickFor !== null) {
        rows[pickFor].product_id = pick.dataset.pick ? Number(pick.dataset.pick) : null;
        return closePicker();
      }
      if (e.target.closest('[data-pick-back]')) return closePicker();
      const up = e.target.closest('[data-up]');
      if (up) return swap(Number(up.dataset.up), Number(up.dataset.up) - 1);
      const down = e.target.closest('[data-down]');
      if (down) return swap(Number(down.dataset.down), Number(down.dataset.down) + 1);
      const rm = e.target.closest('[data-rm]');
      if (rm) { rows.splice(Number(rm.dataset.rm), 1); drawRows(); return; }
      const mv = e.target.closest('[data-move]');
      if (mv) move(id, Number(mv.dataset.move));
    });

    sheet.addEventListener('change', async e => {
      if (e.target.id !== 'sImg') return;
      const files = [...e.target.files];
      e.target.value = '';
      const errors = [];
      const hasVideo = files.some(isVideoFile);
      if (hasVideo) {
        A.busy(form, true);
        msg.className = 'form-msg info';
        msg.textContent = 'عم نجهّز الفيديو...';
      }
      for (const file of files) {
        if (isVideoFile(file)) {
          try {
            const { duration, poster } = await A.prepareVideo(file);
            rows.push({ blob: poster, preview: URL.createObjectURL(poster), videoFile: file, duration, product_id: null });
          } catch (err) {
            errors.push(videoError(err.message, file.name));
          }
          continue;
        }
        try {
          const blob = await A.resizeImage(file);
          rows.push({ blob, preview: URL.createObjectURL(blob), product_id: null });
        } catch (err) {
          errors.push(`ما قدرنا نفتح الصورة «${file.name}». جرّب صورة تانية.`);
        }
      }
      if (hasVideo) A.busy(form, false);
      drawRows();
      msg.className = 'form-msg';
      msg.textContent = errors.join(' ');
    });

    // بعض الموبايلات ما بتعطي نوع للملف، فمنشوف الامتداد كمان
    function isVideoFile(file) {
      return (file.type || '').startsWith('video/') || /\.(mp4|mov|m4v|3gp)$/i.test(file.name);
    }

    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!A.requireFields(form, ['title'])) return;
      if (!rows.length) { msg.textContent = 'ضيف صورة أو فيديو عالأقل.'; return; }

      A.busy(form, true);
      const uploaded = [];
      const uploadedVideos = [];
      let storyId = id;
      try {
        // نرفع الصور والفيديوهات الجديدة أول
        if (rows.some(r => !r.id && r.videoFile)) {
          msg.className = 'form-msg info';
          msg.textContent = 'عم يرتفع الفيديو، خلّي الصفحة مفتوحة...';
        }
        for (const r of rows) {
          if (r.id) continue;
          r.image = await A.uploadImage(r.blob, 'stories');
          uploaded.push(r.image);
          if (r.videoFile) {
            r.video = await A.uploadVideo(r.videoFile, 'stories');
            uploadedVideos.push(r.video);
          }
        }

        const title = f.title.value.trim();
        if (isNew) {
          const last = state.stories.reduce((m, s) => Math.max(m, s.sort_order), 0);
          const saved = await db(sb.from('stories').insert({ title, sort_order: last + 1 }).select().single());
          storyId = saved.id;
        } else {
          await db(sb.from('stories').update({ title }).eq('id', id));
        }

        const gone = (existing ? existing.story_items : []).filter(x => !rows.some(r => r.id === x.id));
        await Promise.all(gone.map(x => db(sb.from('story_items').delete().eq('id', x.id))));
        await Promise.all(rows.map((r, i) => {
          const row = { product_id: r.product_id ?? null, sort_order: i + 1 };
          return r.id
            ? db(sb.from('story_items').update(row).eq('id', r.id))
            : db(sb.from('story_items').insert({ ...row, story_id: storyId, image: r.image, video: r.video || null }));
        }));

        const fresh = await db(sb.from('stories').select('*, story_items(*)').eq('id', storyId).single());
        if (isNew) state.stories.push(fresh);
        else state.stories[state.stories.findIndex(s => s.id === id)] = fresh;
        A.removeImages(gone.map(x => x.image));
        A.removeVideos(gone.map(x => x.video));
        A.closeSheet();
        render();
        toast(isNew ? 'انضافت القصة' : 'انحفظت القصة');
      } catch (err) {
        console.error(err);
        A.removeImages(uploaded);   // ما في داعي تضل صور وفيديوهات لقصة ما انحفظت
        A.removeVideos(uploadedVideos);
        rows.forEach(r => { if (!r.id) { delete r.image; delete r.video; } });
        if (isNew && storyId) db(sb.from('stories').delete().eq('id', storyId)).catch(console.warn);
        storyId = id;
        msg.className = 'form-msg';
        msg.textContent = 'ما انحفظت القصة. شيّك عالنت وجرّب كمان مرة.';
      } finally {
        A.busy(form, false);
      }
    });

    const del = $('#sDel', sheet);
    if (del) A.confirmTwice(del, 'اضغط مرة تانية لتأكيد الحذف', async () => {
      try {
        await db(sb.from('stories').delete().eq('id', id));
        A.removeImages(existing.story_items.map(x => x.image));
        A.removeVideos(existing.story_items.map(x => x.video));
        state.stories = state.stories.filter(s => s.id !== id);
        A.closeSheet();
        render();
        toast('انحذفت القصة');
      } catch (err) { fail(err); }
    });
  }

  A.mountStories = mount;
})();
