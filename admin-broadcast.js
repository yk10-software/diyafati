/* =========================================================
   ضيافتي — لوحة التحكم: رسائل للزباين
   بتفتح من الرئيسية. صاحب المحل بيكتب رسالة، وبتوصل إشعار لكل الزباين
   اللي كبسوا «بلّغني بالعروض» بالتطبيق (ملف 24_broadcasts.sql).
   الإرسال نفسه بيصير بـ notify-order بعد ما تنضاف الرسالة لجدول broadcasts.
   لحد 3 رسائل باليوم، والقاعدة هي اللي بتفرض هالحد.
   ========================================================= */
(() => {
  'use strict';

  const { $, db, fail, toast } = A;
  const TZ = 'Asia/Damascus';
  let subs = null;      // عدد الموبايلات المشتركة
  let sent = [];        // آخر الرسائل

  const phones = n => n === 1 ? 'موبايل واحد' : A.countAr(n, 'موبايل', 'موبايلين', 'موبايلات');

  const whenOf = iso => new Date(iso).toLocaleString('ar-SY-u-nu-latn', {
    weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', timeZone: TZ,
  });

  A.views.broadcast = {
    title: 'رسالة للزباين',
    parent: 'home',
    sub: () => subs == null ? 'إشعار عالموبايل لكل المشتركين' : subs === 1 ? 'موبايل واحد مشترك' : A.countAr(subs, 'موبايل مشترك', 'موبايلين مشتركين', 'موبايلات مشتركة'),
    render: load,
  };

  async function load() {
    const view = $('#view');
    view.innerHTML = '<div class="empty">لحظة...</div>';
    try {
      const [{ count, error }, rows] = await Promise.all([
        sb.from('promo_push_subscriptions').select('id', { count: 'exact', head: true }),
        db(sb.from('broadcasts').select('*').order('created_at', { ascending: false }).limit(20)),
      ]);
      if (error) throw error;
      if (A.current() !== 'broadcast') return;
      subs = count || 0;
      sent = rows;
      draw();
      A.refreshHead();
    } catch (err) {
      view.innerHTML = '<div class="empty"><b>ما قدرنا نفتح الشاشة</b>شيّك عالنت وجرّب كمان مرة.</div>';
      fail(err);
    }
  }

  const todayCount = () => sent.filter(b => Date.now() - new Date(b.created_at) < 24 * 3600 * 1000).length;

  function resultLine(b) {
    if (b.sent_count != null) return `وصلت لـ ${phones(b.sent_count)}`;
    if (b.sent_at) return 'عم تنبعت...';
    return 'لسا ما انبعتت';
  }

  function draw() {
    const left = Math.max(0, 3 - todayCount());
    const el = document.createElement('div');
    el.className = 'p-pad';
    el.innerHTML = `
      <form class="a-card bc-form" id="bcForm" novalidate>
        <label class="field" data-f="title">
          <span>العنوان</span>
          <input name="title" maxlength="60" autocomplete="off" value="ضيافتي">
          <span class="err">اكتب عنوان.</span>
        </label>
        <label class="field" data-f="body">
          <span>الرسالة <small id="bcCount">0 / 200</small></span>
          <textarea name="body" rows="3" maxlength="200" placeholder="مثلاً: عرض العيد 🌹 خصم 10% على كل البوكسات بكود EID10"></textarea>
          <span class="err">اكتب الرسالة.</span>
        </label>
        <div class="bc-preview" aria-hidden="true">
          <img src="icons/icon-192.png" alt="" width="36" height="36">
          <div><b id="bcPTitle">ضيافتي</b><span id="bcPBody">نص الرسالة بيطلع هون</span></div>
        </div>
        <button class="btn" type="submit" id="bcSend" ${!subs || !left ? 'disabled' : ''}>${subs ? `إرسال لـ ${phones(subs)}` : 'إرسال'}</button>
        <p class="caption">${!subs
          ? 'لسا ما حدا مشترك. الزبون بيشترك من زر «بلّغني بالعروض والجديد» بآخر صفحة التطبيق، أو بعد ما يطلب.'
          : left ? `فيك تبعت ${A.countAr(left, 'رسالة', 'رسالتين', 'رسائل')} كمان اليوم. الرسالة بتوصل لكل المشتركين، وما فيك ترجعها بعد ما تنبعت.`
            : 'بعتت 3 رسائل اليوم، وهاد الحد لحتى ما ينزعجوا الزباين ويسكّروا الإشعارات. جرّب بكرا.'}</p>
      </form>

      ${sent.length ? `
        <div class="sec"><h2>الرسائل اللي انبعتت</h2></div>
        <div class="a-card">
          ${sent.map(b => `
            <div class="srow">
              <div class="lbl">
                <b>${escapeHTML(b.title)}</b>
                <p>${escapeHTML(b.body)}</p>
                <span>${whenOf(b.created_at)}، ${resultLine(b)}</span>
              </div>
            </div>`).join('')}
        </div>` : ''}
    `;
    $('#view').replaceChildren(el);

    const form = $('#bcForm', el);
    const title = form.elements.title;
    const body = form.elements.body;
    const send = $('#bcSend', el);
    const label = send.textContent;
    let armed = false;
    const disarm = () => { armed = false; send.textContent = label; send.classList.remove('danger'); };

    form.addEventListener('input', () => {
      $('#bcCount', el).textContent = `${body.value.length} / 200`;
      $('#bcPTitle', el).textContent = title.value.trim() || 'ضيافتي';
      $('#bcPBody', el).textContent = body.value.trim() || 'نص الرسالة بيطلع هون';
      form.querySelectorAll('.field.invalid').forEach(f => f.classList.remove('invalid'));
      disarm();
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const t = title.value.trim();
      const m = body.value.trim();
      form.querySelector('[data-f="title"]').classList.toggle('invalid', !t);
      form.querySelector('[data-f="body"]').classList.toggle('invalid', !m);
      if (!t || !m) return;
      // كبستين: الرسالة ما بترجع بعد ما تنبعت
      if (!armed) {
        armed = true;
        send.textContent = 'متأكد؟ اكبس كمان مرة لتنبعت';
        send.classList.add('danger');
        return;
      }
      send.disabled = true;
      try {
        await db(sb.from('broadcasts').insert({ title: t, body: m }));
        toast('انبعتت الرسالة 👌');
        load();
      } catch (err) {
        send.disabled = false;
        disarm();
        if (/too_many_broadcasts/.test(err.message || '')) toast('بعتت 3 رسائل اليوم. جرّب بكرا.');
        else fail(err);
      }
    });
  }
})();
