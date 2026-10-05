// Run with: node --test tests/search-quality.test.cjs
// Search quality on the test searches from the review on 5 Oct 2026 (tests/search-queries.json),
// for both Vuxna (index.html + PM text) and Barn (barn/app.js + barn/data.json).
// The thresholds sit a little below the results on 5 Oct 2026, so a new document may move a
// single search one place without failing, while a real ranking regression fails.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
// Values made inside a vm context have that context's Array prototype; copy them before deepEqual.
const plain = x => JSON.parse(JSON.stringify(x));
const Q = JSON.parse(read('tests/search-queries.json'));

// ---------- Vuxna: the engine from index.html with all PM text loaded ----------
function adultEngine(docs) {
  const html = read('index.html');
  const part = (from, to) => html.slice(html.indexOf(from), html.indexOf(to));
  const data = JSON.parse(read('ak_index.json'));
  const ctx = vm.createContext({DOCS: docs || structuredClone(data.docs), state: {kind: null},
    esc: s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]))});
  vm.runInContext(read('search-terms.js') + '\n' + html.match(/^const STOP = .*$/m)[0] + '\n' +
    part('// ---------- tokenizer ----------', '// ---------- structured text') + '\n' +
    part('function searchExcerpt(', 'function renderSearch(') +
    '\nprefetchDone=true;globalThis.search=search;globalThis.addText=addText;globalThis.excerpt=searchExcerpt;', ctx);
  if (!docs) {
    const byId = new Map(ctx.DOCS.map(d => [d.id, d]));
    for (const shard of Object.values(data.shards))
      for (const [id, blocks] of Object.entries(JSON.parse(read(shard)).docs)) ctx.addText(byId.get(id), blocks);
  }
  return ctx;
}
let adultCache, adultCompare;
const adult = () => adultCache || (adultCache = adultEngine());
// Same order as the page: score, then the library order for ties (local PM, national, international; A–Ö).
function libraryOrder(docs, section) {
  const ctx = vm.createContext({document: {addEventListener() {}}, localStorage: {getItem: () => null}});
  vm.runInContext(read('popularity.js'), ctx);
  return ctx.AkPopularity.create(section, docs, () => {}).compare;
}
const adultIds = q => {
  const r = adult().search(q); if (!r) return [];
  adultCompare = adultCompare || libraryOrder(adult().DOCS, 'adult');
  return plain(r.groups.slice().sort((a, b) => (b.score - a.score) || adultCompare(a.d, b.d)).map(g => g.d.id));
};

// ---------- Barn: the search part of barn/app.js, ranked as on the page (no popularity counts) ----------
function barnEngine() {
  const app = read('barn/app.js');
  const data = JSON.parse(read('barn/data.json'));
  const ctx = vm.createContext({document: {addEventListener() {}}, localStorage: {getItem: () => null}});
  vm.runInContext(read('search-terms.js'), ctx);
  vm.runInContext(app.slice(0, app.indexOf('// ---------- page')) +
    '\nglobalThis.searchDocs=searchDocs;globalThis.ranked=ranked;globalThis.setData=x=>{data=x;};', ctx);
  ctx.setData(data);
  const compare = libraryOrder(data.docs, 'barn');
  return q => {const res = ctx.searchDocs(data.docs, q); return {res, docs: ctx.ranked(res, compare)};};
}
let barnCache;
const barn = () => barnCache || (barnCache = barnEngine());
const barnIds = q => plain(barn()(q).docs.map(d => d.id));

const rankIn = (ids, expected) => {const i = ids.findIndex(id => expected.includes(id)); return i < 0 ? null : i + 1;};
function battery(rows, idsOf) {
  return rows.map(([q, expected, cat]) => ({q, cat, rank: rankIn(idsOf(q), expected)}));
}
const count = (rows, ok) => rows.filter(ok).length;

