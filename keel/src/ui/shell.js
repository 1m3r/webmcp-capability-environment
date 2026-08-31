import { createStore } from '../state.js';
import { PHASES, phaseById } from '../phases.js';
import { gateStatus } from '../checks.js';
import { buildTools } from '../tools.js';
import { detect, registerTools, watchForContext } from '../webmcp.js';
import { buildExport } from '../exporter.js';
import { renderLog } from './log.js';

const store = createStore({ storage: window.localStorage });
const ctx = { store };
const el = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* every human action goes through here, so the log reads as a conversation
   between two actors rather than a list of writes */
function human(kind, detail, touched, fn) {
  store.mutate({ actor: 'human', kind, detail, touched }, fn);
}

/* A human may always act. They may not act without being told what it costs —
   a confirmed phase going red behind them is exactly the failure the probe's
   operator walked into, where the panel said nothing and the agent found it. */
function humanChecked(kind, detail, touched, fn) {
  const before = store.get();
  const after = structuredClone(before);
  fn(after);

  const broken = PHASES.filter((p) =>
    before.confirmedPhases.includes(p.id) &&
    gateStatus(before, p.checks).ok &&
    !gateStatus(after, p.checks).ok);

  if (broken.length && !window.confirm(
    'This reopens ' + broken.map((p) => p.title).join(' and ') +
    '. The blueprint stops being ready until that is settled. Go ahead?')) return;

  human(kind, detail, touched, fn);
}

/* ---- webmcp ------------------------------------------------------------ */

let registration = { method: 'none', registered: 0, errors: [], entry: null };
let registeredPhase = null;

async function registerForPhase(phaseId) {
  const found = detect(window);
  if (!found) return;
  const r = await registerTools(found.mc, buildTools(phaseId, ctx));
  registration = { ...r, entry: found.entry };
  registeredPhase = phaseId;
  renderStatus();
}

function renderStatus() {
  const doc = store.get();
  el('status').innerHTML =
    `<span>${esc(registration.entry || 'no model context')}</span>` +
    `<span>${registration.registered} tools · ${esc(registration.method)}</span>` +
    `<span>v${doc.version}</span>` +
    (registration.errors.length ? `<span class="bad">${esc(registration.errors[0])}</span>` : '');
}

/* ---- rail -------------------------------------------------------------- */

function renderRail() {
  const doc = store.get();
  el('rail').innerHTML = PHASES.map((p, i) => {
    const g = gateStatus(doc, p.checks);
    const here = p.id === doc.phase;
    const state = here ? 'here' : g.ok ? 'open' : 'shut';
    return `<div class="step ${state}"><span class="n">${i}</span><span class="t">${esc(p.title)}</span></div>`;
  }).join('');
}

/* ---- guide ------------------------------------------------------------- */

/* The guides are hard-wrapped plain text, because that is the form the agent
   reads them in. Rendering them as <pre> in a narrow column wraps them twice
   and they become unreadable for the human, so prose paragraphs are reflowed
   and only indented blocks keep their shape. */
function renderGuide() {
  const phase = phaseById(store.get().phase);
  const html = phase.guide.split(/\n\s*\n/).map((block) => {
    const preformatted = /^\s{2,}|^\s*[-|]/m.test(block);
    if (preformatted) return `<pre>${checkChips(esc(block))}</pre>`;
    return `<p>${checkChips(esc(block.replace(/\n/g, ' ')))}</p>`;
  }).join('');
  el('guide').innerHTML = `<div class="guide-text">${html}</div>`;
}

/* A [check:id] marker is how a guide names the predicate that enforces it.
   The agent reads the raw text; the human gets a chip, so the binding between
   what the page SAYS and what it ENFORCES is visible rather than syntax. */
function checkChips(html) {
  return html.replace(/\[check:([a-z_]+)\]/g, '<span class="chip">$1</span>');
}

/* ---- canvas: the human's controls -------------------------------------- */

