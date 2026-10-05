#!/usr/bin/env node
// Veckokontroll av PM och länkar. Rapporterar, ändrar ingenting på webbplatsen.
//
//  • Lokala PM (Vuxna) i DocPlus: jämför "Godkänt den" i dagens PDF med datumet i texten på
//    Akutkompassen. Nyare datum i DocPlus = PM:et är reviderat och texten här behöver bytas.
//  • Region Uppsalas PM i Barn: jämför samma datum med datumet på kortet.
//  • Alla länkar (riktlinjer, Karolinska, nationella källor): finns sidan kvar?
//
// Kör: node tools/check-links.mjs [--report rapport.md] [--json rapport.json] [--only pm|links]
// Kräver Node 20 eller senare. Datumjämförelsen kräver pdftotext (poppler-utils); utan det
// kontrolleras bara att länkarna fungerar.
import {readFile, writeFile, appendFile} from 'node:fs/promises';
import {execFile, spawn} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = name => {const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : null;};
const only = opt('only');
// ASCII only: some servers answer 400 to å/ä/ö in a header.
const UA = 'Akutkompassen-lankkontroll/1.0 (+https://akutkompassen.se; weekly link check)';
const TIMEOUT = 30000, PARALLEL = 4;
const run = promisify(execFile);
const json = async f => JSON.parse(await readFile(path.join(root, f), 'utf8'));

// ---------- dates ----------
const DATE = /(19|20)\d\d-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])/g;
const real = d => {const t = Date.parse(d + 'T00:00:00Z'); return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === d;};
const firstDate = (text, from = 0, within = Infinity) => {
  for (const m of text.slice(from).matchAll(DATE)) {if (m.index > within) break; if (real(m[0])) return m[0];}
  return null;
};
// DocPlus PDFs start with "Godkänt den:" (labels first, values after), so take the first date after it.
export function approvalDate(text) {
  if (!text) return null;
  const at = text.search(/Godk[äa]nt/);
  return (at >= 0 && firstDate(text, at, 300)) || firstDate(text.slice(0, 600));
}
function pdfText(buf) {
  return new Promise(resolve => {
    const p = spawn('pdftotext', ['-l', '2', '-', '-']);
    let out = ''; p.stdout.on('data', d => {out += d;}); p.on('error', () => resolve(null));
    p.on('close', code => resolve(code === 0 ? out : null));
    p.stdin.on('error', () => {}); p.stdin.end(buf);
  });
}
async function hasPdftotext() {try {await run('pdftotext', ['-v']); return true;} catch {return false;}}

// ---------- fetching ----------
const wait = ms => new Promise(r => setTimeout(r, ms));
// Follows redirects by hand to tell a permanent move (301/308: the address should be updated)
// from a temporary one (302/303/307, e.g. a download link that hands out a file).
async function get(url, {body = false} = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      let at = url, moved = null, res;
      for (let hop = 0; hop < 8; hop++) {
        res = await fetch(at, {redirect: 'manual', headers: {'User-Agent': UA, 'Accept': '*/*'}, signal: AbortSignal.timeout(TIMEOUT)});
        const next = res.status >= 300 && res.status < 400 && res.headers.get('location');
        if (!next) break;
        res.body?.cancel().catch(() => {});
        const to = new URL(next, at).href;
        if ((res.status === 301 || res.status === 308) && !moved && !sameAddress(to, url)) moved = to;
        at = to;
      }
      const out = {status: res.status, finalUrl: at, moved, type: res.headers.get('content-type') || ''};
      if (body && res.ok) out.buf = Buffer.from(await res.arrayBuffer()); else res.body?.cancel().catch(() => {});
      // Server errors and odd refusals are often momentary: try once more.
      if ((res.status >= 500 || res.status === 400 || res.status === 408) && attempt === 0) {await wait(5000); continue;}
      return out;
    } catch (err) {
      if (attempt === 0) {await wait(5000); continue;}
      return {status: 0, error: err.name === 'TimeoutError' ? 'tidsgräns' : 'kunde inte ansluta'};
    }
  }
}
async function pool(items, fn) {
  const out = new Array(items.length); let next = 0;
  await Promise.all(Array.from({length: PARALLEL}, async () => {while (next < items.length) {const i = next++; out[i] = await fn(items[i]);}}));
  return out;
}
const sameAddress = (a, b) => {try {const x = new URL(a), y = new URL(b); return x.host.replace(/^www\./, '') === y.host.replace(/^www\./, '') && x.pathname.replace(/\/$/, '') === y.pathname.replace(/\/$/, '');} catch {return a === b;}};
function classify(r, url) {
  if (r.status === 0) return 'unreachable';
  if (r.status === 404 || r.status === 410) return 'gone';
  if ([401, 403, 429].includes(r.status)) return 'blocked';
  if (r.status >= 400) return 'unreachable';
  if (r.moved) return 'moved';
  return 'ok';
}

