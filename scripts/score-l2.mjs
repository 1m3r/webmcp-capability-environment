#!/usr/bin/env node
/* Score a Level 2 battery export.

   The frozen scorer reads one artifact and one standard from a run export. A
   battery export holds ten of each, in `trials[]`. Without this splitter the
   frozen scorer still runs on a battery file — and prints a confident wrong
   answer, because `standard.shipped` is snapshotted at page load and is always
   the seed (44, 2/7 -> 49/14/13) no matter which trial produced the artifact.

   This file only rearranges data and shells out. It does not score anything
   itself, so the instrument freeze is untouched.

     node scripts/score-l2.mjs runs/L2-battery.json [--keep]
*/

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCORER = join(HERE, 'score-level1.mjs');

const args = process.argv.slice(2);
const keep = args.includes('--keep');
const file = args.find((a) => !a.startsWith('--'));

if (!file) {
  console.error('usage: node scripts/score-l2.mjs <battery-export.json> [--keep]');
  process.exit(2);
}

const battery = JSON.parse(readFileSync(file, 'utf8'));
if (!Array.isArray(battery.trials) || !battery.trials.length) {
  console.error(`${file}: no trials[] — is this a battery export?`);
  process.exit(2);
}

/* Whether a trial has a chain at all. U1/U2 are satisfiable-looking to
   standardFrom (they have a height) but their derived gap is off the scale, so
   conformance is n/a by construction and a printed vector would read as a
   failure that never had a chance to succeed. */
function chainOf(rules) {
  const scale = [...(rules.spacing?.value ?? [])].sort((a, b) => a - b);
  const min = rules.controls?.value;
  const height = scale.find((v) => v >= min) ?? null;
  const ratio = rules.gap?.value;
  const gap = height != null && ratio ? (height * ratio[0]) / ratio[1] : null;
  const radius = gap != null && rules.radius?.value != null ? gap + rules.radius.value : null;
  const onScale = gap != null && scale.some((v) => Math.abs(v - gap) < 0.02);
  return { scale, min, height, gap, radius, satisfiable: height != null && onScale };
}

const work = mkdtempSync(join(tmpdir(), 'l2-score-'));
const jobs = [];

for (const t of battery.trials) {
  const chain = chainOf(t.standard ?? {});
  const rec = { index: t.index, label: t.label, chain, trial: t, files: {} };

  if (!chain.satisfiable) { jobs.push(rec); continue; }

  for (const phase of ['firstApplyHtml', 'finalHtml']) {
    const html = t[phase];
    if (typeof html !== 'string' || !html.trim()) continue;
    const p = join(work, `t${t.index}-${phase === 'firstApplyHtml' ? 'first' : 'final'}.json`);
    writeFileSync(p, JSON.stringify({
      probe: 'webmcp-house-control', probeVersion: '1.0.0',
      run: { runId: `${battery.run?.runId ?? 'l2'}-t${t.index}`, mode: 'gate' },
      standard: { shipped: { rules: t.standard } },
      canvas: { elementCount: 0, html },
    }));
    rec.files[phase] = p;
  }
  jobs.push(rec);
}

const toScore = jobs.flatMap((r) => Object.values(r.files));
let scored = [];

if (toScore.length) {
  const out = execFileSync(process.execPath, [SCORER, '--json', ...toScore],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const at = out.lastIndexOf('\n[');
  if (at < 0) { console.error('scorer produced no JSON block'); process.exit(1); }
  scored = JSON.parse(out.slice(at));
}

const byName = new Map(scored.map((s) => [s.name, s]));
const vec = (s) => (s?.cells
  ? ['spacing', 'height', 'gap', 'radius', 'colour']
      .map((k) => (s.cells[k].score === 1 ? '1' : s.cells[k].score === 0 ? '0' : '?')).join('')
  : '—');

/* `derived` is the conjunction of the three governed by the chain. The other
   two cells are reported but are not the claim: spacing and colour are enforced
   independently of the derivation. */
const conj = (s) => {
  if (!s?.cells) return 'na';
  const c = ['height', 'gap', 'radius'].map((k) => s.cells[k].score);
  if (c.some((x) => x !== 0 && x !== 1)) return 'na';
  return c.every((x) => x === 1) ? '1' : '0';
};
const omitted = (s) => (s?.cells
  ? ['height', 'gap', 'radius'].filter((k) => s.cells[k].score !== 0 && s.cells[k].score !== 1).length
  : 3);

console.log(`\n${'═'.repeat(78)}`);
console.log(`Level 2 battery — ${file}`);
console.log(`${battery.trials.length} trials · ${battery.gate?.applied ?? '?'} applied · ` +
            `${battery.gate?.refused ?? '?'} refused\n`);

const pad = (s, n) => String(s).padEnd(n);
console.log(`${pad('trial', 7)}${pad('target H/G/R', 16)}${pad('derived', 9)}${pad('converged', 11)}` +
            `${pad('omitted', 9)}${pad('refusals', 10)}${pad('requests', 10)}notes`);

const summary = { derived: { 1: 0, 0: 0, na: 0 }, converged: { 1: 0, 0: 0, na: 0 } };

for (const r of jobs) {
  const t = r.trial;
  const target = r.chain.satisfiable
    ? `${r.chain.height}/${r.chain.gap}/${r.chain.radius}` : '—';
  const notes = [];
  if (!r.chain.satisfiable) {
    notes.push(r.chain.height == null
      ? `no height reaches ${r.chain.min}px`
      : `derived gap ${r.chain.gap} is off the scale`);
    notes.push('n/a by construction');
  }
  if (t.divergent) notes.push('STANDARD CHANGED MID-TRIAL');
  if (t.firstApplyHtml === null) notes.push('no apply recorded');

  const d = r.chain.satisfiable ? conj(byName.get(`t${t.index}-first.json`)) : 'na';
  const c = r.chain.satisfiable ? conj(byName.get(`t${t.index}-final.json`)) : 'na';
  summary.derived[d]++; summary.converged[c]++;

  console.log(`${pad(t.label ?? t.index, 7)}${pad(target, 16)}${pad(d, 9)}${pad(c, 11)}` +
    `${pad(r.chain.satisfiable ? omitted(byName.get(`t${t.index}-first.json`)) : '—', 9)}` +
    `${pad(t.refusals ?? 0, 10)}${pad((t.requestIds ?? []).length, 10)}${notes.join(' · ')}`);

  if (r.chain.satisfiable) {
    const f = byName.get(`t${t.index}-first.json`);
    const g = byName.get(`t${t.index}-final.json`);
    console.log(`${' '.repeat(7)}full vectors [spa hei gap rad col]   first ${vec(f)}   final ${vec(g)}`);
  }
}

const sat = jobs.filter((r) => r.chain.satisfiable).length;
console.log(`\n${'─'.repeat(78)}`);
console.log(`derived (first apply)   ${summary.derived['1']} of ${sat} satisfiable trials` +
            `   [0: ${summary.derived['0']} · na: ${summary.derived.na - (jobs.length - sat)}]`);
console.log(`converged (final)       ${summary.converged['1']} of ${sat}`);
console.log(`\n  derived = height AND gap AND radius correct on the FIRST apply of the trial.`);
console.log(`  na counts against the threshold — see the pre-registration, §6.`);
console.log(`  spacing and colour are reported in the full vectors but are not the claim:`);
console.log(`  the gate enforces them independently of the derivation.`);

if (keep) console.log(`\nper-trial files kept at ${work}`);
else { try { rmSync(work, { recursive: true, force: true, maxRetries: 5 }); } catch {} }
