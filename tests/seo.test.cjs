// Run with: node --test tests/seo.test.cjs
// Pages for search engines (tools/build-seo.mjs): one page per local PM with its full text, a list
// of every document, and a sitemap. They must match the library, so a release that changes the data
// without running "node tools/build-seo.mjs" fails here.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {RESERVED, redact} = require('../tools/seo-rules.cjs');

const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const SITE = 'https://akutkompassen.se';
const index = JSON.parse(read('ak_index.json'));
const TEXT = {};
for (const f of Object.values(index.shards)) Object.assign(TEXT, JSON.parse(read(f)).docs);
const unescape = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const pageDirs = fs.readdirSync(path.join(root, 'pm'), {withFileTypes: true}).filter(e => e.isDirectory()).map(e => e.name);
const forbidsCopying = id => TEXT[id].some(c => RESERVED.test(c[1]));
const barnHref = d => {const u = new URL(d.url, `${SITE}/barn/`).href; return u.startsWith(`${SITE}/`) ? u.slice(SITE.length) : u;};

test('The search pages and the sitemap are up to date with the library', () => {
  const r = spawnSync(process.execPath, [path.join(root, 'tools/build-seo.mjs'), '--check'], {encoding: 'utf8'});
  assert.equal(r.status, 0, r.stderr || r.stdout);
});

test('Every local PM with text has a page, except documents that forbid copying; guidelines have none', () => {
  const local = index.docs.filter(d => d.kind !== 'gl' && d.txt && TEXT[d.id]);
  const want = local.filter(d => !forbidsCopying(d.id)).map(d => d.id).sort();
  assert.deepEqual([...pageDirs].sort(), want);
  assert.ok(want.length > 100);
  assert.ok(!pageDirs.includes('23932'), 'the burns compendium forbids copying and must not get a full-text page');
  for (const d of index.docs.filter(d => d.kind === 'gl')) assert.ok(!pageDirs.includes(d.id), `${d.id} is a guideline: title and link only`);
});

test('No PM text in the app comes from a document that forbids copying (those are title and link only)', () => {
  for (const [id, chunks] of Object.entries(TEXT)) {
    const hit = chunks.find(c => RESERVED.test(c[1]));
    assert.ok(!hit, `${id} page ${hit && hit[0]}: the text reserves its copyright; make it link only (txt 0, no text in the shard) or get permission`);
  }
  const burns = index.docs.find(d => d.id === '23932');
  assert.equal(burns.txt, 0, 'the burns compendium is link only');
  assert.ok(burns.keywords.includes('brännskada'), 'and still found by burns searches');
});

