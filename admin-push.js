/* =========================================================
   ضيافتي — لوحة التحكم: إشعارات الطلبات
   القسم اللي بشاشة الإعدادات: تفعيل الإشعارات على هالموبايل، وإيقافها،
   وإرسال إشعار تجريبي. الاشتراك بينحفظ بجدول push_subscriptions،
   والإرسال من Edge Function اسمها notify-order.
   ========================================================= */
(() => {
  'use strict';

  const { $, db, toast } = A;

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  let lastResult = '';

  // مفتاح VAPID العام بصيغة بيفهمها المتصفح
  function keyBytes(b64u) {
    const s = b64u.replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(s + '='.repeat((4 - s.length % 4) % 4)), c => c.charCodeAt(0));
  }

  // الـ service worker ممكن ما يجهز أبداً إذا فشل، فما منستنى للأبد
  function workerReady() {
    return Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, rej) => setTimeout(() => rej(new Error('sw_timeout')), 15000)),
    ]);
  }

  // بيرجّع وضع الإشعارات على هالجهاز
  async function status() {
    if (!window.isSecureContext) return { key: 'insecure' };
    if (isIOS && !isStandalone) return { key: 'ios-install' };
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return { key: 'unsupported' };
    if (Notification.permission === 'denied') return { key: 'denied' };
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    return sub ? { key: 'on', sub } : { key: 'off' };
  }

  async function saveSubscription(sub) {
    const j = sub.toJSON();
    await db(sb.from('push_subscriptions').upsert({
      endpoint: j.endpoint,
      p256dh: j.keys.p256dh,
      auth: j.keys.auth,
      user_agent: navigator.userAgent.slice(0, 200),
    }, { onConflict: 'endpoint' }));
  }

  const NOTES = {
    insecure: 'الإشعارات بدها https. جرّبها من رابط Netlify، مو من Live Server على IP.',
    'ios-install': 'عالآيفون لازم تضيف اللوحة عالشاشة الرئيسية من Safari، وتفتحها من الأيقونة، وبعدين بتفعّل الإشعارات من هون.',
    unsupported: 'هالمتصفح ما بيدعم الإشعارات. جرّب Chrome عالأندرويد، أو آيفون iOS 16.4 وأحدث.',
    denied: 'الإشعارات محظورة لهالموقع. فعّلها من إعدادات الموبايل أو المتصفح، وبعدين ارجع لهون.',
    off: 'مطفية على هالجهاز',
    on: 'مفعّلة على هالجهاز',
  };

  async function render(box) {
    if (!box || !box.isConnected) return;
    let st;
    try { st = await status(); } catch (err) { console.error(err); st = { key: 'unsupported' }; }
    if (!box.isConnected) return;

    box.innerHTML = `
      <div class="srow">
        <div class="lbl"><b>إشعارات الطلبات</b><span>${NOTES[st.key]}</span></div>
        ${st.key === 'off' ? '<button class="btn-sm" type="button" id="pushOn">فعّل</button>' : ''}
        ${st.key === 'on' ? '<button class="link-btn" type="button" id="pushOff">إيقاف</button>' : ''}
      </div>
      ${st.key === 'on' ? `
      <div class="srow">
        <div class="lbl"><b>إشعار تجريبي</b><span>سكّر التطبيق بعد ما تكبس، ولازم يوصلك</span></div>
        <button class="btn-sm" type="button" id="pushTest">ابعت</button>
      </div>` : ''}
      ${lastResult ? `<p class="caption" role="status" style="padding-bottom:10px">${escapeHTML(lastResult)}</p>` : ''}
    `;

    const on = $('#pushOn', box);
    if (on) on.addEventListener('click', () => enable(box, on));
    const off = $('#pushOff', box);
    if (off) off.addEventListener('click', () => disable(box, st.sub, off));
    const test = $('#pushTest', box);
    if (test) test.addEventListener('click', () => sendTest(box, test));

    // إذا الجهاز مشترك بس الصف انمحى من الجدول، منرجّع نحفظه
    if (st.key === 'on') saveSubscription(st.sub).catch(err => console.warn(err));
  }

  async function enable(box, btn) {
    btn.disabled = true;
    lastResult = '';
    try {
      // عالآيفون لازم الطلب يطلع مباشرة من الكبسة، فهو أول شي
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { render(box); return; }

      const reg = await workerReady();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(VAPID_PUBLIC_KEY),
      });
      try {
        await saveSubscription(sub);
      } catch (err) {
        await sub.unsubscribe();   // ما منخلي اشتراك ما حدا بيعرف عنه
        throw err;
      }
      toast('انفعّلت الإشعارات');
    } catch (err) {
      console.error(err);
      // هاد الخطأ بيعني الموبايل ما قدر يوصل لخدمة الإشعارات (FCM)، وهو اللي منفحصه من سوريا
      lastResult = err.name === 'AbortError'
        ? `الموبايل ما قدر يوصل لخدمة الإشعارات (${err.message}). جرّب على نت تاني، وابعت هالنص ليزن.`
        : `ما انفعّلت الإشعارات: ${err.name || ''} ${err.message || ''}`;
    }
    render(box);
  }

  async function disable(box, sub, btn) {
    btn.disabled = true;
    try {
      await db(sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint));
      await sub.unsubscribe();
      lastResult = '';
      toast('انطفت الإشعارات على هالجهاز');
    } catch (err) { A.fail(err); }
    render(box);
  }

  async function sendTest(box, btn) {
    btn.disabled = true;
    lastResult = 'عم نبعت...';
    try {
      const { data, error } = await sb.functions.invoke('notify-order', { body: { test: true } });
      if (error) throw error;
      const r = data || {};
      // accepted معناها خدمة الإشعارات استلمته، والوصول للموبايل هو اللي لازم تشوفه بعينك
      lastResult = r.failed && r.failed.length
        ? `فشل: ${r.failed.map(f => `${f.host} ${f.status} ${f.detail}`).join(' | ')}`
        : `خدمة الإشعارات استلمته (${r.accepted} من ${r.subscriptions}). إذا ما وصل الموبايل خلال دقيقة، هاد يعني مشكلة بالوصول للجهاز.`;
    } catch (err) {
      console.error(err);
      lastResult = `ما قدرنا نوصل لدالة notify-order: ${err.name || ''} ${err.message || ''}`;
    }
    btn.disabled = false;
    render(box);
  }

  A.push = { render };
})();
