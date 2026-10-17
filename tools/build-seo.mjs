#!/usr/bin/env node
// Akutkompassen: pages that search engines can index.
//
// In the app every PM opens inside the start page (/#pm=10049). Google treats all those addresses as
// the start page, so no PM text can be found by a search. This script builds, from the same data:
//   pm/<id>/index.html  one page per local PM with text (title, description, full text, links to
//                       DocPlus, to the app and to the snabbguide)
//   pm/index.html       every document in the library, local PM, guidelines and Barn
//   sitemap.xml         every page above, the two app pages and the snabbguide PDFs
// International and national guidelines get no page of their own: they are title + link only.
// Shared rules (documents that forbid copying, contact details kept in the original) are in
// tools/seo-rules.cjs.
//
// Run after every change to ak_index.json, the ak_XX.json files, barn/data.json, index.html,
// barn/index.html, om/index.html or the snabbguide PDFs:
//   node tools/build-seo.mjs          writes the files above and tools/seo-lastmod.json
//   node tools/build-seo.mjs --check  changes nothing; fails if any of them is out of date
// tests/seo.test.cjs runs --check, so a release that forgets this step fails its tests.
// A run removes at most 5 PM pages (documents that left the library); more needs --allow-removals.
//
// tools/seo-lastmod.json keeps a fingerprint and a date for every address in the sitemap. The date
// only changes when the content of that address changes (not for a new release name or new styles),
// so <lastmod> tells Google what really changed.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import rules from './seo-rules.cjs';

const {RESERVED, redact} = rules;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://akutkompassen.se';
const CHECK = process.argv.includes('--check');
const ALLOW_REMOVALS = process.argv.includes('--allow-removals');
const MANIFEST = 'tools/seo-lastmod.json';
const GENERATOR = '<meta name="generator" content="tools/build-seo.mjs">';

const file = f => path.join(ROOT, f);
const read = f => fs.readFileSync(file(f), 'utf8');
const readJson = f => JSON.parse(read(f));
const sha = (...parts) => {const h = crypto.createHash('sha256'); for (const p of parts) h.update(p); return h.digest('hex').slice(0, 16);};
const today = () => new Intl.DateTimeFormat('sv-SE', {timeZone: 'Europe/Stockholm'}).format(new Date());

// ---------- data ----------
const INDEX = readJson('ak_index.json');
const BARN = readJson('barn/data.json');
const AREAS = INDEX.areas;
const DOCS = INDEX.docs;
const TEXT = {};
for (const f of Object.values(INDEX.shards)) Object.assign(TEXT, readJson(f).docs);
const collator = new Intl.Collator('sv', {sensitivity: 'base', numeric: true});
const byTitle = (a, b) => collator.compare(a.t ?? a.title, b.t ?? b.title);
// A page of its own: a local PM whose text is in the library (the same documents the app reads),
// unless the document itself forbids copying: those are listed with a link to DocPlus only.
const reserved = d => TEXT[d.id].some(c => RESERVED.test(c[1]));
const PAGES = DOCS.filter(d => d.kind !== 'gl' && d.txt && TEXT[d.id] && !reserved(d));
const LINK_ONLY = DOCS.filter(d => d.kind !== 'gl' && d.txt && TEXT[d.id] && reserved(d));
for (const d of PAGES) if (!/^[A-Za-z0-9_-]+$/.test(d.id)) throw new Error(`Unusable id for a page address: ${d.id}`);

