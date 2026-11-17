#!/usr/bin/env python3
"""DocPlus PDF -> Akutkompassen PM text ([[page, text], ...] as stored in ak_<AREA>.json).
Markup: "# " heading, "• " bullet, "◦ " sub-bullet, "| a | b" table row; one paragraph per line.
The page footer (document name, DocPlus-ID, version, page number) is left out; a table of contents
gets the third element 1. Needs pdftohtml (poppler-utils).

Use when tools/check-links.mjs reports a PM as revised in DocPlus:
  python3 tools/pm-text.py nytt.pdf 99     prints the text of the first 99 blocks, to read through
  from pm-text import extract               chunks, pages = extract('nytt.pdf'); put chunks in the
                                            shard under the PM's id, then set publishedOn, yr and np
                                            in ak_index.json and run node tools/build-seo.mjs
"""
import re, subprocess, sys, json, html
import xml.etree.ElementTree as ET

def lines_of(pdf):
    xml = subprocess.run(['pdftohtml', '-xml', '-i', '-q', '-stdout', pdf], capture_output=True).stdout.decode('utf-8', 'replace')
    xml = re.sub(r'<!DOCTYPE[^>]*>', '', xml)
    xml = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', xml)
    root = ET.fromstring(xml)
    fonts = {}
    for page in root.iter('page'):
        for f in page.findall('fontspec'): fonts[f.get('id')] = (int(f.get('size')), f.get('family') or '')
        H = int(page.get('height')); items = []
        for t in page.findall('text'):
            s = ''.join(t.itertext())
            if not s.strip(): continue
            bold = t.find('b') is not None and ''.join(t.find('b').itertext()).strip() == s.strip()
            items.append(dict(top=int(t.get('top')), left=int(t.get('left')), w=int(t.get('width')), h=int(t.get('height')), size=fonts.get(t.get('font'), (0, ''))[0], fam=fonts.get(t.get('font'), (0, ''))[1], bold=bold, s=s))
        yield int(page.get('number')), H, items

def group(items):
    """fragments -> visual lines (same baseline), left to right"""
    items = sorted(items, key=lambda i: (i['top'] + i['h'], i['left']))
    rows = []
    for it in items:
        base = it['top'] + it['h']
        if rows and abs(rows[-1]['base'] - base) <= 4: rows[-1]['f'].append(it)
        else: rows.append(dict(base=base, f=[it]))
    big = max((i['size'] for i in items), default=0)
    sizes = {}
    for i in items: sizes[i['size']] = sizes.get(i['size'], 0) + len(i['s'].strip())
    body = max(sizes, key=sizes.get) if sizes else 0
    merged = []
    for k, r in enumerate(rows):
        tiny = all(i['size'] <= body * 0.75 for i in r['f']) and sum(len(i['s'].strip()) for i in r['f']) <= 3
        if tiny:
            near = [x for x in (rows[k - 1] if k else None, rows[k + 1] if k + 1 < len(rows) else None) if x and abs(x['base'] - r['base']) <= 12 and any(i['size'] > body * 0.75 for i in x['f'])]
            if near:
                near[0]['f'].extend(r['f']); continue
        merged.append(r)
    rows = merged
    out = []
    for r in rows:
        f = sorted(r['f'], key=lambda i: i['left'])
        mark = ''
        if len(f) > 1 and len(f[0]['s'].strip()) == 1 and (re.search(r'Symbol|Wingdings|Courier', f[0]['fam']) or f[0]['s'].strip() in '•\uf0b7\uf0a7\u25cf\u25aa'):
            ch0 = f[0]['s'].strip()
            if ch0 == 'o' or re.search(r'Courier', f[0]['fam']): mark = '◦ '
            elif not ch0.isalnum(): mark = '• '
            if mark: f = f[1:]
            while f and not f[0]['s'].strip(): f = f[1:]
            if not f: continue
        cells = [[f[0]]]
        for a, b in zip(f, f[1:]):
            gap = b['left'] - (a['left'] + a['w'])
            if gap > 28: cells.append([b])
            else: cells[-1].append(b)
        txt = [re.sub(r'\s+', ' ', ''.join(x['s'] for x in c)).strip() for c in cells]
        txt = [t for t in txt if t]
        if not txt: continue
        body = max(f, key=lambda i: len(i['s'].strip()))
        out.append(dict(top=min(i['top'] for i in f), base=r['base'], left=f[0]['left'], size=body['size'], h=body['h'],
                        bold=all(i['bold'] for i in f if i['s'].strip()), cells=txt, mark=mark))
    return out

