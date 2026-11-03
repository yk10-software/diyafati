/* =========================================================
   ضيافتي — تعيين كلمة سر جديدة
   الإيميل تبع «نسيت كلمة السر» بيفتح هالصفحة، والرابط فيه جلسة مؤقتة.
   المكتبة بتقرأها لحالها (detectSessionInUrl)، ونحنا منغيّر كلمة السر.
   ========================================================= */
(async () => {
  'use strict';

  const $ = s => document.querySelector(s);
  const show = id => ['#checking', '#expired', '#resetForm', '#done'].forEach(s => { $(s).hidden = s !== id; });

  // إذا الرابط منتهي، Supabase بيرجّع خطأ بالرابط بدل الجلسة
  const hash = new URLSearchParams((window.RESET_HASH || '').slice(1));
  if (!sb || hash.get('error') || hash.get('error_code')) { show('#expired'); return; }

  // getSession بتستنى المكتبة تخلص قراءة الرابط
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { show('#expired'); return; }
  show('#resetForm');

  const form = $('#resetForm');
  form.addEventListener('input', e => {
    const f = e.target.closest('.field');
    if (f) f.classList.remove('invalid');
    $('#resetMsg').textContent = '';
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const password = form.password.value;
    const short = password.length < 8;
    const mismatch = password !== form.confirm.value;
    form.querySelector('[data-f="password"]').classList.toggle('invalid', short);
    form.querySelector('[data-f="confirm"]').classList.toggle('invalid', !short && mismatch);
    if (short || mismatch) return;

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    const { error } = await sb.auth.updateUser({ password });
    btn.disabled = false;
    if (error) { $('#resetMsg').textContent = authErrorAr(error); return; }
    show('#done');
  });
})();