// ---------- helpers ----------
const esc = s => String(s ?? '').normalize('NFC').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
const svDate = iso => {const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}` : '';};
const norm = s => String(s).normalize('NFC').toLowerCase().replace(/[^a-z0-9åäöéü]+/g, ' ').trim();
const clip = (s, n) => {s = s.replace(/\s+/g, ' ').trim(); if (s.length <= n) return s; const cut = s.slice(0, n - 1); return cut.slice(0, Math.max(cut.lastIndexOf(' '), n - 25)).replace(/[\s,.;:–-]+$/, '') + '…';};
const jsonLd = obj => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
// Same rules as the apps: an older local PM (before 2022 or marked as expired) is flagged, a note
// that says what it applies to is a plain note and anything else a warning; on Barn a document from
// 2021 or earlier is older, and a saved library copy is marked as not verified.
const isOld = d => d.kind !== 'gl' && ((d.yr && +d.yr < 2022) || /utgick|utgått/i.test(d.note || ''));
const noteClass = note => /gäller/i.test(note) ? 'note' : 'warn';
const barnYear = d => Number((d.date || '').slice(0, 4) || d.year || 0);
// Links in barn/data.json are relative to /barn/; on these pages they must work from /pm/.
const barnUrl = d => {const u = new URL(d.url, `${SITE}/barn/`).href; return u.startsWith(`${SITE}/`) ? u.slice(SITE.length) : u;};

// Structured PM text (the same markup the app reads) to HTML: "# " heading, "• "/"◦ " list item,
// "| " table row with " | " between cells, anything else a paragraph.
function textHtml(text) {
  let out = '', list = false, table = false;
  const endList = () => {if (list) {out += '</ul>'; list = false;}};
  const endTable = () => {if (table) {out += '</tbody></table></div>'; table = false;}};
  for (const raw of redact(text).split('\n')) {
    if (raw.startsWith('• ') || raw.startsWith('◦ ')) {
      endTable();
      if (!list) {out += '<ul>'; list = true;}
      out += `<li${raw[0] === '◦' ? ' class="l2"' : ''}>${esc(raw.slice(2))}</li>`;
    } else if (raw.startsWith('| ')) {
      endList();
      if (!table) {out += '<div class="table-scroll"><table><tbody>'; table = true;}
      out += '<tr>' + raw.slice(2).split(' | ').map(c => `<td>${esc(c)}</td>`).join('') + '</tr>';
    } else {
      endList(); endTable();
      if (raw.startsWith('# ')) out += `<h2>${esc(raw.slice(2))}</h2>`;
      else if (raw.trim()) out += `<p>${esc(raw)}</p>`;
    }
  }
  endList(); endTable();
  return out;
}

// Search-result description: the PM's own statement of purpose, else its first real paragraph
// (not the document header, the table of contents or the title), else its section headings.
const TOC_LINE = /^(.+?)\s*(?:…+|\.{2,})\s*\d+\s*$/;
const HEADER_LINE = /^(godkänt|godkänd|ansvarig|gäller för|giltig|dokumentnamn|dokument-?id|version|utgåva|sida \d|den:|fastställ|upprättad|reviderad|granskad|författare|diarienummer|beslutad|tips!|relaterade)/i;
// The title again (possibly with a few more words) says nothing new.
const sameAsTitle = (t, title) => {const a = norm(t); return a === title || (a.length <= title.length + 15 && (title.includes(a) || a.includes(title)));};
// Not a description: a fragment that starts mid-sentence, links, people with their titles,
// or a list of phone numbers.
const notProse = t => /^[a-zåäö]/.test(t) || /https?:|www\.|@|\.pdf\b|\.(se|eu|com|org)\b/i.test(t) || /^[A-ZÅÄÖ][a-zåäöé]+ [A-ZÅÄÖ][a-zåäöé-]+( [A-ZÅÄÖ][a-zåäöé-]+)?,/.test(t) || (t.match(/\b\d{3} \d{2}\b/g) || []).length > 1;
const PURPOSE = /^(syfte|bakgrund|omfattning|inledning|introduktion|sammanfattning)/i;
function excerpt(d) {
  const chunks = TEXT[d.id].map(c => [c[0], redact(c[1]), c[2]]), title = norm(d.t);
  const usable = (line, min) => {
    const t = line.trim().replace(/^[•◦*]+\s*/, '');
    // A line that introduces a list ("... röda flaggor:") only if it says enough on its own.
    if (t.endsWith(':') && t.length < 60) return '';
    return /^(# |\| )/.test(line) || t.length < min || TOC_LINE.test(t) || HEADER_LINE.test(t) || sameAsTitle(t, title) || notProse(t) ? '' : t.replace(/\s*:$/, '…');
  };
  // 1. The PM's own statement of purpose or background: the first sentence under "Syfte", "Bakgrund" ...
  for (const c of chunks) {
    let under = false;
    for (const line of c[1].split('\n')) {
      if (line.startsWith('# ')) {under = PURPOSE.test(line.slice(2).trim()); continue;}
      const t = under && usable(line, 40);
      if (t) return t;
    }
  }
  // 2. Else the first real paragraph outside the table of contents.
  for (const c of chunks) {
    if (c[2]) continue;
    for (const line of c[1].split('\n')) {
      const t = usable(line, 70);
      if (t) return t;
    }
  }
  // 3. Else the section headings.
  const heads = [];
  for (const c of chunks) if (!c[2]) for (const line of c[1].split('\n')) {
    const h = line.startsWith('# ') ? line.slice(2).trim() : '';
    if (h && !HEADER_LINE.test(h) && !/^(innehåll|innehållsförteckning|dokumenthistorik|referenser|referens|litteratur|källor|bilaga|revision|drift i journalen|externa styrande)/i.test(h) && !h.endsWith(':') && !sameAsTitle(h, title) && !heads.includes(h)) heads.push(h);
  }
  return heads.length ? 'Innehåll: ' + heads.slice(0, 8).join(', ') + '.' : '';
}
const description = d => clip(`Lokalt PM, Region Uppsala${d.yr ? ` ${d.yr}` : ''}. ${excerpt(d) || `Läs ${d.t} och öppna originalet i DocPlus.`}`, 155).normalize('NFC');
// Search results show about 60–70 characters of a title: the PM title comes first, and
// "PM, Region Uppsala" is added only when it fits.
function pageTitle(d) {
  const t = d.t.normalize('NFC');
  const long = `${t} – ${/region uppsala/i.test(t) ? 'PM' : 'PM, Region Uppsala'} | Akutkompassen`;
  return long.length <= 70 ? long : `${t} | Akutkompassen`;
}

// ---------- shared page parts ----------
const CSS = `/pm/pm.css?h=${sha(read('pm/pm.css')).slice(0, 10)}`;
function head({title, desc, url, type = 'website', ld}) {
  return `<!doctype html>