test('Each PM page has its own title, description, address and links, and the whole PM text', () => {
  const byId = new Map(index.docs.map(d => [d.id, d]));
  for (const id of pageDirs) {
    const d = byId.get(id), html = read(`pm/${id}/index.html`), url = `${SITE}/pm/${id}/`;
    assert.equal((html.match(/<title>/g) || []).length, 1, id);
    const title = unescape(/<title>([^<]+)<\/title>/.exec(html)[1]);
    assert.ok(title.startsWith(d.t.normalize('NFC')), `${id}: the title starts with the PM title`);
    assert.ok(title.length <= 70 || title === `${d.t.normalize('NFC')} | Akutkompassen`, `${id}: title too long (${title.length})`);
    assert.ok(html.includes('<meta name="generator" content="tools/build-seo.mjs">'), `${id}: generator tag (only such folders are ever removed)`);
    assert.ok(!/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(html), `${id}: an e-mail address is in the page text`);
    const desc = unescape(/<meta name="description" content="([^"]*)">/.exec(html)[1]);
    assert.ok(desc.length >= 50 && desc.length <= 160, `${id}: description ${desc.length} characters`);
    assert.ok(html.includes(`<link rel="canonical" href="${url}">`), `${id}: canonical`);
    assert.equal((html.match(/<h1>/g) || []).length, 1, id);
    assert.ok(!/noindex/.test(html), id);
    assert.ok(html.includes(`href="${esc(d.url)}"`), `${id}: link to the original in DocPlus`);
    assert.ok(html.includes(`href="/#pm=${id}"`), `${id}: link into the app`);
    if (d.summaryUrl) assert.ok(html.includes(`href="/${d.summaryUrl}"`), `${id}: link to the snabbguide`);
    const ld = JSON.parse(/<script type="application\/ld\+json">(.+?)<\/script>/s.exec(html)[1]);
    assert.equal(ld['@graph'][0]['@id'], url);
    assert.equal(ld['@graph'][1]['@type'], 'BreadcrumbList');
    // Nothing from the PM is left out: every line of its text is on the page (contact details
    // replaced by a pointer to the original, see tools/seo-rules.cjs).
    const body = unescape(html);
    for (const c of TEXT[id]) for (const line of redact(c[1]).split('\n')) {
      const t = line.replace(/^(# |• |◦ |\| )/, '').trim();
      for (const part of t.split(' | ')) if (part.trim()) assert.ok(body.includes(part.trim()), `${id} page ${c[0]}: missing "${part.slice(0, 60)}"`);
    }
  }
});

test('The list page links every document: PM pages inside the site, everything else at its publisher', () => {
  const html = read('pm/index.html');
  assert.ok(html.includes(`<link rel="canonical" href="${SITE}/pm/">`));
  for (const d of index.docs) {
    const link = pageDirs.includes(d.id) ? `href="/pm/${d.id}/"` : `href="${esc(d.url)}"`;
    assert.ok(html.includes(link), `${d.id} missing from the list page`);
  }
  for (const d of JSON.parse(read('barn/data.json')).docs) {
    assert.ok(html.includes(`href="${esc(barnHref(d))}"`), `Barn: ${d.id} missing`);
    if (d.archive) assert.ok(html.includes('Bibliotekskopia · giltighet ej verifierad'), `Barn: ${d.id} must keep its warning`);
  }
  assert.ok(!html.includes('href="../'), 'links from Barn data must work from /pm/');
});

test('The sitemap lists every page that exists, and only those', () => {
  const xml = read('sitemap.xml');
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'));
  const entries = [...xml.matchAll(/<url><loc>([^<]+)<\/loc><lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod><\/url>/g)].map(m => m[1]);
  assert.equal(entries.length, (xml.match(/<url>/g) || []).length, 'every entry has an address and a date');
  assert.equal(new Set(entries).size, entries.length, 'no address twice');
  for (const u of [`${SITE}/`, `${SITE}/barn/`, `${SITE}/pm/`, ...pageDirs.map(id => `${SITE}/pm/${id}/`)]) assert.ok(entries.includes(u), `${u} not in the sitemap`);
  for (const u of entries) {
    const p = decodeURI(new URL(u).pathname).replace(/^\//, '');
    const f = path.join(root, p.endsWith('/') || !p ? p + 'index.html' : p);
    assert.ok(fs.existsSync(f), `${u} is in the sitemap but there is no such page`);
  }
});

test('Search engines are pointed at the sitemap, and nothing that should be found is blocked', () => {
  const robots = read('robots.txt');
  assert.ok(robots.includes(`Sitemap: ${SITE}/sitemap.xml`));
  const general = robots.split(/\n(?=User-agent:)/).find(g => /^User-agent: \*$/m.test(g));
  const blocked = [...general.matchAll(/^Disallow: (\S*)$/gm)].map(m => m[1]);
  for (const p of ['/', '/pm/', '/barn/', '/pm/10049/', '/sitemap.xml', '/ak_index.json', '/shared.css']) {
    assert.ok(!blocked.some(b => b && p.startsWith(b)), `${p} is blocked for search engines`);
  }
});

test('The start page tells search engines what the site is called and links to the list page', () => {
  for (const page of ['index.html', 'barn/index.html']) {
    const html = read(page);
    assert.ok(!/noindex/.test(html), page);
    assert.ok(/<title>Akutkompassen[^<]* – [^<]+<\/title>/.test(html), `${page}: descriptive title`);
    assert.ok(/<a href="(\.\.\/)?pm\/(#barn)?">/.test(html), `${page}: crawlable link to the list of all documents`);
  }
  const ld = JSON.parse(/<script type="application\/ld\+json">(.+?)<\/script>/s.exec(read('index.html'))[1]);
  assert.equal(ld['@type'], 'WebSite');
  assert.equal(ld.name, 'Akutkompassen');
  assert.equal(ld.url, `${SITE}/`);
  assert.ok(/<meta name="robots" content="noindex">/.test(read('statistik.html')), 'the settings page is not a search result');
});