test('Vuxna: the 142 test searches find the expected document near the top', () => {
  const rows = battery(Q.adult, adultIds);
  assert.equal(rows.length, 142);
  assert.deepEqual(rows.filter(r => !r.rank).map(r => r.q), [], 'searches that found none of the expected documents');
  const first = count(rows, r => r.rank === 1), top3 = count(rows, r => r.rank && r.rank <= 3);
  assert.ok(first >= 126, `expected document first in ${first}/142 searches (5 okt 2026: 131)`);
  assert.ok(top3 >= 133, `expected document in the top three in ${top3}/142 searches (5 okt 2026: 136)`);
  assert.deepEqual(rows.filter(r => r.cat === 'core' && r.rank > 8).map(r => `${r.q} (${r.rank})`), [],
    'common clinical searches must show the expected document on the first screen (top eight; 5 okt 2026: worst 6)');
});

test('Barn: the 64 test searches find the expected document near the top', () => {
  const rows = battery(Q.barn.filter(r => r[2] !== 'gap'), barnIds);
  assert.deepEqual(rows.filter(r => !r.rank).map(r => r.q), [], 'searches that found none of the expected documents');
  const first = count(rows, r => r.rank === 1), top3 = count(rows, r => r.rank && r.rank <= 3);
  assert.ok(first >= 55, `expected document first in ${first}/${rows.length} searches (5 okt 2026: 58)`);
  assert.ok(top3 >= 58, `expected document in the top three in ${top3}/${rows.length} searches (5 okt 2026: 60)`);
  assert.deepEqual(rows.filter(r => r.cat === 'core' && r.rank > 8).map(r => `${r.q} (${r.rank})`), []);
  // A correctly spelt word without any document gives no hits; it is not "corrected" into something else.
  for (const [q] of Q.barn.filter(r => r[2] === 'gap')) {
    const {res, docs} = barn()(q);
    assert.equal(docs.length, 0, `${q} has no document and should show none`);
    assert.deepEqual(plain(res.fixed), []);
  }
});

test('Without å/ä/ö, misspelt or inflected: the same document as the correct spelling', () => {
  for (const [section, idsOf, rows] of [['Vuxna', adultIds, Q.adult], ['Barn', barnIds, Q.barn]]) {
    for (const [q, , cat, base] of rows.filter(r => r[3])) {
      const got = idsOf(q), want = idsOf(base);
      if (cat === 'nodia') assert.deepEqual(got.slice(0, 10), want.slice(0, 10), `${section}: ${q} should rank exactly like ${base}`);
      else assert.ok(got.slice(0, 3).includes(want[0]), `${section}: ${q} should show the top hit for ${base} among its first three`);
    }
  }
});

test('Typos are corrected only when the word is found nowhere, and the correction is reported', () => {
  const corrected = adult().search('sepssis');
  assert.deepEqual(plain(corrected.fixed), [['sepssis', 'sepsis']]);
  assert.deepEqual(plain(adult().search('sepsis').fixed), []);
  assert.deepEqual(plain(barn()('hyponatermi').res.fixed), [['hyponatermi', 'hyponatremi']]);
  assert.deepEqual(plain(barn()('hyponatremi').res.fixed), []);
  // Barn also accepts a word missing its last two or three letters, so many typos at the end need no correction.
  assert.deepEqual(plain(barn()('dehydreing').res.fixed), []);
  assert.ok(barnIds('dehydreing').length);
  // Nothing close enough: no guess and no hits.
  assert.equal(adult().search('zzzxxyyqq').groups.length, 0);
  assert.equal(barnIds('zzzxxyyqq').length, 0);
});

test('Brand and generic drug names, abbreviations and English terms find each other', () => {
  const top = q => adultIds(q).slice(0, 3);
  for (const [a, b] of [['Eliquis', 'apixaban'], ['Waran', 'warfarin'], ['Actilyse', 'alteplas'], ['LP', 'lumbalpunktion'], ['KOL', 'COPD']])
    assert.ok(top(a).some(id => top(b).includes(id)), `${a} and ${b} should share a top-three document`);
  // Short words must start a word in Barn: "dos" is not found inside "ketoacidos".
  assert.ok(!barnIds('dos adrenalin').slice(0, 3).some(id => /dka|ketoacidos/i.test(id)));
});