<html lang="sv">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
${GENERATOR}
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="Akutkompassen">
<meta property="og:title" content="${esc(title.replace(/ \| Akutkompassen$/, ''))}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="sv_SE">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#FFFFFF"><meta name="theme-color" media="(prefers-color-scheme: dark)" content="#121e26">
<link rel="icon" href="/favicon.png" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="${CSS}">
${jsonLd(ld)}
<script src="/visitor-analytics.js" defer></script>
</head>
<body>`;
}
const siteHead = current => `<header class="site-head"><div class="top"><a class="brand" href="/"><img src="/logo-v2.png" alt="" width="48" height="48"><span>Akutkompassen<span class="brand-sub">Kunskapsstöd för akutsjukvård</span></span></a><nav aria-label="Välj kunskapsstöd"><a href="/"${current === 'vuxna' ? ' aria-current="true"' : ''}>Vuxna</a><a href="/barn/">Barn</a></nav></div></header>`;
// The feedback address is added by script, as in the app (popularity-config.js), so it is not in the
// page text that search engines and address collectors read. A table that is wider than the screen
// gets a keyboard stop and a name, so it can be scrolled without a mouse.
const siteFoot = () => `<footer class="site-foot">
<p>Personligt urval av Kjell Stefansson · ST-läkare i akutsjukvård.</p>
<p>Akutkompassen är fristående och inte en officiell webbplats för Region Uppsala, Akademiska sjukhuset, Karolinska eller Svenska Barnläkarföreningen. Sjukhusens PM gäller för respektive verksamhet. Kontrollera alltid aktuell version hos utgivaren.</p>
<p><a href="/">Sök i Akutkompassen</a> · <a href="/pm/">Alla PM och riktlinjer</a> · <a href="/barn/">Akutkompassen Barn</a></p>
</footer>
<script src="/popularity-config.js"></script>
<script>(()=>{const u=String(window.AK_FEEDBACK_URL||'');if(/^(https:|mailto:)/.test(u)){const p=document.createElement('p'),a=document.createElement('a');a.href=u;a.textContent='Saknas något? Tipsa om PM eller riktlinjer';p.appendChild(a);document.querySelector('.site-foot').prepend(p);}
const t=()=>document.querySelectorAll('.table-scroll').forEach((e,i)=>{const w=e.scrollWidth>e.clientWidth+1;if(w){e.tabIndex=0;e.setAttribute('role','region');e.setAttribute('aria-label','Tabell '+(i+1)+' från originaldokumentet, kan rullas i sidled');}else{e.removeAttribute('tabindex');e.removeAttribute('role');e.removeAttribute('aria-label');}});t();let r;addEventListener('resize',()=>{clearTimeout(r);r=setTimeout(t,200);});})();</script>
</body>
</html>
`;
const ext = '<span aria-hidden="true">↗</span>';

// ---------- one page per local PM ----------
function pmPage(d) {
  const url = `${SITE}/pm/${d.id}/`, area = AREAS[d.a] || '';
  const title = pageTitle(d), desc = description(d);
  const ld = {'@context': 'https://schema.org', '@graph': [
    {'@type': 'MedicalWebPage', '@id': url, url, name: d.t.normalize('NFC'), description: desc, inLanguage: 'sv',
      isPartOf: {'@type': 'WebSite', '@id': `${SITE}/#website`, name: 'Akutkompassen', url: `${SITE}/`},
      audience: {'@type': 'MedicalAudience', audienceType: 'Clinician'},
      isBasedOn: {'@type': 'DigitalDocument', name: d.t.normalize('NFC'), url: d.url, publisher: {'@type': 'Organization', name: 'Region Uppsala'}, ...(d.publishedOn ? {datePublished: d.publishedOn} : {})},
      breadcrumb: {'@id': `${url}#brodsmulor`}},
    {'@type': 'BreadcrumbList', '@id': `${url}#brodsmulor`, itemListElement: [
      {'@type': 'ListItem', position: 1, name: 'Akutkompassen', item: `${SITE}/`},
      {'@type': 'ListItem', position: 2, name: 'PM och riktlinjer', item: `${SITE}/pm/`},
      {'@type': 'ListItem', position: 3, name: d.t.normalize('NFC')}]}]};
  const pages = new Map();
  for (const c of TEXT[d.id]) {if (!pages.has(c[0])) pages.set(c[0], []); pages.get(c[0]).push(c[1]);}
  const text = [...pages].map(([pg, texts]) => `<section class="pg" id="sida-${pg}"><p class="pglabel">Sida ${pg} av ${d.np}</p>${texts.map(textHtml).join('')}</section>`).join('\n');
  const facts = [d.publishedOn && `Godkänt ${svDate(d.publishedOn)}`, d.np && `${d.np} ${d.np === 1 ? 'sida' : 'sidor'}`, `DocPlus ${esc(d.id)}`].filter(Boolean).join(' · ');
  const meta = [
    area && `<a class="tag" href="/pm/#${esc(d.a)}">${esc(area)}</a>`,
    d.yr && `<span class="tag${isOld(d) ? ' warn' : ''}">${esc(d.yr)}</span>`,
    d.note && `<span class="tag ${noteClass(d.note)}">${esc(d.note)}</span>`,
    `<span>${facts}</span>`].filter(Boolean).join('');
  const checked = INDEX.pmChecked ? ` <span class="checked">PM-texterna kontrollerades senast mot DocPlus ${svDate(INDEX.pmChecked)}.</span>` : '';
  const related = PAGES.filter(x => x.a === d.a && x !== d).sort(byTitle);
  return `${head({title, desc, url, type: 'article', ld})}
<a class="skip" href="#text">Till PM-texten</a>
${siteHead('vuxna')}
<main class="page-wrap">
<nav class="crumbs" aria-label="Brödsmulor"><a href="/">Akutkompassen</a><span aria-hidden="true">›</span><a href="/pm/">PM och riktlinjer</a></nav>
<article class="doc">
<div class="doc-head">
<p class="badge">Lokalt PM · Region Uppsala</p>
<h1>${esc(d.t)}</h1>
<p class="meta">${meta}</p>
${isOld(d) ? `<p class="old"><b>Äldre dokument.</b> Kontrollera i DocPlus om det finns en nyare version.</p>\n` : ''}<p class="actions"><a class="btn primary" href="/#pm=${esc(d.id)}">Öppna i Akutkompassen</a><a class="btn" href="${esc(d.url)}" target="_blank" rel="noopener">Original i DocPlus ${ext}</a>${d.summaryUrl ? `<a class="btn guide" href="/${esc(d.summaryUrl)}" target="_blank" rel="noopener">Snabbguide (PDF) ${ext}</a>` : ''}</p>
<p class="source-note">Textvy från PDF-originalet i Region Uppsalas dokumentarkiv DocPlus. Radbrytningar och tabeller kan avvika${TEXT[d.id].some(c => redact(c[1]) !== c[1].normalize('NFC')) ? ', och e-postadresser och mobilnummer visas bara i originalet' : ''}. Kontrollera alltid aktuell version och layout i DocPlus.${checked}</p>
</div>
<div class="text" id="text">
${text}
</div>
</article>
${related.length ? `<section class="related" aria-labelledby="fler"><h2 id="fler">Fler lokala PM – ${esc(area)}</h2><ul>${related.map(x => `<li><a href="/pm/${esc(x.id)}/">${esc(x.t)}</a></li>`).join('')}</ul></section>\n` : ''}</main>
${siteFoot()}`;
}

