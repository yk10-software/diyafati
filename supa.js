/* =========================================================
   ضيافتي — الاتصال بـ Supabase
   بيعمل `sb` (العميل) مرة وحدة، وبتستعمله كل الصفحات.
   لازم ينحمّل بعد مكتبة supabase-js وبعد config.js.
   ========================================================= */

const sb = (() => {
  const notSet = !window.supabase
    || SUPABASE_URL.includes('YOUR-PROJECT')
    || SUPABASE_KEY.startsWith('PASTE-');
  if (notSet) {
    console.error('Supabase مو مضبوط: شيّك على config.js، وإنو مكتبة supabase-js انحمّلت.');
    return null;
  }

  // حماية: إذا حدا حط المفتاح السري بالغلط، منرفض نشتغل فيه
  if (SUPABASE_KEY.startsWith('sb_secret_') || jwtRole(SUPABASE_KEY) === 'service_role') {
    console.error('⚠ هاد مفتاح سري! شيله من config.js فوراً، وغيّره من لوحة Supabase.');
    return null;
  }

  return window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: true,      // صاحب المحل بيضل داخل عالموبايل
      autoRefreshToken: true,
      detectSessionInUrl: true,  // لرابط «نسيت كلمة السر»
      flowType: 'implicit',      // لحتى يمشي الرابط حتى لو انفتح من جهاز تاني
    },
  });

  function jwtRole(key) {
    try { return JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role; }
    catch (e) { return null; }
  }
})();

/* ترجمة أخطاء تسجيل الدخول للعربي */
function authErrorAr(err) {
  if (!err) return '';
  const code = err.code || '';
  const map = {
    invalid_credentials: 'الإيميل أو كلمة السر غلط.',
    email_not_confirmed: 'هالإيميل لسا ما تأكّد.',
    user_banned: 'هالحساب موقّف.',
    over_request_rate_limit: 'محاولات كتير ورا بعض. استنى شوي وجرّب.',
    over_email_send_rate_limit: 'انبعتت إيميلات كتير. استنى شي ساعة وجرّب.',
    same_password: 'كلمة السر الجديدة لازم تختلف عن القديمة.',
    weak_password: 'كلمة السر ضعيفة. خليها 8 أحرف وأكتر، وفيها أرقام وأحرف.',
    reauthentication_needed: 'لازم تسجّل خروج وتفوت من جديد قبل ما تغيّر كلمة السر.',
    session_expired: 'خلصت الجلسة. سجّل دخول من جديد.',
  };
  if (map[code]) return map[code];
  if (err.status === 429) return map.over_request_rate_limit;
  if (err.name === 'AuthRetryableFetchError' || /fetch|network/i.test(err.message || '')) {
    return 'ما في اتصال بالنت، أو الاتصال ضعيف. جرّب كمان مرة.';
  }
  console.error(err);
  return 'صار خطأ، جرّب كمان شوي.';
}
