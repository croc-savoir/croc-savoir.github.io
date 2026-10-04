/* ===================== Service Worker ==========================
 * - "shell" : app (html/css/js/polices/icônes) → précaché, versionné.
 * - "data"  : data/app/index.json + détails à la demande → mis en cache au fur
 *   et à mesure (stale-while-revalidate), pour supporter l'ajout de
 *   nouveaux domaines/lots sans jamais devoir republier le service worker.
 * ================================================================= */
const SHELL_VERSION = 'v32';
const SHELL_CACHE = `culture-g-shell-${SHELL_VERSION}`;
const DATA_CACHE = 'culture-g-data';

const SHELL_FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/storage.js',
  'js/srs.js',
  'js/data-loader.js',
  'js/quiz-generators.js',
  'js/fiches.js',
  'js/quiz.js',
  'js/stats.js',
  'js/daily.js',
  'js/library.js',
  'js/dragon.js',
  'js/app.js',
  'fonts/mplus-rounded-500.woff2',
  'fonts/mplus-rounded-700.woff2',
  'fonts/mplus-rounded-800.woff2',
  'fonts/zen-maru-400.woff2',
  'fonts/zen-maru-700.woff2',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(names => Promise.all(
      names
        .filter(n => n.startsWith('culture-g-shell-') && n !== SHELL_CACHE)
        .map(n => caches.delete(n))
    )).then(() => self.clients.claim())
  );
});

function isDataRequest(url) {
  return url.pathname.includes('/data/') && url.pathname.endsWith('.json');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Data JSON : stale-while-revalidate (fonctionne hors-ligne dès le 1er chargement,
  // se met à jour tout seul en tâche de fond dès qu'il y a du réseau).
  // Drapeaux : ils ne changent jamais → cache d'abord, réseau sinon.
  if (url.pathname.includes('/data/dragon-tour/drapeaux/')) {
    event.respondWith(
      caches.open(DATA_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  // Détails des fiches : URL versionnée (?v=…), contenu immuable → cache d'abord.
  // À chaque nouvelle version, les anciennes copies du même fichier sont supprimées.
  if (url.pathname.includes('/data/app/details/')) {
    event.respondWith(
      caches.open(DATA_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        if (res && res.ok) {
          const old = await cache.keys();
          await Promise.all(old
            .filter(k => new URL(k.url).pathname === url.pathname && k.url !== req.url)
            .map(k => cache.delete(k)));
          await cache.put(req, res.clone());
        }
        return res;
      })
    );
    return;
  }

  if (isDataRequest(url)) {
    // Données (fiches, quiz) : réseau d'abord pour avoir le contenu à jour dès le
    // premier rafraîchissement ; copie en cache pour le hors-ligne.
    event.respondWith(
      fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(DATA_CACHE).then(cache => cache.put(req, copy));
        }
        return res;
      }).catch(() => caches.match(req).then(c => c || new Response('[]', { headers: { 'Content-Type': 'application/json' } })))
    );
    return;
  }

  // App shell (page, JS, CSS, polices) : réseau d'abord pour avoir toujours la
  // dernière version en ligne ; cache en secours hors-ligne.
  const cacheKey = req.mode === 'navigate' ? 'index.html' : req;
  // cache: 'no-cache' → le navigateur revalide auprès du serveur (réponse 304 légère)
  // au lieu de resservir une vieille copie de son cache HTTP.
  const fresh = req.mode === 'navigate'
    ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
    : fetch(req, { cache: 'no-cache' });
  event.respondWith(
    fresh.then(res => {
      if (res && res.ok && (req.mode === 'navigate' || SHELL_FILES.some(f => req.url.endsWith(f)))) {
        const copy = res.clone();
        caches.open(SHELL_CACHE).then(cache => cache.put(cacheKey, copy));
      }
      return res;
    }).catch(() => caches.match(cacheKey))
  );
});