// ---------- every document on one page ----------
function listPage() {
  const url = `${SITE}/pm/`;
  const n = {local: DOCS.filter(d => d.kind !== 'gl').length, pages: PAGES.length, nat: DOCS.filter(d => d.kind === 'gl' && d.lvl === 'nationell').length, int: DOCS.filter(d => d.kind === 'gl' && d.lvl !== 'nationell').length, barn: BARN.docs.length};
  const title = 'Alla PM och riktlinjer för akutsjukvård | Akutkompassen';
  const desc = 'Alla dokument i Akutkompassen på en sida: lokala PM från Region Uppsala med fulltext och svenska och internationella riktlinjer för akutsjukvård, för vuxna och barn.';
  const ld = {'@context': 'https://schema.org', '@graph': [
    {'@type': 'CollectionPage', '@id': url, url, name: 'Alla PM och riktlinjer', description: desc, inLanguage: 'sv',
      isPartOf: {'@type': 'WebSite', '@id': `${SITE}/#website`, name: 'Akutkompassen', url: `${SITE}/`}, breadcrumb: {'@id': `${url}#brodsmulor`}},
    {'@type': 'BreadcrumbList', '@id': `${url}#brodsmulor`, itemListElement: [
      {'@type': 'ListItem', position: 1, name: 'Akutkompassen', item: `${SITE}/`},
      {'@type': 'ListItem', position: 2, name: 'PM och riktlinjer'}]}]};
  const yearTag = (yr, old) => yr ? `<span class="tag${old ? ' warn' : ''}">${esc(yr)}</span>` : '';
  const local = d => {
    const page = PAGES.includes(d);
    const link = page ? `<a href="/pm/${esc(d.id)}/">${esc(d.t)}</a>` : `<a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.t)} ${ext}</a>`;
    return `<li>${link}<span class="m">${yearTag(d.yr, isOld(d))}Lokalt PM · Region Uppsala${page ? '' : ' · i DocPlus'}${isOld(d) ? ' · Äldre dokument' : ''}</span></li>`;
  };
  const guide = d => `<li><a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.t)} ${ext}</a><span class="m">${yearTag(d.yr, false)}${esc([d.soc, d.lvl === 'nationell' ? 'Nationell riktlinje' : 'Internationell riktlinje'].filter(Boolean).join(' · '))}${d.note ? ` – ${esc(d.note)}` : ''}</span></li>`;
  const barn = d => {
    const yr = barnYear(d), old = yr && yr <= 2021;
    const notes = [d.publisher, old && 'Äldre dokument · kontrollera giltighet', d.archive && 'Bibliotekskopia · giltighet ej verifierad'].filter(Boolean).join(' · ');
    return `<li><a href="${esc(barnUrl(d))}" target="_blank" rel="noopener">${esc(d.title)} ${ext}</a><span class="m">${yr ? yearTag(String(yr), old) : ''}${esc(notes)}</span></li>`;
  };
  const areas = Object.entries(AREAS).map(([key, name]) => {
    const docs = DOCS.filter(d => d.a === key);
    if (!docs.length) return '';
    const pm = docs.filter(d => d.kind !== 'gl').sort(byTitle);
    const other = docs.filter(d => d.kind === 'gl').sort((a, b) => (a.lvl === 'nationell' ? 0 : 1) - (b.lvl === 'nationell' ? 0 : 1) || byTitle(a, b));
    return `<section class="area" id="${esc(key)}" aria-labelledby="h-${esc(key)}"><h2 id="h-${esc(key)}">${esc(name)}</h2>
${pm.length ? `<h3>Lokala PM</h3><ul class="doclist">${pm.map(local).join('')}</ul>\n` : ''}${other.length ? `<h3>Riktlinjer</h3><ul class="doclist">${other.map(guide).join('')}</ul>\n` : ''}</section>`;
  }).filter(Boolean).join('\n');
  const barnAreas = Object.entries(BARN.areas).map(([key, name]) => {
    const docs = BARN.docs.filter(d => d.area === key).sort(byTitle);
    return docs.length ? `<h3>${esc(name)}</h3><ul class="doclist">${docs.map(barn).join('')}</ul>` : '';
  }).filter(Boolean).join('\n');
  const toc = Object.entries(AREAS).filter(([k]) => DOCS.some(d => d.a === k)).map(([k, name]) => `<li><a href="#${esc(k)}">${esc(name)}</a></li>`).join('') + '<li><a href="#barn">Barn</a></li>';
  return `${head({title, desc, url, ld})}
<a class="skip" href="#omraden">Till listan</a>
${siteHead('')}
<main class="page-wrap">
<nav class="crumbs" aria-label="Brödsmulor"><a href="/">Akutkompassen</a><span aria-hidden="true">›</span>PM och riktlinjer</nav>
<h1>Alla PM och riktlinjer</h1>
<p class="lead">Alla dokument i Akutkompassen på en sida: ${n.local} lokala PM från Region Uppsala (${n.pages === n.local ? 'alla' : n.pages} med en egen sida med hela texten), ${n.nat} svenska nationella och ${n.int} internationella riktlinjer samt ${n.barn} dokument för barn. Riktlinjerna länkar till utgivaren. <a href="/">Sök i Akutkompassen</a> för att söka i PM-texterna och läsa även offline.</p>
<p class="source-note updated">Biblioteket uppdaterat ${esc(INDEX.updated)}.</p>
<p class="source-note updated"><a href="/om/">Om Akutkompassen och källorna</a></p>
<nav aria-label="Områden"><ul class="toc" id="omraden">${toc}</ul></nav>
${areas}
<section class="area" id="barn" aria-labelledby="h-barn"><h2 id="h-barn">Barn</h2>
<p>Från <a href="/barn/">Akutkompassen Barn</a>: PM från Region Uppsala och Karolinska samt nationella kunskapsstöd. Dokumenten öppnas i en ny flik.</p>
${barnAreas}
</section>
</main>
${siteFoot()}`;
}

