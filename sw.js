/* ضيافتي — بيخلّي التطبيق يفتح بسرعة وحتى لو النت ضعيف.
   كل ما تعدّل ملفات وترفعها، غيّر رقم النسخة هون (v1 → v2) لحتى يوصل التحديث للزباين. */
const CACHE = 'diyafati-v4';
const SHELL = [
  './', 'index.html', 'admin.html', 'styles.css', 'data.js', 'app.js', 'admin.js',
  'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-64.png',
  'img/logo-mark.png', 'img/logo-word.png', 'img/logo-full.png',
  'img/harisa-boy.jpg', 'img/harisa-girl.jpg', 'img/choco-mix.jpg', 'img/choco-lotus.jpg',
  'img/mlabbas-1.jpg', 'img/mlabbas-2.jpg',
  'fonts/reem-kufi-arabic-500-normal.woff2', 'fonts/reem-kufi-arabic-600-normal.woff2',
  'fonts/ibm-plex-sans-arabic-arabic-400-normal.woff2', 'fonts/ibm-plex-sans-arabic-arabic-500-normal.woff2',
  'fonts/ibm-plex-sans-arabic-arabic-600-normal.woff2', 'fonts/ibm-plex-sans-arabic-latin-400-normal.woff2',
  'fonts/ibm-plex-sans-arabic-latin-500-normal.woff2', 'fonts/ibm-plex-sans-arabic-latin-600-normal.woff2',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  // الصفحات: من النت أول شي (لحتى تبيّن التحديثات)، وإذا ما في نت من الذاكرة
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })
        .catch(() => caches.match(req).then(r => r || caches.match('index.html')))
    );
    return;
  }

  // الصور والملفات: من الذاكرة أول شي، وبنفس الوقت بتتحدّث من النت
  e.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