BUL = re.compile(r'^(?:[••●▪–−\-–]|o(?= ))\s+')
TOCL = re.compile(r'(?:…+|\.{4,})\s*\d+\s*$')
FOOT = re.compile(r'^(DocPlus-ID:|Version: ?\d|Handlingstyp:|Sidan \d+ av \d+|Dokumentnamn:)')
def extract(pdf, maxlen=900):
    pages = []; title = None; body_size = None; sizes = {}
    data = [(n, H, group(items)) for n, H, items in lines_of(pdf)]
    for n, H, rows in data:
        for r in rows:
            sizes[r['size']] = sizes.get(r['size'], 0) + sum(len(c) for c in r['cells'])
    body_size = max(sizes, key=sizes.get)
    chunks = []
    for n, H, rows in data:
        # the footer block starts at the document title repeated above "DocPlus-ID"
        foot = min([r['top'] for r in rows if r['top'] > H * 0.75 and any(FOOT.match(c) for c in r['cells'])], default=H)
        if foot < H:
            above = [r for r in rows if foot - 45 <= r['top'] < foot and r['size'] < body_size]
            if above: foot = min(r['top'] for r in above)
        rows = [r for r in rows if r['top'] < foot]
        paras = []; prev = None; hdr_bottom = 0; lasthead = None
        if n == 1:
            # document header (top right): "Godkänt den", "Ansvarig", "Gäller för" with values beside or below
            hz = [r for r in rows if r['top'] < H * 0.14]
            lab = [r for r in hz if any(re.match(r'^(Godkänt|Ansvarig|Gäller för)', c) for c in r['cells'])]
            if lab:
                hdr_bottom = max(r['top'] for r in hz if r['top'] <= max(x['top'] for x in lab) + 40 and r['left'] >= min(x['left'] for x in lab) - 5) + 1
                z = ' '.join(' '.join(r['cells']) for r in rows if r['top'] < hdr_bottom)
                z = re.sub(r'\s+', ' ', z)
                date = re.search(r'\d{4}-\d{2}-\d{2}', z)
                z2 = re.sub(r'Godkänt\s*(den)?\s*:?', '', z); z2 = re.sub(r'\bden\s*:', '', z2)
                if date: z2 = z2.replace(date.group(0), '', 1)
                ans = re.search(r'Ansvarig\s*:\s*(.*?)\s*(?=Gäller för|$)', z2); gal = re.search(r'Gäller för\s*:\s*(.*)$', z2)
                if date: paras.append('# Godkänt den: ' + date.group(0))
                if ans and ans.group(1).strip(): paras.append('# Ansvarig: ' + ans.group(1).strip())
                if gal and gal.group(1).strip(): paras.append('Gäller för: ' + gal.group(1).strip())
        for r in rows:
            text = ' '.join(r['cells']); cells = r['cells']
            if n == 1 and r['top'] < hdr_bottom: continue
            if r.get('mark'):
                paras.append(r['mark'] + ' '.join(cells)); prev = r; prev['kind'] = 'b'; continue
            if len(cells) > 1 and not (len(cells) == 2 and BUL.match(cells[0] + ' ')):
                paras.append('| ' + ' | '.join(cells)); prev = None; continue
            m = BUL.match(text)
            if m:
                sub = text[0] == 'o' or r['left'] > (rows[0]['left'] + 60 if rows else 0) and text[0] in 'o'
                paras.append(('◦ ' if text.startswith('o ') else '• ') + text[m.end():].strip()); prev = r; prev['kind'] = 'b'; continue
            if (r['size'] >= body_size * 1.25 and len(text) < 140) or (r['bold'] and (r['size'] > body_size or len(text) < 90)):
                if lasthead and paras and paras[-1].startswith('# ') and r['size'] == lasthead['size'] and r['size'] >= body_size * 1.25 and r['top'] - lasthead['top'] <= 1.5 * r['h'] + 3 and not re.match(r'^\d', text):
                    paras[-1] += ' ' + text
                else: paras.append('# ' + text)
                lasthead = r; prev = None; continue
            lasthead = None
            if re.match(r'^(\d{1,2}[.)]|[a-z]\))\s', text) or re.match(r'^\d{1,2}\.$', text):
                paras.append(text); prev = r; prev['kind'] = 'b'; continue
            gap = r['top'] - prev['top'] if prev else 999
            same = prev and gap <= 1.55 * max(r['h'], prev['h']) + 3 and abs(r['size'] - prev['size']) <= 1
            if same and paras and not paras[-1].startswith(('# ', '| ')) and not TOCL.search(paras[-1]):
                # continuation of a paragraph or of a bullet (indented under it)
                if prev.get('kind') == 'b' and r['left'] < prev['left'] - 5: paras.append(text); prev = r
                else:
                    paras[-1] += ('' if paras[-1].endswith('-') and text[:1].islower() and False else ' ') + text
                    k = prev.get('kind'); prev = r
                    if k: prev['kind'] = k
            else: paras.append(text); prev = r
        paras = [re.sub(r'\s+', ' ', p).strip() for p in paras if p.strip()]
        # chunk: split at headings and at maxlen
        cur = []
        def flush():
            if cur:
                toc = all(TOCL.search(x) for x in cur)
                c = [n, '\n'.join(re.sub(r'\s*(?:…+|\.{4,})\s*(\d+)\s*$', r' … \1', x) if toc else x for x in cur)]
                if toc: c.append(1)
                chunks.append(c); cur.clear()
        for p in paras:
            t = bool(TOCL.search(p))
            if cur and t != bool(TOCL.search(cur[-1])) and not (not t and all(x.startswith('# ') for x in cur)): flush()
            if p.startswith('# ') and cur and sum(len(x) for x in cur) > 250 and not all(x.startswith('# ') for x in cur): flush()
            if cur and sum(len(x) for x in cur) + len(p) > maxlen: flush()
            cur.append(p)
        flush()
    return chunks, len(data)

if __name__ == '__main__':
    ch, np = extract(sys.argv[1]); print(np, len(ch))
    for c in ch[:int(sys.argv[2]) if len(sys.argv) > 2 else 6]: print('---', c[0], c[2:] , '\n' + c[1])
