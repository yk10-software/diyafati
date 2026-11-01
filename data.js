/* =========================================================
   ضيافتي — بيانات التطبيق
   كل شي بيخص المحل (الرقم، الأقسام، الأصناف، القصص) موجود هون.
   ========================================================= */

const CONFIG = {
  shopName: 'ضيافتي',
  // رقم واتساب المحل اللي بتوصل عليه الطلبات (بدون + وبدون أصفار بالبداية)
  whatsapp: '963953334642',
  currency: 'ل.س',
  // خلّيها true بالنسخة التجريبية، ورجعها false بالنسخة الحقيقية
  demo: true,
  adminPin: '1234',
  // آخر يوم للنسخة التجريبية، بعده بيوقف التطبيق وبتطلع رسالة التفعيل
  demoUntil: '2026-11-09T23:59:59+03:00',
  // رابط واتساب YK10 Software للتفعيل
  activateLink: 'https://wa.me/message/6LHRU6HTBT2EO1',
};

const CATEGORIES = [
  { id: 'all',      name: 'الكل' },
  { id: 'mawaleed', name: 'ضيافة مواليد' },
  { id: 'choco',    name: 'شوكولا' },
  { id: 'mlabbas',  name: 'ملبس' },
  { id: 'flowers',  name: 'أزهار', soon: true },
];

const DEFAULT_PRODUCTS = [
  {
    id: 'harisa-boy',
    name: 'هريسة لوز بيبي صبي',
    cat: 'mawaleed',
    price: 2000,
    unit: 'كيلو',
    images: ['img/harisa-boy.jpg'],
    desc: 'قطع هريسة لوز بشكل سيارة، كل قطعة مغلفة لحالها. لضيافة المواليد.',
    available: true,
  },
  {
    id: 'harisa-girl',
    name: 'هريسة لوز بيبي بنت',
    cat: 'mawaleed',
    price: 2000,
    unit: 'كيلو',
    images: ['img/harisa-girl.jpg'],
    desc: 'قطع هريسة لوز بشكل رضّاعة، كل قطعة مغلفة لحالها. لضيافة المواليد.',
    available: true,
  },
  {
    id: 'choco-mix',
    name: 'شوكولا ضيافتي ميكس',
    cat: 'choco',
    price: 2600,
    unit: 'كيلو',
    images: ['img/choco-mix.jpg'],
    desc: 'شوكولا ميكس لوز وبندق، بتغليف ذهبي باسم ضيافتي.',
    available: true,
  },
  {
    id: 'choco-lotus',
    name: 'شوكولا ضيافتي ويفر باللوتس',
    cat: 'choco',
    price: 2500,
    unit: 'كيلو',
    images: ['img/choco-lotus.jpg'],
    desc: 'شوكولا محشية ويفر بكريمة اللوتس.',
    available: true,
  },
  {
    id: 'mlabbas-print',
    name: 'ملبس مطبوع خاص',
    cat: 'mlabbas',
    price: 3000,
    unit: 'كيلو',
    images: ['img/mlabbas-1.jpg', 'img/mlabbas-2.jpg'],
    desc: 'ملبس بينطبع عليه الاسم أو اللوغو اللي بدك ياه لمناسبتك.',
    customNote: 'شو بدك ينطبع على الملبس؟ (اسم، تاريخ، لوغو...)',
    available: true,
  },
];

// القصص: صور من شغل المحل بالمناسبات، وكل صورة ممكن تفتح الصنف تبعها
const STORIES = [
  { id: 's-mawaleed', title: 'مواليد', items: [
    { img: 'img/harisa-boy.jpg',  product: 'harisa-boy' },
    { img: 'img/harisa-girl.jpg', product: 'harisa-girl' },
  ]},
  { id: 's-choco', title: 'شوكولا', items: [
    { img: 'img/choco-mix.jpg',   product: 'choco-mix' },
    { img: 'img/choco-lotus.jpg', product: 'choco-lotus' },
  ]},
  { id: 's-mlabbas', title: 'ملبس مطبوع', items: [
    { img: 'img/mlabbas-1.jpg', product: 'mlabbas-print' },
    { img: 'img/mlabbas-2.jpg', product: 'mlabbas-print' },
  ]},
];

/* ---------------------------------------------------------
   طبقة الحفظ
   بالنسخة التجريبية: الأصناف بتنحفظ بذاكرة المتصفح (على نفس الجهاز).
   بالنسخة الحقيقية: بتستبدل هالدوال بطلبات لـ Supabase،
   وبيصير التعديل من اللوحة يوصل لكل الزباين.
   --------------------------------------------------------- */
const PRODUCTS_KEY = 'diyafati_products_v1';

const Store = {
  load() {
    try {
      const saved = localStorage.getItem(PRODUCTS_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) { /* ذاكرة المتصفح مو متاحة */ }
    return JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
  },
  save(list) {
    try {
      localStorage.setItem(PRODUCTS_KEY, JSON.stringify(list));
      return true;
    } catch (e) {
      return false;
    }
  },
  reset() {
    try { localStorage.removeItem(PRODUCTS_KEY); } catch (e) {}
  },
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

/* النسخة التجريبية: الشريط وتاريخ الانتهاء */
function demoExpired() {
  return CONFIG.demo && CONFIG.demoUntil && Date.now() > new Date(CONFIG.demoUntil).getTime();
}

function demoEndLabel() {
  return new Date(CONFIG.demoUntil).toLocaleDateString('ar-SY-u-nu-latn', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Damascus',
  });
}

function addDemoStrip() {
  if (!CONFIG.demo) return;
  const app = document.querySelector('.app');
  const strip = document.createElement('div');
  strip.className = 'demo-strip';
  strip.textContent = 'نسخة تجريبية، بتنتهي ' + demoEndLabel();
  app.prepend(strip);
}

function showDemoExpired() {
  document.querySelectorAll('.cartbar, .overlay, .story-view').forEach(el => el.remove());
  document.body.style.overflow = '';
  document.querySelector('.app').innerHTML = `
    <div class="expired">
      <img src="img/logo-full.png" alt="ضيافتي" width="100" height="120">
      <h1>انتهت الفترة التجريبية</h1>
      <p>لتفعيل تطبيق ضيافتي، تواصل مع <bdi>YK10 Software</bdi></p>
      <a class="btn" href="${CONFIG.activateLink}" target="_blank" rel="noopener">تواصل لتفعيل التطبيق</a>
    </div>`;
}
