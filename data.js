/* =========================================================
   ضيافتي — إعدادات وأدوات مشتركة
   الأقسام والأصناف والقصص والإعدادات صارت كلها بـ Supabase،
   وبتتعدّل من لوحة التحكم. هون بس الأشياء الثابتة والأدوات اللي
   بتستعملها واجهة الزبون واللوحة سوا.
   ========================================================= */

const CONFIG = {
  shopName: 'ضيافتي',
  currency: 'ل.س',
  // رقم احتياطي إذا ما قدرنا نجيب الإعدادات من Supabase. الرقم الحقيقي بيتعدّل من اللوحة.
  whatsapp: '963953334642',
};

/* أدوات مشتركة */
function formatPrice(n) {
  return Math.round(n).toLocaleString('en-US') + ' ' + CONFIG.currency;
}

function formatQty(q, unit) {
  if (unit !== 'كيلو') return q + ' ' + unit;
  const whole = Math.floor(q);
  const half = q % 1 === 0.5;
  if (whole === 0 && half) return 'نص كيلو';
  if (whole === 1 && !half) return '1 كيلو';
  if (whole === 1 && half) return 'كيلو ونص';
  return whole + ' كيلو' + (half ? ' ونص' : '');
}

function qtyStep(unit) {
  return unit === 'كيلو' ? 0.5 : 1;
}

function escapeHTML(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function normalizeAr(s) {
  return String(s || '')
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase()
    .trim();
}

// سعر الصنف بعد الخصم إذا في خصم شغّال (نفس الحساب اللي بـ place_order)
function effectivePrice(p) {
  const saleOn = p.sale_price != null && (!p.sale_until || new Date(p.sale_until) > new Date());
  return saleOn ? p.sale_price : p.price;
}
