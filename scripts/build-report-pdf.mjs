// Build the illustrated PDF of docs/TEST-00-REPORT.md.
//   node scripts/build-report-pdf.mjs <imageDir> <outPdf>
// Text is taken verbatim from the markdown; figures are injected at fixed
// anchors and every anchor must match exactly once or the build fails.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const IMG = process.argv[2];
const OUT = process.argv[3];
const SRC = 'docs/TEST-00-REPORT.md';

/* ---------- figures ---------------------------------------------------- */

const FIGURES = [
  { id: 'F1', images: ['exp-toollog.png'],
    caption: 'The panel’s live tool-call log, mid-run: name, arguments and timestamp in call order.',
    source: 'experimental-run1.mov +6:40' },

  { id: 'F2', images: ['ctrl-chat.png', 'ctrl-status.png'], layout: 'two',
    caption: 'Control run. The opening turns, and the status block reporting WebMCP detected but nothing registered.',
    source: 'control-run1.mov +0:00' },

  { id: 'F3', images: ['ctrl-hero.jpg', 'ctrl-measure.png'], layout: 'two',
    caption: 'Control artifact and its measurement. Ten values, one of them divisible by 7 — 14px, which is chance.',
    source: 'control-run1.mov +5:40' },

  { id: 'F4', images: ['exp-announce.png', 'exp-status.png'], layout: 'two',
    caption: 'The discovery moment. The agent states it will read the page’s house rules — with the counter still at TOOL CALLS (0).',
    source: 'experimental-run1.mov +0:25' },

  { id: 'F5', images: ['exp-call1.png'],
    caption: 'get_house_rules is call 1, and the canvas is still empty. The rules were consulted before anything was built.',
    source: 'experimental-run1.mov +1:50' },

  { id: 'F6', images: ['exp-measure.png'],
    caption: 'Experimental measurement: 7, 14, 21, 28 — every value on the seven, none on the eight.',
    source: 'experimental-run1.mov +6:40' },

  { id: 'F7', images: ['exp-hero.jpg', 'exp-verify.png'], layout: 'two',
    caption: 'The artifact, and the agent reporting its own conformance back from the page’s instrument.',
    source: 'experimental-run1.mov +6:40' },
];

const ANCHORS = [
  ['F1', 'the measurement table, and JSON export of the\nwhole run.\n'],
  ['F2', '`TOOL CALLS (0)` throughout.\n'],
  ['F3', '**Result: `10 spacing values — 1 divisible by 7, 3 by 8`.**\n'],
  ['F4', 'It had called nothing. It knew a rules tool existed from the WebMCP registration\nalone.\n'],
  ['F5', '03:56:41   MEASURE — pressed by the agent, as part of its own verification\n```\n'],
  ['F6', 'By occurrence, 25/25 on 7.\n'],
  ['F7', 'declarations follow the 7px system."*\n'],
];

/* ---------- markdown ---------------------------------------------------- */

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(s) {
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (m, c) => { codes.push(c); return '@@C' + (codes.length - 1) + '@@'; });
  s = esc(s);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  s = s.replace(/@@C(\d+)@@/g, (m, i) => '<code>' + esc(codes[+i]) + '</code>');
  return s;
}

function figureHtml(fig, n) {
  const imgs = fig.images.map((f) => {
    const p = join(IMG, f);
    if (!existsSync(p)) throw new Error('missing image ' + p);
    const mime = extname(f) === '.jpg' ? 'image/jpeg' : 'image/png';
    return '<img src="data:' + mime + ';base64,' + readFileSync(p).toString('base64') + '" alt="">';
  }).join('');
  return '<figure class="fig ' + (fig.layout === 'two' ? 'two' : 'one') + '">\n' +
    '<div class="shots">' + imgs + '</div>\n' +
    '<figcaption><span class="fignum">FIG ' + String(n).padStart(2, '0') + '</span>' + inline(fig.caption) +
    '<span class="figsrc">' + esc(fig.source) + '</span></figcaption>\n</figure>';
}