// ---------- sitemap ----------
const out = new Map(); // file -> content
out.set('pm/index.html', listPage());
for (const d of PAGES) out.set(`pm/${d.id}/index.html`, pmPage(d));
const guides = [...new Set(DOCS.map(d => d.summaryUrl).filter(Boolean))].sort();
// Fingerprints ignore what is not content: the release name (ak-v10s46-…), the stylesheet
// version and the date of the latest DocPlus check.
const unversioned = s => s.replace(/ak-v\d+[a-z0-9]*(?:-[a-z0-9]+)*/gi, '');
const content = html => html.replace(/\/pm\/pm\.css\?h=[0-9a-f]+/, '').replace(/<span class="checked">[^<]*<\/span>/, '');
const sources = [
  [`${SITE}/`, () => sha(unversioned(read('index.html')), unversioned(read('ak_index.json')))],
  [`${SITE}/barn/`, () => sha(unversioned(read('barn/index.html')), read('barn/data.json'), unversioned(read('barn/app.js')))],
  [`${SITE}/om/`, () => sha(unversioned(read('om/index.html')))],
  [`${SITE}/pm/`, () => sha(content(out.get('pm/index.html')))],
  ...[...PAGES].sort((a, b) => collator.compare(a.id, b.id)).map(d => [`${SITE}/pm/${d.id}/`, () => sha(content(out.get(`pm/${d.id}/index.html`)))]),
  ...guides.map(g => [`${SITE}/${g}`, () => sha(fs.readFileSync(file(g)))]),
];
const old = fs.existsSync(file(MANIFEST)) ? readJson(MANIFEST) : {};
const manifest = {}, changed = [];
for (const [url, fingerprint] of sources) {
  const h = fingerprint();
  if (old[url] && old[url].sha === h) manifest[url] = old[url];
  else {manifest[url] = {sha: h, date: today()}; changed.push(url);}
}
const removed = Object.keys(old).filter(u => !manifest[u]);
out.set('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Object.entries(manifest).map(([u, m]) => `<url><loc>${esc(u)}</loc><lastmod>${m.date}</lastmod></url>`).join('\n')}
</urlset>
`);
out.set(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');

// ---------- write, or check ----------
// Only folders this script made (their page carries its generator tag) are ever removed.
const wanted = new Set(PAGES.map(d => d.id));
const ours = name => {const f = file(`pm/${name}/index.html`); return fs.existsSync(f) && fs.readFileSync(f, 'utf8').includes(GENERATOR);};
const stale = fs.existsSync(file('pm')) ? fs.readdirSync(file('pm'), {withFileTypes: true}).filter(e => e.isDirectory() && !wanted.has(e.name) && ours(e.name)).map(e => `pm/${e.name}/`) : [];
if (CHECK) {
  const problems = [];
  if (changed.length) problems.push(`content changed but not rebuilt: ${changed.slice(0, 5).join(', ')}${changed.length > 5 ? ` and ${changed.length - 5} more` : ''}`);
  if (removed.length) problems.push(`no longer in the library: ${removed.slice(0, 5).join(', ')}`);
  if (stale.length) problems.push(`pages without a document: ${stale.join(', ')}`);
  if (!changed.length) for (const [f, text] of out) if (!fs.existsSync(file(f)) || read(f) !== text) problems.push(`${f} is out of date`);
  if (problems.length) {console.error('Search pages are out of date. Run: node tools/build-seo.mjs\n- ' + problems.slice(0, 12).join('\n- ')); process.exit(1);}
  console.log(`Search pages up to date: ${PAGES.length} PM pages, list page, sitemap with ${Object.keys(manifest).length} addresses.`);
} else {
  if (stale.length > 5 && !ALLOW_REMOVALS) {console.error(`${stale.length} PM pages would be removed (${stale.slice(0, 8).join(', ')} …). If that is right, run again with --allow-removals.`); process.exit(1);}
  let written = 0;
  for (const [f, text] of out) {
    if (fs.existsSync(file(f)) && read(f) === text) continue;
    fs.mkdirSync(path.dirname(file(f)), {recursive: true});
    fs.writeFileSync(file(f), text);
    written++;
  }
  for (const dir of stale) fs.rmSync(file(dir), {recursive: true});
  console.log(`${PAGES.length} PM pages + list page + sitemap (${Object.keys(manifest).length} addresses). Files written: ${written}. New dates: ${changed.length}. Pages removed: ${stale.length}.`);
  if (LINK_ONLY.length) console.log(`Link only (the document forbids copying): ${LINK_ONLY.map(d => `${d.id} ${d.t}`).join('; ')}`);
}
