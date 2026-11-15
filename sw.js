// Mallorca Survival · service worker: la app funciona sin cobertura en ruta.
const VERSION = 'ms27-v2';
const CORE = ['./','index.html','app.css','app.js','assets/route.json','assets/logo.png','assets/survival-waves-tile.jpg',
  'assets/fonts/glacial-400.woff2','assets/fonts/glacial-700.woff2','manifest.webmanifest','icon-192.png',
  'assets/maillot/1.jpg','assets/maillot/2.jpg','assets/maillot/3.jpg','assets/maillot/4.jpg','assets/maillot/5.jpg','assets/maillot/6.jpg','assets/maillot/7.jpg','assets/maillot/8.jpg',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js','https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => Promise.allSettled(CORE.map(u => c.add(u)))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.hostname.endsWith('supabase.co')) return;
  const fresh = r.mode === 'navigate' || /\.(html|css|js)$/.test(u.pathname) && u.origin === location.origin;
  if (fresh) { // red primero: siempre la última versión si hay cobertura
    e.respondWith(fetch(r).then(res => { const c = res.clone(); caches.open(VERSION).then(k => k.put(r, c)); return res; })
      .catch(() => caches.match(r).then(m => m || caches.match('index.html'))));
  } else { // caché primero para imágenes, fuentes, datos y three.js
    e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => { if (res.ok || res.type === 'opaque') { const c = res.clone(); caches.open(VERSION).then(k => k.put(r, c)); } return res; })));
  }
});