function render(md) {
  const lines = md.split('\n');
  const out = [];
  let i = 0;
  let figN = 0;

  const isTableSep = (l) => /^\|[\s:|-]+\|\s*$/.test(l);
  const bullet = /^(\s*)([-*]|\d+\.)\s+(.*)$/;

  while (i < lines.length) {
    const line = lines[i];

    const fm = line.match(/^@@FIG:(\w+)@@$/);
    if (fm) {
      out.push(figureHtml(FIGURES.find((f) => f.id === fm[1]), ++figN));
      i++; continue;
    }

    if (!line.trim()) { i++; continue; }

    if (line.startsWith('```')) {
      const body = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) body.push(lines[i++]);
      i++;
      out.push('<pre><code>' + esc(body.join('\n')) + '</code></pre>');
      continue;
    }

    if (/^---+$/.test(line.trim())) { out.push('<hr>'); i++; continue; }

    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) { out.push('<h' + h[1].length + '>' + inline(h[2]) + '</h' + h[1].length + '>'); i++; continue; }

    if (line.startsWith('|') && isTableSep(lines[i + 1] || '')) {
      const cells = (l) => l.replace(/^\||\|\s*$/g, '').split('|').map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(cells(lines[i++]));
      out.push('<table><thead><tr>' + head.map((c) => '<th>' + inline(c) + '</th>').join('') +
        '</tr></thead><tbody>' +
        rows.map((r) => '<tr>' + r.map((c) => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') +
        '</tbody></table>');
      continue;
    }

    if (line.startsWith('>')) {
      const buf = [];
      while (i < lines.length && lines[i].startsWith('>')) buf.push(lines[i++].replace(/^>\s?/, ''));
      const paras = buf.join('\n').split(/\n\s*\n/).filter((p) => p.trim());
      out.push('<blockquote>' +
        paras.map((p) => '<p>' + inline(p.replace(/\n/g, ' ').trim()) + '</p>').join('') +
        '</blockquote>');
      continue;
    }

    if (bullet.test(line)) {
      const ordered = /^\s*\d+\.\s/.test(line);
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(bullet);
        if (m) { items.push(m[3]); i++; }
        else if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length) {
          items[items.length - 1] += ' ' + lines[i].trim(); i++;
        } else break;
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push('<' + tag + '>' + items.map((t) => '<li>' + inline(t) + '</li>').join('') + '</' + tag + '>');
      continue;
    }

    const buf = [];
    while (i < lines.length && lines[i].trim() && !lines[i].startsWith('|') && !lines[i].startsWith('>') &&
           !lines[i].startsWith('```') && !/^#{1,3}\s/.test(lines[i]) && !bullet.test(lines[i]) &&
           !/^---+$/.test(lines[i].trim()) && !/^@@FIG:/.test(lines[i])) buf.push(lines[i++]);
    if (buf.length) out.push('<p>' + inline(buf.join(' ')) + '</p>');
  }
  return out.join('\n');
}

/* ---------- assemble ---------------------------------------------------- */

let md = readFileSync(SRC, 'utf8');

for (const [id, anchor] of ANCHORS) {
  const n = md.split(anchor).length - 1;
  if (n !== 1) throw new Error('anchor for ' + id + ' matched ' + n + ' times, expected 1');
  md = md.replace(anchor, anchor + '\n@@FIG:' + id + '@@\n');
}

const parts = md.split('\n---\n');
const cover = parts[0];
const body = parts.slice(1).join('\n---\n');

