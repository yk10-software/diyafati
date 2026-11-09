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

// الكمية بالحكي: ربع كيلو، نص كيلو، تلات أرباع كيلو، 1 كيلو، كيلو وربع، 2 كيلو ونص...
function formatQty(q, unit) {
  if (unit !== 'كيلو') return q + ' ' + unit;
  const quarters = Math.round(Number(q) * 4);
  const whole = Math.floor(quarters / 4);
  const part = ['', 'ربع', 'نص', 'تلات أرباع'][quarters % 4];
  if (!whole) return part + ' كيلو';
  if (!part) return whole + ' كيلو';
  return (whole === 1 ? 'كيلو' : whole + ' كيلو') + ' و' + part;
}

// الخطوة بالكيلو: ربع إذا أقل كمية ربع، وإلا نص (نفس الحساب بـ place_order)
function qtyStep(unit, minKilo) {
  if (unit !== 'كيلو') return 1;
  return Number(minKilo) < 0.5 ? 0.25 : 0.5;
}

// صورة الصنف الصغيرة (480px): نفس الاسم وآخرها -sm، بس لصور الأصناف بالتخزين.
// الصور القديمة ما إلها نسخة صغيرة، فالـ <img> بيرجع للكبيرة لحاله (smallImg تحت).
function smallImage(url) {
  return /\/storage\/v1\/object\/public\/images\/products\//.test(url || '')
    ? url.replace(/(\.[a-z0-9]+)(\?.*)?$/i, '-sm$1$2') : url;
}
// <img> بالنسخة الصغيرة، وإذا ما لقاها بياخد الكبيرة
function smallImg(url, attrs = '') {
  const small = smallImage(url);
  const back = small !== url ? ` data-full="${escapeHTML(url)}" onerror="this.onerror=null;this.src=this.dataset.full"` : '';
  return `<img src="${escapeHTML(small)}"${back} ${attrs}>`;
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
