// Offline scorer for Level 1 (docs/LEVEL-1-SPEC.md §6).
//   node scripts/score-level1.mjs <run.json> [more.json ...] [--json] [--keep]
//
// Takes exported run JSONs, re-renders each canvas.html in the probe's own
// canvas environment at a frozen 375x812 viewport, and reports one vector per
// run plus joint conformance:
//
//   [spacing, height, gap, radius, colour]
//
// The page never scores itself — see docs/LEVEL-1-SPEC.md §6. Every cell can
// come back `unmeasurable`, which is a distinct result from a failure: it says
// the property the rule governs does not exist in this artifact at all.

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const HARNESS = join(ROOT, 'scripts', 'score-harness.html');
const CHROME = process.env.CHROME ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const VIEWPORT = { width: 375, height: 812 };   // standardised at Level 0
const EXPECTED_CANVAS_WIDTH = 289;              // 375 - 2*19 app - 2*23 stage - 2*1 border
const CELLS = ['spacing', 'height', 'gap', 'radius', 'colour'];

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const keep = args.includes('--keep');
const files = args.filter((a) => !a.startsWith('--'));

if (!files.length) {
  console.error('usage: node scripts/score-level1.mjs <run.json> [...] [--json] [--keep]');
  process.exit(2);
}

/* ---------- chrome, driven over CDP -------------------------------------
   Chrome's --window-size flag is not honoured reliably on macOS: the same
   command returned 500x725 and then 756x469 for --window-size=375,812. The
   viewport is not a detail here — every vw/svh-derived value in an artifact
   resolves against it — so the metrics are set explicitly through
   Emulation.setDeviceMetricsOverride. Node's built-in WebSocket keeps this
   dependency-free, as the rest of the probe is.                            */

function launchChrome(profileDir) {
  const proc = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--allow-file-access-from-files',
    '--remote-debugging-port=0', `--user-data-dir=${profileDir}`,
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  return new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error('chrome did not report a debugging port')), 30000);
    proc.stderr.on('data', (d) => {
      buf += d.toString();
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(timer); resolve({ proc, wsUrl: m[1] }); }
    });
    proc.on('error', (e) => { clearTimeout(timer); reject(e); });
    proc.on('exit', (c) => { clearTimeout(timer); reject(new Error(`chrome exited (${c}): ${buf.slice(-400)}`)); });
  });
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id != null && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(`${msg.error.message} (${msg.method ?? ''})`)) : resolve(msg.result);
      } else {
        for (const l of this.listeners) l(msg);
      }
    });
  }

  static connect(url) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      ws.addEventListener('open', () => resolve(new CDP(ws)));
      ws.addEventListener('error', () => reject(new Error('cannot connect to chrome')));
    });
  }

  send(method, params = {}, sessionId) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
      setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error(`${method} timed out`));
      }, 60000);
    });
  }

  once(predicate) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('event never arrived')), 60000);
      const l = (msg) => {
        if (!predicate(msg)) return;
        clearTimeout(timer);
        this.listeners.splice(this.listeners.indexOf(l), 1);
        resolve(msg);
      };
      this.listeners.push(l);
    });
  }

  close() { try { this.ws.close(); } catch {} }
}

/* ---------- render one artifact ----------------------------------------- */

const harnessUrl = pathToFileURL(HARNESS).href;

async function renderAndScore(cdp, html, standard) {
  // A fresh target per run: a previous artifact's stylesheets must not survive
  // into the next one.
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  try {
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: VIEWPORT.width, height: VIEWPORT.height,
      deviceScaleFactor: 1, mobile: false,
    }, sessionId);

    await cdp.send('Page.enable', {}, sessionId);
    const loaded = cdp.once((m) => m.sessionId === sessionId && m.method === 'Page.loadEventFired');
    await cdp.send('Page.navigate', { url: harnessUrl }, sessionId);
    await loaded;

    const literal = JSON.stringify(html)
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');

    const stdArg = standard ? ', ' + JSON.stringify(standard) : '';
    const res = await cdp.send('Runtime.evaluate', {
      expression: `window.__SCORE__(${literal}${stdArg})`,
      awaitPromise: true,
      returnByValue: true,
    }, sessionId);

    if (res.exceptionDetails) {
      const d = res.exceptionDetails;
      throw new Error(d.exception?.description ?? d.text ?? 'harness threw');
    }
    if (!res.result || res.result.type !== 'object' || res.result.value == null) {
      throw new Error('harness returned nothing usable');
    }
    return res.result.value;
  } finally {
    await cdp.send('Target.closeTarget', { targetId }).catch(() => {});
  }
}

/* ---------- a gate export carries its own standard ----------------------
   A House Control run can be amended mid-session by a human, so the artifact
   is scored twice: against the standard it was handed, and against the one it
   ended up under. A run where those disagree is not a failure — it is the
   record of a negotiation, and worth seeing as two numbers rather than one. */