function renderCanvas() {
  const doc = store.get();
  const parts = [];

  if (!doc.concept) {
    parts.push(`<div class="drop" id="drop"><p>Drop your concept brief here, or <button id="btn-pick" type="button">choose a file</button>.</p><p class="fine">It is read in this browser and never uploaded.</p></div>`);
  } else {
    parts.push(`<div class="card concept"><h3>${esc(doc.concept.name)}</h3><pre>${esc(doc.concept.text.slice(0, 600))}</pre></div>`);
  }

  for (const q of doc.questions) {
    if (q.answer || q.deferred) {
      parts.push(`<div class="card done"><h3>${esc(q.text)}</h3><p>${q.deferred ? '<em>deferred</em>' : esc(q.answer)}</p></div>`);
      continue;
    }
    const options = (q.options || []).map((o) => `<button class="opt" data-answer="${esc(q.id)}" data-value="${esc(o)}" type="button">${esc(o)}</button>`).join('');
    parts.push(`<div class="card ask">
      <h3>${esc(q.text)}</h3>
      <p class="why">${esc(q.why)}</p>
      ${options}
      <form data-answer-form="${esc(q.id)}"><input name="a" placeholder="or answer in your own words" autocomplete="off"><button type="submit">Answer</button></form>
      <button class="ghost" data-defer="${esc(q.id)}" type="button">Defer</button>
    </div>`);
  }

  for (const c of doc.claims.filter((x) => x.loadBearing)) {
    const sources = c.evidence.map((e) => esc(e.source)).join(', ');
    parts.push(`<div class="card claim ${c.evidence.length ? 'done' : 'ask'}">
      <h3>${esc(c.text)}</h3>
      <p class="why">${sources || 'no source yet'}</p></div>`);
  }

  for (const d of doc.decisions) {
    if (d.chosen) {
      parts.push(`<div class="card done"><h3>${esc(d.question)}</h3><p><b>${esc(d.chosen)}</b> — ${esc(d.rationale)}</p></div>`);
      continue;
    }
    const options = d.options.map((o) => `<button class="opt wide" data-choose="${esc(d.id)}" data-value="${esc(o.label)}" type="button">
      <b>${esc(o.label)}</b><span>${esc(o.tradeoffs)}</span>
      ${o.label === d.recommendation ? '<em>recommended</em>' : ''}</button>`).join('');
    parts.push(`<div class="card decide"><h3>${esc(d.question)}</h3><p class="why">${esc(d.rationale)}</p>${options}</div>`);
  }

  for (const f of doc.findings.filter((x) => x.status === 'open')) {
    parts.push(`<div class="card finding ${esc(f.severity)}"><h3>${esc(f.severity)} — ${esc(f.item)}</h3><p>${esc(f.claim)}</p>
      <button class="ghost" data-accept="${esc(f.id)}" type="button">Accept as won't-fix</button></div>`);
  }

  if (doc.pendingAdvance) {
    parts.push(`<div class="card pending"><h3>Ready to move on</h3>
      <p>The agent has asked to move from <b>${esc(doc.pendingAdvance.from)}</b> to <b>${esc(doc.pendingAdvance.to)}</b>. Every check passes.</p>
      <button id="btn-confirm" type="button">Confirm</button>
      <button class="ghost" id="btn-dismiss" type="button">Not yet</button></div>`);
  }

  el('canvas').innerHTML = parts.join('');
}

/* ---- gate -------------------------------------------------------------- */

let lastRefusalCount = 0;

function renderGate() {
  const doc = store.get();
  const phase = phaseById(doc.phase);
  const g = gateStatus(doc, phase.checks);
  el('gate').innerHTML = `<h2 class="${g.ok ? 'open' : 'shut'}">${g.ok ? 'Gate open' : 'Gate shut'}</h2>` +
    phase.checks.map((id) => {
      const failed = g.failed.find((f) => f.id === id);
      return `<div class="check ${failed ? 'fail' : 'pass'}">
        <b>${esc(id)}</b>
        ${failed ? `<ul>${failed.offenders.slice(0, 6).map((o) => `<li>${esc(o.where)}: ${esc(o.detail)}</li>`).join('')}</ul>` : ''}
      </div>`;
    }).join('');
  el('btn-ready').disabled = !(doc.phase === 'ship' && g.ok);

  /* the signature interaction: a refusal is the moment the page stops being a
     form and becomes a boundary, so it is the one thing that moves */
  const refusals = doc.events.filter((e) => e.kind === 'request_advance_refused').length;
  if (refusals > lastRefusalCount) flashRefusal();
  lastRefusalCount = refusals;
}

