// Akutkompassen service worker: the app starts from the copy saved on the device (fast, and works
// offline), while a new release downloads in the background. The page then offers "Uppdatera",
// and switches by itself at the next start. All files of one release come from one cache, so a page
// never mixes old and new files.
// Bump VERSION on every release (the same string as data-v in index.html and barn/index.html).
const VERSION = 'ak-v10s42-snabbguide';
const SHELL = ['./', './index.html', './shared.css', './usability.js', './search-terms.js', './popularity.js', './visitor-analytics.js', './popularity-config.js', './statistik.html', './manifest.webmanifest', './logo-v2.png', './favicon.png', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './ak_index.json', './akutversioner/akut-divertikulit.pdf', './barn/', './barn/index.html', './barn/app.js', './barn/data.json', './barn/manifest.webmanifest',];
// cache:'reload' skips the browser's HTTP cache (GitHub Pages: max-age=600), so a new release never
// stores a ten-minute-old copy of a file from the previous one.
const fresh = url => new Request(url, {cache: 'reload'});
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(SHELL.map(fresh));
    // PM text for all areas, so search and reading work offline from the first visit.
    // Best effort: one failed area must not stop the release from installing.
    try {
      const idx = await (await c.match('./ak_index.json')).json();
      await Promise.allSettled(Object.values(idx.shards).map(f => c.add(fresh('./' + f + '?v=' + encodeURIComponent(idx.v)))));
    } catch (err) { /* the missing areas are fetched when opened */ }
    // First visit: take over at once. A new release waits for "Uppdatera" or the next start.
    if (!self.registration.active) await self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;                 // DocPlus, publishers, counters → network
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    const saved = await c.match(req, {ignoreSearch: true});
    if (saved) return saved;
    try {
      const res = await fetch(req);
      if (res.ok && /\/ak_[A-Z]+\.json$/.test(url.pathname)) c.put(req, res.clone());
      return res;
    } catch (err) {
      // Offline and not saved: a page address opens the start page of its library.
      if (req.mode === 'navigate') {
        const page = await c.match(url.pathname.includes('/barn') ? './barn/index.html' : './index.html');
        if (page) return page;
      }
      return new Response('', {status: 503, statusText: 'Offline'});
    }
  })());
});