function standardFrom(block) {
  if (!block || !block.rules) return null;
  const r = block.rules;
  const scale = [...(r.spacing?.value ?? [])].sort((a, b) => a - b);
  const min = r.controls?.value;
  const height = scale.find((v) => v >= min) ?? null;
  const ratio = r.gap?.value;
  const gap = height != null && ratio ? (height * ratio[0]) / ratio[1] : null;
  const radius = gap != null && r.radius?.value != null ? gap + r.radius.value : null;
  /* A standard with no reachable control height has no chain at all. The
     harness ignores null fields, so returning one here would leave HEIGHT,
     GAP and RADIUS at the Level 1 defaults and quietly score the run against
     49/14/13 — a wrong answer that looks like a real one. */
  if (height == null || gap == null || radius == null) {
    return { unsatisfiable: true, scale, min, height, gap, radius,
             colours: (r.colour?.value ?? []).length || 3 };
  }
  return { scale, min, height, gap, radius, colours: (r.colour?.value ?? []).length || 3 };
}

const sameStandard = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ---------- report ------------------------------------------------------- */

const mark = (v) => (v === 1 ? '1' : v === 0 ? '0' : '?');
const pad = (s, n) => String(s).padEnd(n);

function list(a, max = 14) {
  if (!a.length) return '—';
  const shown = a.slice(0, max).join(' ');
  return a.length > max ? `${shown} … (+${a.length - max})` : shown;
}

function report(name, r) {
  const c = r.cells;
  console.log(`\n${'─'.repeat(74)}`);
  console.log(`${name}`);
  console.log(`  ${r.elementsWalked} elements · canvas ${r.canvasWidth}px @ ${r.viewport.width}×${r.viewport.height}` +
              (r.canvasWidth !== EXPECTED_CANVAS_WIDTH ? `  ⚠ expected ${EXPECTED_CANVAS_WIDTH}px` : '') +
              (r.diagnostics.fontsReady ? '' : '  ⚠ webfonts did not resolve'));
  console.log(`\n  vector  [${CELLS.map((k) => mark(c[k].score)).join(', ')}]   joint ${mark(r.joint)}` +
              `   (${CELLS.join(', ')})`);
  console.log('');
  console.log(`  ${pad('spacing', 9)} ${mark(c.spacing.score)}  ${c.spacing.occurrences} declarations · ` +
              `values ${list(c.spacing.values)}` +
              (c.spacing.offScale.length ? `\n  ${' '.repeat(12)}off scale: ${list(c.spacing.offScale)}` : '') +
              (c.spacing.negatives ? `\n  ${' '.repeat(12)}${c.spacing.negatives} negative` : ''));
  const std = r.standard ?? { height: 49, gap: 14, radius: 13, min: 44 };
  console.log(`  ${pad('height', 9)} ${mark(c.height.score)}  ${c.height.controls} a/button · ` +
              `heights ${list(c.height.values)} · ${std.height} ${c.height.has49 ? 'present' : 'absent'} · ` +
              `all ≥${std.min} and on scale: ${c.height.allConform ? 'yes' : 'no'}` +
              (c.height.unrendered ? `\n  ${' '.repeat(12)}${c.height.unrendered} unrendered, excluded` : '') +
              (c.height.transformed ? `\n  ${' '.repeat(12)}${c.height.transformed} transformed — layout height used, painted differs` : '') +
              (c.height.otherControls.length ? `\n  ${' '.repeat(12)}also present, not scored: ` +
                list(c.height.otherControls.map((o) => `${o.tag}:${o.height}`)) : ''));
  console.log(`  ${pad('gap', 9)} ${mark(c.gap.score)}  ${c.gap.occurrences} declarations · ` +
              `values ${list(c.gap.values)} · ${std.gap} ${c.gap.has14 ? 'present' : 'absent'}`);
  console.log(`  ${pad('radius', 9)} ${mark(c.radius.score)}  ${c.radius.occurrences} declarations · ` +
              `values ${list(c.radius.values)} · ${std.radius} ${c.radius.has13 ? 'PRESENT' : 'absent'}` +
              (c.radius.nonPx.length ? `\n  ${' '.repeat(12)}${c.radius.nonPx.length} non-px radii, not scored: ` +
                list(c.radius.nonPx.map((o) => `${o.tag} ${o.raw}`), 6) : ''));
  console.log(`  ${pad('colour', 9)} ${mark(c.colour.score)}  ${c.colour.distinct} distinct ` +
              `(${c.colour.occurrences} declarations, alpha ignored)` +
              (c.colour.distinctSrgb < c.colour.distinct
                ? `\n  ${' '.repeat(12)}⚠ only ${c.colour.distinctSrgb} distinct once rasterised — ` +
                  `a colour is written more than one way`
                : '') +
              `\n  ${' '.repeat(12)}${list(c.colour.values, 8)}`);
  console.log('');
  console.log(`  ${pad('decoy', 9)} ·  line-height: ${r.decoy.lineHeightDistinctRatios} distinct ratios ` +
              `${list(r.decoy.ratios, 8)}   (ungoverned, never scored)`);
  if (r.diagnostics.boxShadowColours.length) {
    console.log(`  ${pad('shadows', 9)} ·  ${r.diagnostics.boxShadowColours.length} colours in box-shadow (not scored)`);
  }
}