let flashTimer = null;
function flashRefusal() {
  const panel = el('gate');
  panel.classList.remove('refused');
  void panel.offsetWidth;               // restart the animation
  panel.classList.add('refused');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => panel.classList.remove('refused'), 600);
}

/* ---- one render pass --------------------------------------------------- */

function render() {
  renderRail();
  renderGuide();
  renderCanvas();
  renderGate();
  renderLog(el('log'), store.get().events);
  renderStatus();
  const phase = store.get().phase;
  if (phase !== registeredPhase) registerForPhase(phase);
  if (location.hash !== '#/' + phase) location.hash = '#/' + phase;
}

store.subscribe(render);

/* ---- human actions, and nothing else ----------------------------------- */

document.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;

  if (t.dataset.answer) humanChecked('answer', t.dataset.value, ['questions.' + t.dataset.answer],
    (d) => { d.questions.find((q) => q.id === t.dataset.answer).answer = t.dataset.value; });

  if (t.dataset.defer) humanChecked('defer', t.dataset.defer, ['questions.' + t.dataset.defer],
    (d) => { d.questions.find((q) => q.id === t.dataset.defer).deferred = true; });

  if (t.dataset.choose) humanChecked('resolve_decision', t.dataset.value, ['decisions.' + t.dataset.choose], (d) => {
    const dec = d.decisions.find((x) => x.id === t.dataset.choose);
    dec.chosen = t.dataset.value;
    dec.locked = true;
    dec.rejected = dec.options.filter((o) => o.label !== t.dataset.value).map((o) => ({ option: o.label, reason: o.tradeoffs }));
  });

  if (t.dataset.accept) humanChecked('accept_finding', t.dataset.accept, ['findings.' + t.dataset.accept],
    (d) => { d.findings.find((f) => f.id === t.dataset.accept).status = 'accepted'; });

  if (t.id === 'btn-confirm') human('confirm_advance', store.get().pendingAdvance.to, ['phase'],
    (d) => { d.phase = d.pendingAdvance.to; d.confirmedPhases.push(d.pendingAdvance.from); d.pendingAdvance = null; });

  if (t.id === 'btn-dismiss') human('dismiss_advance', '', ['pendingAdvance'], (d) => { d.pendingAdvance = null; });

  if (t.id === 'btn-pick') el('file').click();

  if (t.id === 'btn-export') download(buildExport(store.get()));

  if (t.id === 'btn-ready') human('declare_ready', 'the human pressed READY', ['events'], () => {});
});

document.addEventListener('submit', (e) => {
  const id = e.target.dataset.answerForm;
  if (!id) return;
  e.preventDefault();
  const value = new FormData(e.target).get('a');
  if (!String(value).trim()) return;
  humanChecked('answer', String(value), ['questions.' + id], (d) => { d.questions.find((q) => q.id === id).answer = String(value); });
});

/* ---- the brief never leaves the machine -------------------------------- */

async function loadFile(file) {
  const text = await file.text();
  human('load_concept', file.name, ['concept'], (d) => { d.concept = { name: file.name, text }; });
}

el('file').addEventListener('change', (e) => { if (e.target.files[0]) loadFile(e.target.files[0]); });
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]); });

function download({ md, json, journey }) {
  const files = [['blueprint.md', md], ['blueprint.json', JSON.stringify(json, null, 2)], ['journey.json', JSON.stringify(journey, null, 2)]];
  for (const [name, body] of files) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([body], { type: 'text/plain' }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}

/* ---- start ------------------------------------------------------------- */

watchForContext(window, () => registerForPhase(store.get().phase));
render();
