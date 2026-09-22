// Run with: node --test tests/search.test.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const data = JSON.parse(fs.readFileSync(path.join(root, 'ak_index.json'), 'utf8'));
const engine = html.slice(html.indexOf('// ---------- tokenizer ----------'), html.indexOf('// ---------- structured text'));
const stopWords = html.match(/^const STOP = .*$/m)[0];

function searchEngine(withBodies = false) {
  const docs = structuredClone(data.docs);
  const context = vm.createContext({DOCS: docs, state: {kind: null}});
  vm.runInContext(stopWords + '\n' + engine + '\nglobalThis.runSearch=search; globalThis.loadText=addText;', context);
  if (withBodies) {
    const byId = new Map(docs.map(d => [d.id, d]));
    for (const shard of Object.values(data.shards)) {
      const content = JSON.parse(fs.readFileSync(path.join(root, shard), 'utf8'));
      for (const [id, blocks] of Object.entries(content.docs)) context.loadText(byId.get(id), blocks);
    }
  }
  return query => context.runSearch(query);
}

const queries = [
  ['högt kalium', 'GL82'], ['hyperkalaemia', 'GL82'], ['"högt kalium"', 'GL82'],
  ['tumörlys', 'GL83'], ['malign ryggmärgskompression', 'GL83'], ['vena cava superior', 'GL83'],
  ['immunterapi myokardit', 'GL84'], ['checkpoint pneumonit', 'GL84'],
  ['akut glaukom', 'GL85'], ['rött öga', 'GL85'], ['"akut glaukom"', 'GL85'],
  ['preseptal cellulit', 'GL86'], ['svullet öga', 'GL86'],
  ['kanylstopp', 'GL87'], ['stopp i trakeostomi', 'GL87'],
];

for (const withBodies of [false, true]) {
  test(`Guidelines are discoverable ${withBodies ? 'after' : 'before'} body prefetch`, () => {
    const search = searchEngine(withBodies);
    for (const [query, id] of queries) {
      const results = search(query).groups;
      const hit = results.find(g => g.d.id === id);
      assert.ok(hit, `${query} must find ${id}`);
      assert.ok(hit.titleOnly, 'Linked guideline must not pretend to have a body-text match');
      assert.equal(hit.hits.length, 0);
      assert.ok(results.findIndex(g => g.d.id === id) < 5, `${query} should surface ${id} in the first five results`);
    }
    assert.equal(search('och vid för').groups.length, 0);
    assert.equal(search('zzzxxyyqqnonexistent').groups.length, 0);
    assert.equal(search('"högt kalium" "akut glaukom"').groups.length, 0);
    assert.equal(search(''), null);
    assert.ok(search('GRACE dizziness').groups.some(g => g.d.id === 'GL25'));
    if (withBodies) assert.ok(search('insulin DKA').groups.some(g => g.d.id === '89' && g.hits.length));
  });
}

test('Registry, source types and release versions are consistent', () => {
  assert.equal(data.docs.length, 214);
  assert.equal(new Set(data.docs.map(d => d.id)).size, data.docs.length);
  const newDocs = data.docs.filter(d => /^GL8[2-7]$/.test(d.id));
  assert.equal(newDocs.length, 6);
  assert.equal(newDocs.filter(d => d.lvl === 'nationell').length, 5);
  for (const d of newDocs) {
    assert.equal(d.kind, 'gl');
    assert.equal(d.txt, 0);
    assert.ok(data.areas[d.a]);
    assert.equal(new URL(d.url).protocol, 'https:');
    assert.equal(d.verified, '2026-09-22');
    assert.ok(d.source_version && d.note && d.keywords.length);
  }
  assert.ok(html.includes(`data-v="${data.v}"`));
  assert.ok(fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes(`const VERSION = '${data.v}'`));
});