/* ---------- run ---------------------------------------------------------- */

const work = mkdtempSync(join(tmpdir(), 'l1-score-'));
const results = [];
let failed = 0;
let chrome = null;
let cdp = null;

try {
  for (const f of files) {
    const name = basename(f);
    let html, mode;
    try {
      const run = JSON.parse(readFileSync(f, 'utf8'));
      html = run?.canvas?.html;
      mode = run?.run?.mode ?? 'unknown';
      if (typeof html !== 'string') throw new Error('no canvas.html in export');
    } catch (e) {
      console.error(`\n${name}: cannot read — ${e.message}`);
      failed++;
      continue;
    }

    if (!html.trim()) {
      console.log(`\n${'─'.repeat(74)}\n${name}  [${mode}]\n  empty canvas — every cell unmeasurable`);
      results.push({ file: f, name, mode, joint: 'unmeasurable' });
      continue;
    }

    try {
      if (!cdp) {
        chrome = await launchChrome(join(work, 'profile'));
        cdp = await CDP.connect(chrome.wsUrl);
      }
      const run = JSON.parse(readFileSync(f, 'utf8'));
      const shipped = standardFrom(run?.standard?.shipped);
      const amendedStd = standardFrom(run?.standard?.amended);

      if (shipped?.unsatisfiable || amendedStd?.unsatisfiable) {
        const which = shipped?.unsatisfiable ? shipped : amendedStd;
        console.log(`\n${'─'.repeat(74)}\n${name}  [${mode}]`);
        console.log(`  no chain exists under this standard: no scale value reaches ` +
                    `the ${which.min}px minimum.`);
        console.log(`  conformance is n/a by construction — not scored, and not a failure.`);
        results.push({ file: f, name, mode, against: 'unsatisfiable', joint: 'unmeasurable' });
        continue;
      }

      const r = await renderAndScore(cdp, html, shipped);
      report(`${name}  [${mode}]` + (shipped ? '  — against the standard as shipped' : ''), r);
      results.push({ file: f, name, mode, against: shipped ? 'shipped' : 'level-1', ...r });

      if (amendedStd && !sameStandard(shipped, amendedStd)) {
        const r2 = await renderAndScore(cdp, html, amendedStd);
        report(`${name}  [${mode}]  — against the standard as amended`, r2);
        results.push({ file: f, name: name + ' (amended)', mode, against: 'amended', ...r2 });
        console.log(`\n  \u26a0 the standard was amended during this run. Two vectors above:` +
          `\n    conformance to what the agent was given, and to what a human moved it to.`);
      }
    } catch (e) {
      console.error(`\n${name}: scoring failed — ${e.message}`);
      failed++;
    }
  }
} finally {
  cdp?.close();
  chrome?.proc.kill();
}

/* ---------- summary ------------------------------------------------------ */

if (results.length) {
  console.log(`\n${'═'.repeat(74)}`);
  console.log(`${pad('run', 38)} ${pad('mode', 13)} ${CELLS.map((c) => c.slice(0, 3)).join(' ')}  joint`);
  for (const r of results) {
    const v = r.cells ? CELLS.map((k) => mark(r.cells[k].score)) : CELLS.map(() => '?');
    console.log(`${pad(r.name.slice(0, 37), 38)} ${pad(r.mode, 13)} ` +
                v.map((x) => ` ${x} `).join(' ') + `   ${mark(r.joint)}`);
  }
  console.log(`\n  1 = conforms · 0 = does not · ? = unmeasurable (the governed property is absent)`);
  console.log(`  the decisive cell is radius: for the Level 1 standard, 13px is reachable` +
              ` only via scale → 49 → 14 → 13`);
}

if (asJson) {
  const out = join(work, 'scores.json');
  writeFileSync(out, JSON.stringify(results, null, 2));
  console.log('\n' + JSON.stringify(results, null, 2));
  if (keep) console.log(`\nscores written to ${out}`);
}

/* Chrome is still tearing its profile down as we exit, so the temp directory
   can refuse to go on the first attempt. Cleanup must never decide the exit
   code — the runbook reads that as a scoring failure. */
if (keep) console.log(`\nworking directory kept at ${work}`);
else {
  try { rmSync(work, { recursive: true, force: true, maxRetries: 10, retryDelay: 120 }); }
  catch { /* a stale temp dir is harmless */ }
}

process.exit(failed ? 1 : 0);
