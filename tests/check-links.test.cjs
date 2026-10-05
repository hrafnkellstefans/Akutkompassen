// Run with: node --test tests/check-links.test.cjs
// The weekly check (tools/check-links.mjs) without network: date parsing and the report.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const load = () => import(path.join(root, 'tools/check-links.mjs'));

test('Approval date: DocPlus puts labels first and values after', async () => {
  const {approvalDate} = await load();
  assert.equal(approvalDate('Godkänt den:\nAnsvarig:\nGäller för:\n\n2026-10-05\nUlrika B\nBarnintensivvårdsavdelningen'), '2026-10-05');
  assert.equal(approvalDate('Godkänt den: | 2025-05-14\nAnsvarig: | Fredrik Sund'), '2025-05-14');
  assert.equal(approvalDate('Riktlinje\nReviderad 2024-02-30?\nUtfärdad 2023-11-02'), '2023-11-02', 'impossible dates are skipped');
  assert.equal(approvalDate('Ingen datumrad här'), null);
});

test('Every local PM in Vuxna has an approval date in its stored text, so revisions can be detected', async () => {
  const {approvalDate} = await load();
  const index = JSON.parse(fs.readFileSync(path.join(root, 'ak_index.json'), 'utf8'));
  const text = new Map();
  for (const f of Object.values(index.shards))
    for (const [id, blocks] of Object.entries(JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')).docs)) text.set(id, blocks.slice(0, 3).map(b => b[1]).join('\n'));
  const missing = index.docs.filter(d => d.kind !== 'gl' && /publikdocplus/.test(d.url) && !approvalDate(text.get(d.id))).map(d => `${d.id} ${d.t}`);
  assert.deepEqual(missing, []);
});

test('Report: findings first, robots-blocked links folded away, nothing to do says so', async () => {
  const {report} = await load();
  const base = {lib: 'Vuxna', id: 'x', url: 'https://example.org/x', knownLabel: 'texten på Akutkompassen', docplus: true};
  const md = report({date: '2026-10-05', pdf: true, results: [
    {...base, title: 'Sepsis', kind: 'revised', known: '2024-01-01', live: '2026-10-01'},
    {...base, title: 'Gammal länk', kind: 'gone', status: 404, docplus: false},
    {...base, title: 'Förlag', kind: 'blocked', status: 403, docplus: false},
    {...base, title: 'OK', kind: 'ok'},
  ]});
  assert.match(md, /^<!-- findings: 2 -->/);
  assert.match(md, /## Reviderade i DocPlus \(1\)/);
  assert.match(md, /\| Vuxna \| \[Sepsis\]\(https:\/\/example.org\/x\) \| 2024-01-01 \(texten på Akutkompassen\) \| 2026-10-01 \|/);
  assert.match(md, /## Borttagna eller trasiga länkar \(1\)/);
  assert.match(md, /<details><summary>Kunde inte kontrolleras automatiskt \(1\)<\/summary>/);
  const quiet = report({date: '2026-10-05', pdf: true, results: [{...base, title: 'OK', kind: 'ok'}]});
  assert.match(quiet, /^<!-- findings: 0 -->/);
  assert.match(quiet, /Inga avvikelser/);
  assert.doesNotMatch(md, /Inga avvikelser/);
  assert.match(report({date: '2026-10-05', pdf: false, results: []}), /pdftotext saknas/);
});
