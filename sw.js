// Keep each app release and its document data together, including offline.
// Bump VERSION together with index.html and ak_index.json on every release.
const VERSION = 'ak-v10s2d';
const SHELL = ['./', './index.html', './manifest.webmanifest', './favicon.png', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './ak_index.json'];
const AREAS = ['TRA','KAR','HLR','AK','NEU','INF','GI','END','URO','LUN','ALL','TOX','PSY','PRO','ORT','GYN','HEM','LM','RAD','ONH','OPS'];
const ASSETS = [...SHELL, ...AREAS.map(a => './ak_' + a + '.json')];
const assetURLs = new Set(ASSETS.map(path => new URL(path, self.registration.scope).href));
self.addEventListener('install', e => {
  // Install only when the complete release is cached. A failed install leaves
  // the previous worker available. Don't replace a worker under an open reader.
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS.map(path => new Request(path, {cache:'reload'})))));
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
  const requestedVersion = url.searchParams.get('v');
  url.search = '';
  if (!assetURLs.has(url.href)) return;
  // Never answer a request for another release with this release's data.
  if (requestedVersion && requestedVersion !== VERSION) return;
  e.respondWith(caches.open(VERSION).then(async cache => {
    const cached = await cache.match(url.href);
    if (cached) return cached;
    // Do not cache error responses or use HTML as a fallback for JSON/images.
    return fetch(e.request);
  }));
});