const coverLines = cover.split('\n').filter((l) => l.trim());
const title = coverLines[0].replace(/^#\s*/, '');
const meta = coverLines.slice(1).filter((l) => l.startsWith('**'));

const CSS = `
  @page { size: A4; margin: 17mm 16mm 18mm; }
  :root {
    --ink: #14181d; --body: #2b333b; --muted: #6b757f; --faint: #98a2ac;
    --line: #dde3e9; --rule: #c3ccd5; --accent: #0d5f5a; --bg-code: #f4f6f8;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; color: var(--body); background: #fff;
    font: 9.6pt/1.58 -apple-system, "Helvetica Neue", Arial, sans-serif;
    -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
  }
  code, pre, .mono { font-family: "SF Mono", Menlo, Consolas, monospace; }

  .cover { height: 252mm; display: flex; flex-direction: column; justify-content: space-between; break-after: page; }
  .cover .eyebrow { font-size: 7.6pt; letter-spacing: .22em; text-transform: uppercase; color: var(--accent); font-weight: 700; }
  .cover h1 { font-size: 30pt; line-height: 1.06; letter-spacing: -.02em; color: var(--ink); margin: 9mm 0 0; font-weight: 650; max-width: 15em; }
  .cover .meta { border-top: 2px solid var(--ink); padding-top: 5mm; display: grid; grid-template-columns: 1fr 1fr; gap: 3mm 8mm; font-size: 8.4pt; }
  .cover .rulebox { border: 1px solid var(--rule); border-left: 3px solid var(--accent); padding: 5mm 6mm; }
  .cover .rulebox .k { font-size: 7.4pt; letter-spacing: .2em; text-transform: uppercase; color: var(--muted); display: block; margin-bottom: 2mm; }
  .cover .rulebox .q { color: var(--ink); font-size: 11pt; line-height: 1.45; }

  h1, h2, h3 { color: var(--ink); font-weight: 650; letter-spacing: -.008em; break-after: avoid; }
  h2 { font-size: 15pt; margin: 0 0 5mm; padding-bottom: 2.5mm; border-bottom: 2px solid var(--ink); break-before: page; }
  h3 { font-size: 10.6pt; margin: 7mm 0 2mm; }
  p { margin: 0 0 3.2mm; }
  strong { color: var(--ink); font-weight: 650; }
  hr { border: 0; border-top: 1px solid var(--line); margin: 6mm 0; }

  code { background: var(--bg-code); padding: .8px 3px; border-radius: 2px; font-size: .88em; color: #1f4f4b; }
  pre { background: var(--bg-code); border: 1px solid var(--line); border-left: 3px solid var(--rule);
        padding: 3.4mm 4mm; margin: 0 0 4mm; overflow: hidden; break-inside: avoid; }
  pre code { background: none; padding: 0; color: var(--ink); font-size: 7.9pt; line-height: 1.5; white-space: pre-wrap; }

  table { width: 100%; border-collapse: collapse; margin: 0 0 4mm; font-size: 8.5pt; break-inside: avoid; }
  th, td { text-align: left; vertical-align: top; padding: 1.9mm 2.6mm; border-bottom: 1px solid var(--line); }
  th { color: var(--ink); font-size: 7.4pt; letter-spacing: .1em; text-transform: uppercase; border-bottom: 1.5px solid var(--ink); }
  tbody tr:last-child td { border-bottom: 1px solid var(--rule); }

  blockquote { margin: 0 0 4mm; padding: 2mm 0 2mm 5mm; border-left: 2px solid var(--accent); color: var(--ink); break-inside: avoid; }
  blockquote p { margin: 0 0 2mm; font-size: 9.4pt; }
  blockquote p:last-child { margin: 0; }

  ul, ol { margin: 0 0 3.5mm; padding-left: 5mm; }
  li { margin-bottom: 1.4mm; }

  figure.fig { margin: 5mm 0 6mm; break-inside: avoid; }
  figure.fig .shots { display: flex; gap: 3mm; align-items: flex-start; }
  figure.fig.one .shots img { width: 100%; }
  figure.fig.two .shots img { width: 50%; }
  figure.fig img { display: block; border: 1px solid var(--rule); border-radius: 2px; background: #14171c; }
  figure.fig figcaption { margin-top: 2.4mm; font-size: 7.6pt; line-height: 1.5; color: var(--muted); }
  .fignum { display: inline-block; font-family: "SF Mono", Menlo, monospace; font-size: 7pt; letter-spacing: .12em;
            color: var(--accent); font-weight: 700; margin-right: 2.5mm; }
  .figsrc { display: block; font-family: "SF Mono", Menlo, monospace; font-size: 6.8pt; color: var(--faint); margin-top: .8mm; }
`;

const html = '<meta charset="utf-8">\n<title>' + esc(title) + '</title>\n<style>' + CSS + '</style>\n\n' +
  '<section class="cover">\n' +
  '  <div>\n' +
  '    <div class="eyebrow">DGOS · WebMCP Capability Environment</div>\n' +
  '    <h1>' + esc(title) + '</h1>\n' +
  '  </div>\n' +
  '  <div class="rulebox">\n' +
  '    <span class="k">The rule under test</span>\n' +
  '    <span class="q mono">Every spacing value — margin, padding, gap — must be a multiple of 7px.</span>\n' +
  '  </div>\n' +
  '  <div class="meta">\n    ' + meta.map((l) => '<div>' + inline(l) + '</div>').join('\n    ') + '\n  </div>\n' +
  '</section>\n\n' + render(body) + '\n';

const tmp = join(tmpdir(), 'test-00-report.html');
writeFileSync(tmp, html);

execFileSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--no-pdf-header-footer',
  '--virtual-time-budget=20000', '--run-all-compositor-stages-before-draw',
  '--print-to-pdf=' + resolve(OUT), pathToFileURL(tmp).href,
], { stdio: 'pipe' });

console.log('figures', FIGURES.length, '| html', (html.length / 1e6).toFixed(1) + 'MB ->', OUT);