// ---------- the check ----------
export async function check() {
  const adult = await json('ak_index.json'), barn = await json('barn/data.json');
  const stored = new Map();
  for (const f of Object.values(adult.shards)) for (const [id, blocks] of Object.entries((await json(f)).docs)) stored.set(id, approvalDate(blocks.slice(0, 3).map(b => b[1]).join('\n')));
  const pdf = await hasPdftotext();
  const items = [
    ...adult.docs.map(d => ({lib: 'Vuxna', id: d.id, title: d.t, url: d.url, docplus: /publikdocplus/.test(d.url) && d.kind !== 'gl', known: stored.get(d.id) || d.publishedOn || null, knownLabel: 'texten på Akutkompassen'})),
    ...barn.docs.map(d => ({lib: 'Barn', id: d.id, title: d.title, url: /^https?:/.test(d.url) ? d.url : new URL(d.url.replace(/^\.\.\//, ''), 'https://akutkompassen.se/').href, docplus: /publikdocplus/.test(d.url), known: d.date || null, knownLabel: 'datumet på kortet'})),
  ].filter(x => !only || (only === 'pm' ? x.docplus : !x.docplus));
  const results = await pool(items, async x => {
    const r = await get(x.url, {body: x.docplus && pdf});
    const res = {...x, status: r.status, finalUrl: r.finalUrl, moved: r.moved, error: r.error, kind: classify(r, x.url)};
    if (x.docplus && res.kind === 'ok') {
      if (!/pdf/i.test(r.type) && !(r.buf && r.buf.subarray(0, 5).toString() === '%PDF-')) res.kind = 'notpdf';
      else if (r.buf) {res.live = approvalDate(await pdfText(r.buf)); if (x.known && res.live && res.live !== x.known) res.kind = res.live > x.known ? 'revised' : 'older';}
    }
    return res;
  });
  return {date: new Date().toISOString().slice(0, 10), pdf, results};
}

// ---------- report ----------
const esc = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
export function report({date, pdf, results}) {
  const of = k => results.filter(r => r.kind === k);
  const lines = [], table = (rows, head, row) => {if (!rows.length) return; lines.push('', '| ' + head.join(' | ') + ' |', '|' + head.map(() => '---').join('|') + '|', ...rows.map(r => '| ' + row(r).map(esc).join(' | ') + ' |'));};
  const link = r => `[${esc(r.title)}](${r.url})`;
  const revised = of('revised'), older = of('older'), notpdf = of('notpdf'), gone = of('gone'), blocked = of('blocked'), unreachable = of('unreachable'), moved = of('moved');
  const findings = revised.length + older.length + notpdf.length + gone.length + moved.length;
  lines.push(`<!-- findings: ${findings} -->`, `# PM- och länkkontroll ${date}`, '',
    `Kontrollerade ${results.length} dokument: ${results.filter(r => r.lib === 'Vuxna').length} i Vuxna och ${results.filter(r => r.lib === 'Barn').length} i Barn, varav ${results.filter(r => r.docplus).length} i DocPlus.` +
    ` Ingenting ändras automatiskt på webbplatsen.`);
  if (!pdf) lines.push('', '> pdftotext saknas, så datum i DocPlus jämfördes inte. Bara länkarna kontrollerades.');
  if (!findings) lines.push('', '**Inga avvikelser.** Alla PM har samma godkännandedatum som i DocPlus, och ingen länk är borttagen eller flyttad.');
  if (revised.length) {lines.push('', `## Reviderade i DocPlus (${revised.length})`, '', 'DocPlus har en nyare version än den som visas här. Byt PM-texten (Vuxna) eller datumet på kortet (Barn).');
    table(revised, ['Bibliotek', 'Dokument', 'Datum här', 'Datum i DocPlus'], r => [r.lib, link(r), `${r.known} (${r.knownLabel})`, r.live]);}
  if (older.length) {lines.push('', `## Äldre datum i DocPlus än här (${older.length})`, '', 'Ovanligt. Kontrollera att länken pekar på rätt dokument.');
    table(older, ['Bibliotek', 'Dokument', 'Datum här', 'Datum i DocPlus'], r => [r.lib, link(r), r.known, r.live]);}
  if (gone.length || notpdf.length) {lines.push('', `## Borttagna eller trasiga länkar (${gone.length + notpdf.length})`, '', 'Sidan finns inte längre (404/410), eller DocPlus svarar utan PDF (dokumentet kan vara upphävt).');
    table([...gone, ...notpdf], ['Bibliotek', 'Dokument', 'Svar'], r => [r.lib, link(r), r.kind === 'notpdf' ? 'ingen PDF' : r.status]);}
  if (moved.length) {lines.push('', `## Flyttade (${moved.length})`, '', 'Länken fungerar, men sidan har flyttat permanent (301/308). Byt gärna till den nya adressen.');
    table(moved, ['Bibliotek', 'Dokument', 'Ny adress'], r => [r.lib, link(r), r.moved]);}
  if (blocked.length || unreachable.length) {lines.push('', `<details><summary>Kunde inte kontrolleras automatiskt (${blocked.length + unreachable.length})</summary>`, '', 'Många förlag stoppar automatiska kontroller (401/403/429), och vissa svarade inte. Det betyder inte att länken är trasig; öppna den i webbläsaren vid behov.');
    table([...blocked, ...unreachable], ['Bibliotek', 'Dokument', 'Svar'], r => [r.lib, link(r), r.status || r.error]); lines.push('', '</details>');}
  return lines.join('\n') + '\n';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const result = await check();
  const md = report(result);
  process.stdout.write(md);
  if (opt('report')) await writeFile(opt('report'), md);
  if (opt('json')) await writeFile(opt('json'), JSON.stringify(result.results.map(({buf, ...r}) => r), null, 1));
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, md);
}
