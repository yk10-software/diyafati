/* =========================================================
   ضيافتي — لوحة التحكم: شاشة التقييمات
   بتفتح من الإعدادات. كل تقييم بيوصل مخفي، وصاحب المحل بيختار شو بينعرض
   بالموقع (is_public). التقييمات بتنحمّل كل ما تفتح الشاشة.
   ========================================================= */
(() => {
  'use strict';

  const { $, db, fail, toast } = A;
  const TZ = 'Asia/Damascus';
  let reviews = [];

  const dateOf = iso => new Date(iso).toLocaleDateString('ar-SY-u-nu-latn', { day: 'numeric', month: 'long', timeZone: TZ });
  const stars = n => `<span class="stars-s" role="img" aria-label="${n} من 5">${'★'.repeat(n)}<i>${'★'.repeat(5 - n)}</i></span>`;

  A.views.reviews = {
    title: 'التقييمات',
    parent: 'settings',
    sub() {
      const n = reviews.filter(r => r.is_public).length;
      return n ? `${A.countAr(n, 'تقييم', 'تقييمين', 'تقييمات')} بالموقع` : 'اختار شو بينعرض بالموقع';
    },
    render: load,
  };

  async function load() {
    const view = $('#view');
    view.innerHTML = '<div class="empty">لحظة...</div>';
    try {
      const rows = await db(sb.from('reviews').select('*, orders(code)').order('created_at', { ascending: false }).limit(200));
      if (A.current() !== 'reviews') return;   // راح على شاشة تانية وهو عم يحمّل
      reviews = rows;
      draw();
      A.refreshHead();
    } catch (err) {
      view.innerHTML = '<div class="empty"><b>ما قدرنا نجيب التقييمات</b>شيّك عالنت وجرّب كمان مرة.</div>';
      fail(err);
    }
  }

  function draw() {
    const el = document.createElement('div');
    el.className = 'p-pad';
    el.innerHTML = reviews.length ? `
      <div class="a-card">
        ${reviews.map(r => `
          <div class="srow rv-row">
            <div class="lbl">
              <b>${escapeHTML(r.name)} ${stars(r.rating)}</b>
              ${r.comment ? `<p>${escapeHTML(r.comment)}</p>` : ''}
              <span>${r.orders ? `<bdi dir="ltr">#${escapeHTML(r.orders.code)}</bdi>، ` : ''}${dateOf(r.created_at)}</span>
            </div>
            <label class="switch"><input type="checkbox" data-rv="${r.id}" ${r.is_public ? 'checked' : ''} aria-label="عرض تقييم ${escapeHTML(r.name)} بالموقع"><span></span></label>
          </div>`).join('')}
      </div>
      <p class="caption">المفتاح بيعرض التقييم بالموقع، بالاسم الأول وأول حرف من الكنية. إذا الزبون عدّل تقييمه، بيرجع مخفي لحتى توافق عليه.</p>
    ` : '<div class="empty"><b>لسا ما في تقييمات</b>الزبون بيقدر يقيّم بعد ما يصير طلبه «تم التسليم».</div>';
    $('#view').replaceChildren(el);

    el.addEventListener('change', async e => {
      const input = e.target.closest('[data-rv]');
      if (!input) return;
      const r = reviews.find(x => x.id === Number(input.dataset.rv));
      try {
        await db(sb.from('reviews').update({ is_public: input.checked }).eq('id', r.id));
        r.is_public = input.checked;
        A.refreshHead();
        toast(input.checked ? 'صار بيبيّن بالموقع' : 'انخفى عن الموقع');
      } catch (err) {
        input.checked = !input.checked;
        fail(err);
      }
    });
  }
})();