test('Shared vocabulary: folding, symmetric synonyms, single words only', () => {
  const ctx = vm.createContext({});
  vm.runInContext(read('search-terms.js'), ctx);
  const T = ctx.AkTerms;
  assert.equal(T.fold('Bröstsmärta, akut'), 'brostsmarta akut');
  for (const [a, b] of [['eliquis', 'apixaban'], ['lungemboli', 'lungembolism'], ['feber', 'fever'], ['hlr', 'hjartstopp']]) {
    assert.ok(T.synonyms(a).includes(b), `${a} → ${b}`);
    assert.ok(T.synonyms(b).includes(a), `${b} → ${a}`);
  }
  assert.ok(!T.synonyms('hjartsvikt').includes('lungodem'), 'lungödem is a cause/finding, not a synonym of hjärtsvikt');
  assert.equal(T.distance('sepssis', 'sepsis', 2), 1);
  assert.equal(T.distance('kramp', 'karmp', 1), 1, 'two swapped letters count as one edit');
  assert.ok(T.distance('stroke', 'sepsis', 2) > 2);
  // The search works word by word, so every entry must be one folded word.
  for (const w of T.words()) assert.match(w, /^[a-z0-9µ]+$/, `"${w}" is not a single word`);
});

test('Vuxna: reference lists and document history rank low, clinical text and appendices do not', () => {
  const doc = {id: 'T1', t: 'Testdokument sepsis', a: 'INF', kind: 'pm', lvl: 'lokal', txt: 1};
  const ctx = adultEngine([doc]);
  ctx.addText(doc, [
    [1, '# Innehåll\nBehandling ..... 2\nReferenser ..... 3\nBilaga 1 Doseringstabell ..... 4', 1],
    [2, '# Behandling\nGe vätska vid sepsis.', 0],
    [3, '# Referenser\nAndersson A. Sepsis i Sverige. Läkartidningen 2020.\n# Datum\n2024-01-01', 0],
    [4, '# Bilaga 1 Doseringstabell\nNoradrenalin vid septisk chock.', 0],
  ]);
  const ref = text => doc.chunks.find(c => c.text.includes(text)).ref;
  assert.equal(ref('Ge vätska'), false);
  assert.equal(ref('Andersson A.'), true);
  assert.equal(ref('2024-01-01'), true, 'a history field inside the reference block keeps it a reference block');
  assert.equal(ref('Noradrenalin'), false, 'an appendix listed after the references in the table of contents ends the block');
  // Without a table of contents, any heading that is not a history field ends the block.
  const plain = {id: 'T2', t: 'Testdokument två', a: 'INF', kind: 'pm', lvl: 'lokal', txt: 1};
  const ctx2 = adultEngine([plain]);
  ctx2.addText(plain, [[1, '# Referenser\nBerg B. Studie. 2019.\n# Version\n3\n# Akut handläggning\nGe syrgas.', 0]]);
  const ref2 = text => plain.chunks.find(c => c.text.includes(text)).ref;
  assert.equal(ref2('Berg B.'), true);
  assert.equal(ref2('# Version'), true);
  assert.equal(ref2('Ge syrgas'), false);
});

test('Vuxna: search excerpts are plain reading text', () => {
  const ctx = adult();
  for (const [q] of Q.adult) {
    const r = ctx.search(q);
    for (const g of r.groups.slice(0, 3)) {
      if (!g.hits.length) continue;
      const e = ctx.excerpt(g.hits[0].text, r.hlTerms);
      assert.doesNotMatch(e, /https?:\/\/|www\.|(^|\s)\|(\s|$)|(^|\s)# /, `${q}: ${e.slice(0, 90)}`);
    }
  }
});
