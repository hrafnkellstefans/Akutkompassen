// Akutkompassen service worker – app shell + data shards, works offline after first visit.
// Bump VERSION together with index.html and ak_index.json on every release.
const VERSION = 'ak-v10s2d';
const SHELL = ['./', './index.html', './manifest.webmanifest', './favicon.png', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './ak_index.json'];
const SHARD_RE = /\/ak_(?!index)[A-Z]+\.json$/;

function putIfOk(cache, request, response) {
  if (response && response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION)
    .then(c => c.addAll(SHELL.map(path => new Request(path, {cache: 'reload'}))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k.startsWith('ak-v') && k !== VERSION).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  if (SHARD_RE.test(url.pathname)) {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const cached = await cache.match(e.request, {ignoreSearch: true});
      if (cached) return cached;
      const fresh = await fetch(e.request);
      return putIfOk(cache, e.request, fresh);
    })());
    return;
  }

  e.respondWith((async () => {
    try {
      const fresh = await fetch(e.request);
      const cache = await caches.open(VERSION);
      putIfOk(cache, e.request, fresh);
      return fresh;
    } catch (err) {
      const cache = await caches.open(VERSION);
      const cached = await cache.match(e.request, {ignoreSearch: true});
      if (cached) return cached;
      if (e.request.mode === 'navigate' || e.request.destination === 'document') {
        const page = await caches.match('./index.html');
        if (page) return page;
      }
      throw err;
    }
  })());
});
