/* =========================================================
   ضيافتي — لوحة التحكم: شاشة الأقسام (والقصص تحتها، من admin-stories.js)
   إضافة، تعديل، حذف، وترتيب بالسحب (بالإصبع أو الماوس أو أسهم الكيبورد).
   ========================================================= */
(() => {
  'use strict';

  const { $, $$, state, icon, db, fail, toast } = A;

  const countIn = id => state.products.filter(p => p.category_id === id).length;

  A.views.categories = {
    title: 'الأقسام والقصص',
    sub: () => 'اسحب القسم من النقاط لتغيّر ترتيبه بالتطبيق',
    render(el) {
      el.innerHTML = `
        <div class="crows" id="cList"></div>
        <form class="newcat" id="cNew" novalidate>
          <label class="visually-hidden" for="cName">اسم القسم الجديد</label>
          <input id="cName" name="cname" placeholder="اسم القسم الجديد" maxlength="40" autocomplete="off">
          <button class="btn-sm" type="submit">إضافة</button>
        </form>
        <div class="p-pad">
          <div class="sec"><h2>القصص</h2><small>بتختفي لحالها بعد أسبوع</small></div>
          <div class="a-stories" id="sList"></div>
        </div>
      `;
      renderList();
      A.mountStories();

      $('#cNew', el).addEventListener('submit', async e => {
        e.preventDefault();
        const input = $('#cName', el);
        const name = input.value.trim();
        if (!name) { input.focus(); return; }
        const btn = e.target.querySelector('button');
        btn.disabled = true;
        try {
          const last = state.cats.reduce((m, c) => Math.max(m, c.sort_order), 0);
          const saved = await db(sb.from('categories').insert({ name, sort_order: last + 1 }).select().single());
          state.cats.push(saved);
          input.value = '';
          renderList(saved.id);
          toast('انضاف القسم');
        } catch (err) { fail(err); }
        finally { btn.disabled = false; }
      });

      $('#cList', el).addEventListener('click', e => {
        const ed = e.target.closest('[data-edit]');
        if (ed) openEditor(Number(ed.dataset.edit));
        const del = e.target.closest('[data-del]');
        if (del) openDelete(Number(del.dataset.del));
      });
    },
  };

  // fresh = القسم اللي انضاف هلق، بيتلوّن شوي لحتى يبيّن
  function renderList(fresh) {
    const list = $('#cList');
    if (!state.cats.length) {
      list.innerHTML = '<div class="empty"><b>ما في أقسام لسا</b>اكتب اسم القسم تحت واضغط «إضافة».</div>';
      return;
    }
    list.innerHTML = state.cats.map(c => {
      const n = countIn(c.id);
      const tags = (c.hidden ? '<span class="tag muted">مخفي</span>' : '') + (c.coming_soon ? '<span class="tag">قريباً</span>' : '');
      return `
        <div class="crow${c.id === fresh ? ' fresh' : ''}" data-id="${c.id}">
          <button class="grip" type="button" aria-label="رتّب «${escapeHTML(c.name)}» (اسحب أو استعمل الأسهم)">${icon('grip')}</button>
          <div class="nm">
            <b>${escapeHTML(c.name)}${tags}</b>
            <span>${n ? A.countAr(n, 'صنف', 'صنفين', 'أصناف') : 'قسم جديد، لسا ما فيه أصناف'}</span>
          </div>
          <div class="act">
            <button class="sq" type="button" data-edit="${c.id}" aria-label="تعديل «${escapeHTML(c.name)}»">${icon('edit')}</button>
            <button class="sq" type="button" data-del="${c.id}" aria-label="حذف «${escapeHTML(c.name)}»">${icon('trash')}</button>
          </div>
        </div>`;
    }).join('');
    $$('.grip', list).forEach(enableDrag);
  }

  /* ---------- الترتيب بالسحب ----------
     لما تسحب صف وتتجاوز نص الصف اللي جنبه، بيتبادلوا محل.
     لما تفلت، منحفظ الترتيب الجديد.
     ملاحظة: دايماً منحرّك الصف اللي جنبه، مو الصف المسحوب، لأنو إذا انشال
     الصف المسحوب من الصفحة ولو للحظة، المتصفح بيوقف السحب. */
  function enableDrag(grip) {
    const row = grip.closest('.crow');
    const list = row.parentElement;
    const up = () => { const p = row.previousElementSibling; if (p) list.insertBefore(p, row.nextElementSibling); return !!p; };
    const down = () => { const n = row.nextElementSibling; if (n) list.insertBefore(n, row); return !!n; };

    grip.addEventListener('pointerdown', e => {
      e.preventDefault();
      grip.setPointerCapture(e.pointerId);
      row.classList.add('dragging');
    });
    grip.addEventListener('pointermove', e => {
      if (!row.classList.contains('dragging')) return;
      const prev = row.previousElementSibling;
      const next = row.nextElementSibling;
      if (prev && e.clientY < mid(prev)) up();
      else if (next && e.clientY > mid(next)) down();
    });
    const drop = () => {
      if (!row.classList.contains('dragging')) return;
      row.classList.remove('dragging');
      saveOrder();
    };
    grip.addEventListener('pointerup', drop);
    grip.addEventListener('pointercancel', drop);
    grip.addEventListener('lostpointercapture', drop);

    // الكيبورد: سهم لفوق/لتحت
    grip.addEventListener('keydown', e => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      if (e.key === 'ArrowUp' ? up() : down()) saveOrder();
    });
  }
  const mid = el => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; };

  async function saveOrder() {
    const ids = $$('#cList .crow').map(r => Number(r.dataset.id));
    const changed = ids
      .map((id, i) => ({ id, sort_order: i + 1 }))
      .filter(x => state.cats.find(c => c.id === x.id).sort_order !== x.sort_order);
    if (!changed.length) return;

    const before = state.cats.map(c => ({ ...c }));
    changed.forEach(x => { state.cats.find(c => c.id === x.id).sort_order = x.sort_order; });
    state.cats.sort((a, b) => a.sort_order - b.sort_order);
    try {
      await Promise.all(changed.map(x =>
        db(sb.from('categories').update({ sort_order: x.sort_order }).eq('id', x.id))));
      toast('انحفظ الترتيب');
    } catch (err) {
      state.cats = before;
      renderList();
      fail(err);
    }
  }

  /* ---------- تعديل قسم ---------- */
  function openEditor(id) {
    const c = state.cats.find(x => x.id === id);
    const sheet = A.openSheet(`
      <div class="sheet-head"><h2>تعديل القسم</h2><button class="close" aria-label="إغلاق">×</button></div>
      <form id="cForm" novalidate>
        <label class="field" data-f="cname">
          <span>اسم القسم</span>
          <input name="cname" value="${escapeHTML(c.name)}" maxlength="40">
          <span class="err">اكتب اسم القسم.</span>
        </label>
        <label class="check"><input type="checkbox" name="hide" ${c.hidden ? 'checked' : ''}> مخفي عن الزباين (هو وأصنافه)</label>
        <label class="check"><input type="checkbox" name="soon" ${c.coming_soon ? 'checked' : ''}> «قريباً»: بيبيّن بس ما بينطلب منه</label>
        <button class="btn" type="submit" style="margin-top:18px">حفظ</button>
      </form>
    `);
    const form = $('#cForm', sheet);
    const f = form.elements;
    A.clearOnInput(form);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!A.requireFields(form, ['cname'])) return;
      A.busy(form, true);
      try {
        const saved = await db(sb.from('categories')
          .update({ name: f.cname.value.trim(), hidden: f.hide.checked, coming_soon: f.soon.checked })
          .eq('id', id).select().single());
        state.cats[state.cats.findIndex(x => x.id === id)] = saved;
        A.closeSheet();
        renderList();
        toast('انحفظ القسم');
      } catch (err) { fail(err); }
      finally { A.busy(form, false); }
    });
  }

  /* ---------- حذف قسم ---------- */
  function openDelete(id) {
    const c = state.cats.find(x => x.id === id);
    const n = countIn(id);
    const sheet = A.openSheet(`
      <div class="sheet-head"><h2>حذف «${escapeHTML(c.name)}»؟</h2><button class="close" aria-label="إغلاق">×</button></div>
      <p>${n
        ? `فيه ${A.countAr(n, 'صنف', 'صنفين', 'أصناف')}. الأصناف ما بتنحذف، بس بتصير «بلا قسم» لحد ما تنقلها لقسم تاني.`
        : 'القسم فاضي، ما فيه أصناف.'}</p>
      <button class="btn danger" type="button" id="cDel">احذف القسم</button>
      <button class="btn ghost" type="button" data-close style="margin-top:10px">لأ، خليه</button>
    `);
    $('#cDel', sheet).addEventListener('click', async e => {
      e.target.disabled = true;
      try {
        await db(sb.from('categories').delete().eq('id', id));
        state.cats = state.cats.filter(x => x.id !== id);
        // قاعدة البيانات خلّت category_id فاضي، منعمل نفس الشي هون
        state.products.forEach(p => { if (p.category_id === id) p.category_id = null; });
        A.closeSheet();
        renderList();
        toast('انحذف القسم');
      } catch (err) { e.target.disabled = false; fail(err); }
    });
  }
})();
