/* Service worker : rend l'application installable et utilisable hors ligne.
   Stratégie « cache d'abord » — la collection ne bouge pas, autant la servir
   depuis le téléphone et ne toucher au réseau que pour les nouveautés. */
const CACHE = 'bac-a-vinyles-v1';
const COQUILLE = [
  './', './index.html', './app.js', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png'
];

self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(COQUILLE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys()
      .then(noms => Promise.all(noms.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', evt => {
  if (evt.request.method !== 'GET') return;
  evt.respondWith(
    caches.match(evt.request).then(trouve => {
      if (trouve) return trouve;
      return fetch(evt.request).then(reponse => {
        // On garde une copie (polices Google comprises) pour la prochaine fois.
        const copie = reponse.clone();
        caches.open(CACHE).then(c => c.put(evt.request, copie)).catch(() => {});
        return reponse;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
