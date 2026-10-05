// Run with: node --test tests/offline.test.cjs
// The service worker (sw.js): every file the pages need is saved for offline use, a release is
// installed without the browser's HTTP cache, saved files are used before the network, and a new
// release waits for "Uppdatera" or the next start instead of switching under the reader.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const sw = read('sw.js');
const index = JSON.parse(read('ak_index.json'));
const ORIGIN = 'https://akutkompassen.se';

// ---------- a small fake of the service worker environment ----------
function worker({active = false, saved = {}, online = true} = {}) {
  const store = new Map(Object.entries(saved).map(([p, body]) => [ORIGIN + p, body]));
  const log = {skipWaiting: 0, claim: 0, added: [], network: [], deleted: []};
  const on = {};
  class Request {
    constructor(url, init = {}) {
      this.url = new URL(typeof url === 'string' ? url : url.url, ORIGIN + '/').href;
      this.cache = init.cache || 'default'; this.method = init.method || 'GET'; this.mode = init.mode || 'cors';
    }
  }
  class Response {
    constructor(body = '', init = {}) {this.body = body; this.status = init.status ?? 200; this.ok = this.status >= 200 && this.status < 300;}
    clone() {return new Response(this.body, {status: this.status});}
    async json() {return JSON.parse(this.body);}
  }
  const files = p => {const f = path.join(root, p.replace(/^\//, '') || 'index.html'); return fs.existsSync(f) && fs.statSync(f).isFile() ? fs.readFileSync(f, 'utf8') : fs.existsSync(path.join(f, 'index.html')) ? fs.readFileSync(path.join(f, 'index.html'), 'utf8') : null;};
  async function fetch(req) {
    const r = req instanceof Request ? req : new Request(req);
    log.network.push(r);
    if (!online) throw new TypeError('Failed to fetch');
    const body = files(new URL(r.url).pathname);
    return body === null ? new Response('', {status: 404}) : new Response(body);
  }
  const key = (r, ignoreSearch) => {const u = new URL(typeof r === 'string' ? r : r.url, ORIGIN + '/'); return ignoreSearch ? u.origin + u.pathname : u.href;};
  const cache = {
    async addAll(reqs) {for (const r of reqs) await cache.add(r);},
    async add(r) {r = r instanceof Request ? r : new Request(r); log.added.push(r); const res = await fetch(r); if (!res.ok) throw new TypeError('bad status'); store.set(key(r), res.body);},
    async put(r, res) {store.set(key(r), res.body);},
    async match(r, opt = {}) {
      const want = key(r, opt.ignoreSearch);
      for (const [k, body] of store) if ((opt.ignoreSearch ? key(k, true) : k) === want) return new Response(body);
      return undefined;
    },
  };
  const caches = {
    names: new Set(['ak-old-release']),
    async open(name) {caches.names.add(name); return cache;},
    async keys() {return [...caches.names];},
    async delete(name) {log.deleted.push(name); return caches.names.delete(name);},
  };
  const self = {
    registration: {active: active ? {} : null},
    clients: {claim: async () => {log.claim++;}},
    skipWaiting: async () => {log.skipWaiting++;},
    addEventListener: (type, fn) => {on[type] = fn;},
  };
  const ctx = vm.createContext({self, caches, fetch, Request, Response, URL, Promise, location: new URL(ORIGIN + '/sw.js'), console});
  vm.runInContext(sw, ctx);
  const run = async (type, extra = {}) => {
    let waited, responded;
    const e = {...extra, waitUntil: p => {waited = p;}, respondWith: p => {responded = p;}};
    on[type](e);
    if (waited) await waited;
    return responded ? await responded : undefined;
  };
  const get = (p, mode = 'cors') => run('fetch', {request: new Request(ORIGIN + p, {mode})});
  return {log, store, caches, run, get, VERSION: vm.runInContext('VERSION', ctx), SHELL: vm.runInContext('SHELL', ctx), setOnline: v => {online = v;}};
}

test('The release name is the same in sw.js, both pages and the data index', () => {
  const v = sw.match(/const VERSION = '([^']+)'/)[1];
  assert.equal(index.v, v);
  assert.ok(read('index.html').includes(`data-v="${v}"`));
  assert.ok(read('barn/index.html').includes(`data-v="${v}"`));
});

test('Everything the pages load from this site is in the offline shell, and every shell file exists', () => {
  const {SHELL} = worker();
  const shell = new Set(SHELL.map(s => new URL(s, ORIGIN + '/').pathname));
  for (const page of ['index.html', 'barn/index.html', 'statistik.html']) {
    const html = read(page), base = ORIGIN + '/' + page;
    const refs = [...html.matchAll(/<(?:script[^>]*\bsrc|link[^>]*\bhref)="([^"]+)"/g)].map(m => m[1]);
    for (const ref of refs) {
      const u = new URL(ref, base);
      if (u.origin !== ORIGIN || /canonical/.test(html.slice(Math.max(0, html.indexOf(ref) - 40), html.indexOf(ref)))) continue;
      assert.ok(shell.has(u.pathname), `${page} loads ${u.pathname}, which is not saved for offline use`);
    }
  }
  for (const p of shell) {
    const f = path.join(root, p.replace(/^\//, ''));
    assert.ok(fs.existsSync(f.endsWith('/') ? path.join(f, 'index.html') : f) || fs.existsSync(path.join(f, 'index.html')), `${p} is in the shell but missing`);
  }
});

test('First visit: shell and PM text of every area are saved without the HTTP cache, and the worker takes over', async () => {
  const w = worker();
  await w.run('install');
  assert.ok(w.log.added.length >= w.SHELL.length + Object.keys(index.shards).length);
  assert.ok(w.log.added.every(r => r.cache === 'reload'), 'a release must not store ten-minute-old copies from the HTTP cache');
  for (const f of Object.values(index.shards)) assert.ok(w.log.added.some(r => new URL(r.url).pathname === '/' + f), `${f} not saved`);
  assert.equal(w.log.skipWaiting, 1);
  await w.run('activate');
  assert.deepEqual(w.log.deleted, ['ak-old-release']);
  assert.equal(w.log.claim, 1);
});

test('A new release waits for "Uppdatera" (or the next start) instead of switching under the reader', async () => {
  const w = worker({active: true});
  await w.run('install');
  assert.equal(w.log.skipWaiting, 0);
  await w.run('message', {data: 'skipWaiting'});
  assert.equal(w.log.skipWaiting, 1);
});

test('Saved files are used before the network; offline, page addresses open the start page', async () => {
  const w = worker({saved: {'/index.html': 'ADULT', '/barn/index.html': 'BARN', '/shared.css': 'CSS', '/ak_TRA.json': '{"docs":{}}'}});
  assert.equal((await w.get('/shared.css?v=x')).body, 'CSS');
  assert.equal((await w.get('/ak_TRA.json?v=x')).body, '{"docs":{}}');
  assert.equal(w.log.network.length, 0, 'saved files must not wait for the network');
  // Not saved yet: fetched once, PM text kept for next time.
  const res = await w.get('/ak_PSY.json?v=x');
  assert.equal(res.status, 200);
  assert.ok(w.store.has(ORIGIN + '/ak_PSY.json?v=x'));
  w.setOnline(false);
  assert.equal((await w.get('/okand-sida', 'navigate')).body, 'ADULT');
  assert.equal((await w.get('/barn/okand', 'navigate')).body, 'BARN');
  assert.equal((await w.get('/okand.js')).status, 503);
  // Other sites (DocPlus, publishers, counters) are left to the browser.
  assert.equal(await w.run('fetch', {request: {method: 'GET', url: 'https://publikdocplus.regionuppsala.se/x', mode: 'navigate'}}), undefined);
});
