/* =========================================================
   ضيافتي — اتصال واجهة الزبون بـ Supabase
   الزبون ما بيسجّل دخول، وكل اللي بيحتاجه قراءة الكتالوج واستدعاء دوال
   (place_order، get_order...). فبدل مكتبة supabase-js (218KB) منستعمل fetch
   مباشرة على REST API تبع Supabase، وهيك التطبيق أخف عالنت الضعيف.
   لازم ينحمّل بعد config.js.
   ========================================================= */

const API = (() => {
  const headers = { apikey: SUPABASE_KEY };

  // بيرمي خطأ فيه الرسالة اللي رجّعتها قاعدة البيانات (متل invalid_coupon)
  async function handle(res) {
    const text = await res.text();
    const body = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const err = new Error((body && body.message) || 'http_' + res.status);
      err.status = res.status;
      throw err;
    }
    return body;
  }

  return {
    // قراءة جدول: API.get('products?select=id,name&order=sort_order')
    async get(path) {
      return handle(await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers }));
    },
    // استدعاء دالة: API.rpc('get_order', { p_token: '...' })
    async rpc(name, args = {}) {
      return handle(await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
        signal: AbortSignal.timeout(20000),   // النت الضعيف: ما منعلّق الزبون للأبد
      }));
    },
  };
})();
