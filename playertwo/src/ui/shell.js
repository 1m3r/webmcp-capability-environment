/* The only module that touches the DOM. It holds no game rules — every mutation
   goes through the game's reducer, so the page and a Node test take exactly the
   same path through the state machine. */

import { register, get } from '../registry.js';
import { mirror } from '../games/mirror/index.js';
import { buildExport } from '../exporter.js';
import { detect, registerTools, reregister } from '../webmcp.js';
import { createWaitRegistry } from '../waiters.js';

register(mirror);
const game = get('mirror');

const el = (id) => document.getElementById(id);
const stage = el('stage');
const waits = createWaitRegistry();

let doc = load();
let found = null;
let registration = { method: 'none', registered: 0, errors: [] };
let registeredNames = [];

function load() {
  try {
    const raw = localStorage.getItem(game.storageKey);
    if (raw) return JSON.parse(raw);
  } catch { /* a corrupt or blocked store starts fresh rather than failing */ }
  return null;   // no game yet: the start screen decides the mode
}

function save() {
  if (!doc) return;
  try {
    localStorage.setItem(game.storageKey, JSON.stringify(doc));
  } catch { /* private mode: the game still plays, it just will not survive a reload */ }
}

/* The tools read and write through here, so a tool call and a click land in the
   same place and neither can bypass the reducer. */
const ctx = {
  getDoc: () => doc,
  setDoc: (next) => {
    const tierBefore = doc.tier;
    doc = next;
    save();
    render();
    waits.notify(doc.version);
    if (doc.tier !== tierBefore) syncTools();
  },
  now: () => Date.now(),
  waits
};

function dispatch(action) {
  const result = game.reduce(doc, action, Date.now());
  ctx.setDoc(result.doc);
  if (!result.ok) flash(result.message);
}

function flash(message) {
  const node = el('flash');
  node.textContent = message;
  node.hidden = false;
  clearTimeout(flash.timer);
  flash.timer = setTimeout(() => { node.hidden = true; }, 6000);
}

function renderLog() {
  el('log').innerHTML = doc.log
    .slice(-40)
    .reverse()
    .map((e) => {
      const detail = String(e.detail ?? '');
      return `<li class="log__entry log__entry--${e.actor}" data-outcome="${e.outcome}">
        <span class="log__actor">${e.actor}</span>
        <span class="log__action">${e.action}</span>
        <span class="log__detail">${detail.replace(/[<>&]/g, '')}</span>
      </li>`;
    })
    .join('');
}

function renderStatus() {
  el('s-entry').textContent = found ? found.entry : 'no model context';
  el('s-tools').textContent = `${registration.registered} tools`;
  el('s-tier').textContent = doc ? `tier ${doc.tier}` : 'no game';
  el('s-version').textContent = doc ? `v${doc.version}` : 'v0';
  const grant = el('grant');
  grant.hidden = !doc || !game.canGrant(doc);
  grant.textContent = game.grantLabel;
  const opt = el('panel-opt');
  opt.hidden = !doc || doc.mode !== 'portrait';
  if (doc) el('panel-opt-input').checked = doc.answerAboutAgent !== false;
}

function render() {
  if (!doc) {
    stage.innerHTML = game.renderStart();
    el('log').innerHTML = '';
    renderStatus();
    return;
  }
  stage.innerHTML = game.render(doc);
  renderLog();
  renderStatus();
}

/* ---- human input. None of this exists as a tool. --------------------- */

stage.addEventListener('click', (event) => {
  const mode = event.target.closest('[data-mode]');
  if (mode) {
    const answerAboutAgent = document.getElementById('opt-about-agent')?.checked !== false;
    doc = game.createDoc(Date.now(), { mode: mode.dataset.mode, answerAboutAgent });
    save();
    render();
    syncTools();
    return;
  }
  if (!doc) return;
  const button = event.target.closest('[data-action]');
  if (!button || button.tagName !== 'BUTTON') return;
  const action = button.dataset.action;
  if (action === 'reveal') dispatch({ type: 'reveal' });
  if (action === 'judge') dispatch({ type: 'judge', verdict: button.dataset.verdict });
  if (action === 'next') dispatch({ type: 'next' });
});

stage.addEventListener('submit', (event) => {
  const form = event.target.closest('form[data-action="human_submit"]');
  if (!form || !doc) return;
  event.preventDefault();
  const input = form.querySelector('#human-answer');
  dispatch({ type: 'human_submit', text: input.value });
  input.value = '';
});

el('grant').addEventListener('click', () => dispatch({ type: 'grant_tier' }));

el('panel-opt-input').addEventListener('change', (event) => {
  dispatch({ type: 'set_answer_about_agent', value: event.target.checked });
});

el('restart').addEventListener('click', () => {
  if (doc && doc.log.length > 0 &&
      !confirm('Restart wipes every answer and the whole log. There is no undo. Continue?')) return;
  doc = null;
  try { localStorage.removeItem(game.storageKey); } catch { /* nothing to clear */ }
  waits.notify(0);   // release any agent waiting on a version that will never come
  render();
});

el('export').addEventListener('click', () => {
  if (!doc) return;
  for (const file of buildExport(doc, game.renderPortrait)) {
    const url = URL.createObjectURL(new Blob([file.body], { type: file.type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  }
});

/* ---- WebMCP ---------------------------------------------------------- */

async function syncTools() {
  if (!found) return;
  const tools = game.buildTools(ctx);
  const result = await reregister(found.mc, tools, registeredNames);
  registeredNames = tools.map((t) => t.name);
  registration = {
    method: result.method,
    registered: registeredNames.length,
    errors: registration.errors.concat(result.errors)
  };
  renderStatus();
}

async function boot() {
  render();
  found = detect();
  if (!found) {
    renderStatus();
    console.warn('[mirror] no model context — the page is mute to an agent');
    return;
  }
  const tools = game.buildTools(ctx);
  registration = await registerTools(found.mc, tools);
  registeredNames = tools.map((t) => t.name);
  renderStatus();
  console.log(`[mirror] ${registration.registered} tools via ${registration.method} on ${found.entry}`);
  if (registration.errors.length) console.warn('[mirror]', registration.errors);
}

/* A waiter left pending across a teardown is an agent stuck until its timeout. */
addEventListener('pagehide', () => waits.dispose());

boot();
