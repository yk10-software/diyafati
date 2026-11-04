/* =========================================================
   ضيافتي — لوحة التحكم: القصص
   قسم تحت الأقسام: إضافة وتعديل وحذف وترتيب.
   كل صورة بتختفي عن الزباين بعد أسبوع لحالها (expires_at بقاعدة البيانات)،
   والصور بتتصغّر قبل الرفع متل الأصناف.
   ========================================================= */
(() => {
  'use strict';

  const { $, state, icon, db, fail, toast } = A;
  const DAY = 86400000;

  const items = s => [...s.story_items].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
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
    // كل صورة: يا محفوظة { id, image }، يا جديدة لسا ما ارتفعت { blob, preview }
    const rows = (existing ? items(existing) : []).map(it => ({ ...it }));

    const sheet = A.openSheet(`
      <div class="sheet-head"><h2>${isNew ? 'قصة جديدة' : 'تعديل القصة'}</h2><button class="close" aria-label="إغلاق">×</button></div>
      <form id="sForm" novalidate>
        <label class="field" data-f="title">
          <span>اسم القصة</span>
          <input name="title" maxlength="30" value="${escapeHTML(existing ? existing.title : '')}" placeholder="متل: مواليد">
          <span class="err">اكتب اسم القصة.</span>
        </label>
        <div class="field"><span>الصور <small>(الأولى بتبيّن قبل الباقي)</small></span></div>
        <div id="sRows"></div>
        <label class="add-row si-add">
          <input type="file" accept="image/*" multiple hidden id="sImg">+ صورة
        </label>
        <p class="form-msg" id="sMsg" role="alert"></p>
        ${isNew ? '' : `
        <div class="two" style="margin-bottom:10px">
          <button class="btn ghost" type="button" data-move="-1">نقل لقدّام</button>
          <button class="btn ghost" type="button" data-move="1">نقل لورا</button>
        </div>`}
        <button class="btn" type="submit">${isNew ? 'إضافة القصة' : 'حفظ'}</button>
        ${isNew ? '' : '<button class="btn danger" type="button" id="sDel" style="margin-top:10px">حذف القصة</button>'}
      </form>
    `);

    const form = $('#sForm', sheet);
    const f = form.elements;
    const msg = $('#sMsg', sheet);
    A.clearOnInput(form, msg);

    const productOptions = selected => `<option value="">بلا صنف</option>` + state.products.map(p =>
      `<option value="${p.id}" ${p.id === selected ? 'selected' : ''}>${escapeHTML(p.name)}</option>`).join('');

    function drawRows() {
      $('#sRows', sheet).innerHTML = rows.map((r, i) => `
        <div class="si-row">
          <img src="${escapeHTML(r.image || r.preview)}" alt="">
          <div class="si-mid">
            <select data-prod="${i}" aria-label="الصنف المرتبط بالصورة ${i + 1}">${productOptions(r.product_id)}</select>
            <small>${r.id ? left(r) : 'بتختفي بعد أسبوع'}</small>
          </div>
          <div class="si-act">
            <button class="sq" type="button" data-up="${i}" aria-label="قدّم الصورة ${i + 1}" ${i ? '' : 'disabled'}>↑</button>
            <button class="sq" type="button" data-down="${i}" aria-label="أخّر الصورة ${i + 1}" ${i < rows.length - 1 ? '' : 'disabled'}>↓</button>
            <button class="sq" type="button" data-rm="${i}" aria-label="شيل الصورة ${i + 1}">${icon('trash')}</button>
          </div>
        </div>`).join('');
    }
    drawRows();

    const swap = (i, j) => { [rows[i], rows[j]] = [rows[j], rows[i]]; drawRows(); };

    sheet.addEventListener('click', e => {
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
      if (e.target.dataset.prod !== undefined) {
        rows[Number(e.target.dataset.prod)].product_id = e.target.value ? Number(e.target.value) : null;
        return;
      }
      if (e.target.id !== 'sImg') return;
      for (const file of e.target.files) {
        try {
          const blob = await A.resizeImage(file);
          rows.push({ blob, preview: URL.createObjectURL(blob), product_id: null });
        } catch (err) {
          toast('ما قدرنا نفتح وحدة من الصور. جرّب صورة تانية.');
        }
      }
      e.target.value = '';
      drawRows();
      msg.textContent = '';
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!A.requireFields(form, ['title'])) return;
      if (!rows.length) { msg.textContent = 'ضيف صورة وحدة عالأقل.'; return; }

      A.busy(form, true);
      const uploaded = [];
      let storyId = id;
      try {
        // نرفع الصور الجديدة أول
        for (const r of rows) {
          if (r.id) continue;
          r.image = await A.uploadImage(r.blob, 'stories');
          uploaded.push(r.image);
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
            : db(sb.from('story_items').insert({ ...row, story_id: storyId, image: r.image }));
        }));

        const fresh = await db(sb.from('stories').select('*, story_items(*)').eq('id', storyId).single());
        if (isNew) state.stories.push(fresh);
        else state.stories[state.stories.findIndex(s => s.id === id)] = fresh;
        A.removeImages(gone.map(x => x.image));
        A.closeSheet();
        render();
        toast(isNew ? 'انضافت القصة' : 'انحفظت القصة');
      } catch (err) {
        console.error(err);
        A.removeImages(uploaded);   // ما في داعي تضل صور لقصة ما انحفظت
        rows.forEach(r => { if (!r.id) delete r.image; });
        if (isNew && storyId) db(sb.from('stories').delete().eq('id', storyId)).catch(console.warn);
        storyId = id;
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
        state.stories = state.stories.filter(s => s.id !== id);
        A.closeSheet();
        render();
        toast('انحذفت القصة');
      } catch (err) { fail(err); }
    });
  }

  A.mountStories = mount;
})();
