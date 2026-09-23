// Akutkompassen service worker – app shell + data shards, works offline after first visit.
// Bump VERSION on every release (build.py does this).
const VERSION = 'ak-v10s6-area-colors';
const SHELL = ['./', './index.html', './shared.css', './manifest.webmanifest', './logo-v2.png', './favicon.png', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './ak_index.json', './barn/', './barn/index.html', './barn/style.css', './barn/app.js', './barn/data.json',];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
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
