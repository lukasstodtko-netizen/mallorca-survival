// La app ya no usa service worker: este archivo desinstala el de la versión anterior y limpia su caché.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k))))
    .then(() => self.registration.unregister())
    .then(() => self.clients.matchAll({type:'window'}))
    .then(cs => cs.forEach(c => c.navigate(c.url))));
});
