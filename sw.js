// Akutkompassen service worker – app shell + data shards, works offline after first visit.
// Bump VERSION on every release (build.py does this).
const VERSION = 'ak-v10s38-sok';
const SHELL = ['./', './index.html', './shared.css', './appearance.css', './appearance.js', './usability.js', './search-terms.js', './popularity.js', './visitor-analytics.js', './popularity-config.js', './statistik.html', './manifest.webmanifest', './logo-v2.png', './favicon.png', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './ak_index.json', './barn/', './barn/index.html', './barn/style.css', './barn/app.js', './barn/data.json', './barn/manifest.webmanifest',];
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(SHELL);
    // Also store the PM text for all areas now. Text the page fetched before this worker took
    // control never reached the cache, so 8 areas were missing offline after a first visit.
    // Best effort: one failed area must not stop the app shell from installing.
    try {
      const idx = await (await c.match('./ak_index.json')).json();
      await Promise.allSettled(Object.values(idx.shards).map(f => c.add('./' + f + '?v=' + encodeURIComponent(idx.v))));
    } catch (err) { /* offline search then fills in as areas are opened */ }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;                 // DocPlus, publishers, fonts → network
  if (/\/ak_(?!index)[A-Z]+\.json$/.test(url.pathname)) {
    // shards are immutable per VERSION: cache first
    e.respondWith(caches.open(VERSION).then(c => c.match(e.request, {ignoreSearch:true}).then(r => r || fetch(e.request).then(n => { if (n.ok) c.put(e.request, n.clone()); return n; }))));
    return;
  }
  // shell + index: network first, cache fallback
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.open(VERSION).then(c => c.match(e.request, {ignoreSearch:true})).then(r => r || (e.request.mode === 'navigate' ? caches.match(url.pathname.includes('/barn') ? './barn/index.html' : './index.html') : new Response('', {status:503})))));
});
