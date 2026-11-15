/* =========================================================
   ضيافتي — لوحة التحكم: فيديوهات أول الصفحة
   قسم بشاشة الأقسام فوق القصص: إضافة وحذف وترتيب، لحد 5 فيديوهات.
   الفيديو بيرتفع لحظة ما ينختار (ما في زر حفظ)، مع غلاف من لقطة منه.
   الفحص والرفع بـ A.prepareVideo و A.uploadVideo (admin.js).
   الجدول hero_videos (supabase/19_hero_videos.sql).
   ========================================================= */
(() => {
  'use strict';

  const { $, state, icon, db, fail, toast } = A;
  const MAX = 5;
  let busy = false;

  const list = () => [...state.heroVideos].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);

  // نفس رسائل القصص، لحتى صاحب المحل يشوف نفس الكلام
  function videoError(code) {
    switch (code) {
      case 'big': return `الفيديو أكبر من ${A.VIDEO_MAX_MB}MB. ابعته لحالك عالواتس واحفظه (الواتس بيصغّره)، وبعدين ارفعه.`;
      case 'hevc': return 'الفيديو بصيغة الآيفون (HEVC)، وما بيشتغل عند كتير من زباين الأندرويد. ابعته لحالك عالواتس واحفظه، وبعدين ارفعه.';
      case 'long': return `الفيديو أطول من ${A.VIDEO_MAX_SEC} ثانية. قصّه وجرّب كمان مرة.`;
      default: return 'ما قدرنا نفتح الفيديو. ابعته لحالك عالواتس واحفظه، وبعدين ارفعه.';
    }
  }

  function setMsg(text, info) {
    const m = $('#hMsg');
    if (!m) return;
    m.className = 'form-msg' + (info ? ' info' : '');
    m.textContent = text;
  }

  function render() {
    const box = $('#hList');
    if (!box) return;
    const all = list();
    box.innerHTML = all.map((v, i) => `
      <div class="hv-row" data-id="${v.id}">
        <img class="hv-pic" src="${escapeHTML(v.poster)}" alt="">
        <span class="hv-name">الفيديو ${i + 1}</span>
        <div class="si-act">
          <button class="sq" type="button" data-hup="${i}" aria-label="قدّم الفيديو ${i + 1}" ${i ? '' : 'disabled'}>↑</button>
          <button class="sq" type="button" data-hdown="${i}" aria-label="أخّر الفيديو ${i + 1}" ${i < all.length - 1 ? '' : 'disabled'}>↓</button>
          <button class="sq" type="button" data-hdel="${v.id}" aria-label="احذف الفيديو ${i + 1}">${icon('trash')}</button>
        </div>
      </div>`).join('') + (all.length < MAX ? `
      <label class="add-row si-add hv-add${busy ? ' off' : ''}">
        <input type="file" accept="video/*" hidden id="hFile" ${busy ? 'disabled' : ''}>+ فيديو
      </label>
      <p class="hint si-hint">لحد ${A.VIDEO_MAX_SEC} ثانية و${A.VIDEO_MAX_MB}MB. الفيديو العرضي بيطلع أحسن، والقصير (10 لـ 20 ثانية) أخف عالزباين.</p>` : `<p class="hint hv-full">وصلت لـ ${MAX} فيديوهات. لتضيف واحد، احذف واحد أول.</p>`) + `
      <p class="form-msg" id="hMsg" role="status"></p>`;
  }

  /* ---------- الترتيب: منبدّل الفيديو مع اللي جنبه ---------- */
  async function swap(i, j) {
    const all = list();
    if (j < 0 || j >= all.length) return;
    const before = all.map(v => ({ id: v.id, sort_order: v.sort_order }));
    [all[i], all[j]] = [all[j], all[i]];
    const changed = all.map((v, k) => ({ v, sort_order: k + 1 })).filter(x => x.v.sort_order !== x.sort_order);
    changed.forEach(x => { x.v.sort_order = x.sort_order; });
    render();
    try {
      await Promise.all(changed.map(x => db(sb.from('hero_videos').update({ sort_order: x.sort_order }).eq('id', x.v.id))));
      toast('انحفظ الترتيب');
    } catch (err) {
      before.forEach(b => { state.heroVideos.find(v => v.id === b.id).sort_order = b.sort_order; });
      render();
      fail(err);
    }
  }

  /* ---------- الإضافة: فحص، غلاف، رفع، وبعدين صف بالجدول ---------- */
  async function add(file) {
    if (busy) return;
    busy = true;
    render();
    setMsg('عم نجهّز الفيديو...', true);
    let poster = null;
    let video = null;
    try {
      let prepared;
      try { prepared = await A.prepareVideo(file); }
      catch (err) { busy = false; render(); setMsg(videoError(err.message)); return; }

      setMsg('عم يرتفع الفيديو، خلّي الصفحة مفتوحة...', true);
      poster = await A.uploadImage(prepared.poster, 'hero');
      video = await A.uploadVideo(file, 'hero');
      const last = state.heroVideos.reduce((m, v) => Math.max(m, v.sort_order), 0);
      const saved = await db(sb.from('hero_videos').insert({ video, poster, sort_order: last + 1 }).select().single());
      state.heroVideos.push(saved);
      busy = false;
      render();
      toast('انضاف الفيديو');
    } catch (err) {
      console.error(err);
      // ما في داعي يضل فيديو وغلاف لصف ما انحفظ
      if (poster) A.removeImages([poster]);
      if (video) A.removeVideos([video]);
      busy = false;
      render();
      setMsg(/hero_limit/.test(err && err.message) ? `ما بيصير أكتر من ${MAX} فيديوهات.` : 'ما ارتفع الفيديو. شيّك عالنت وجرّب كمان مرة.');
    }
  }

  async function remove(id) {
    const v = state.heroVideos.find(x => x.id === id);
    if (!v) return;
    try {
      await db(sb.from('hero_videos').delete().eq('id', id));
      state.heroVideos = state.heroVideos.filter(x => x.id !== id);
      A.removeImages([v.poster]);
      A.removeVideos([v.video]);
      render();
      toast('انحذف الفيديو');
    } catch (err) { fail(err); }
  }

  // بيتنادى من شاشة الأقسام كل ما تنرسم
  function mount() {
    render();
    const box = $('#hList');
    box.addEventListener('change', e => {
      if (e.target.id !== 'hFile' || !e.target.files[0]) return;
      const file = e.target.files[0];
      e.target.value = '';
      add(file);
    });
    box.addEventListener('click', e => {
      const up = e.target.closest('[data-hup]');
      if (up) return swap(Number(up.dataset.hup), Number(up.dataset.hup) - 1);
      const down = e.target.closest('[data-hdown]');
      if (down) return swap(Number(down.dataset.hdown), Number(down.dataset.hdown) + 1);
      const del = e.target.closest('[data-hdel]');
      if (!del) return;
      // كبستين للحذف: أول وحدة بتسأل، التانية بتحذف
      if (del.dataset.armed) return remove(Number(del.dataset.hdel));
      del.dataset.armed = '1';
      del.classList.add('armed');
      del.setAttribute('aria-label', 'اكبس كمان مرة لتأكيد الحذف');
      setMsg('اكبس السلة كمان مرة لتأكيد الحذف.');
    });
  }

  A.mountHero = mount;
})();
