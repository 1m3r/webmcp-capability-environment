/* The only module that touches the DOM. It holds no game rules — every mutation
   goes through the game's reducer, so the page and a Node test take exactly the
   same path through the state machine. */

import { register, get } from '../registry.js';
import { mirror } from '../games/mirror/index.js';
import { buildExport } from '../exporter.js';
import { detect, registerTools, reregister } from '../webmcp.js';

register(mirror);
const game = get('mirror');

const el = (id) => document.getElementById(id);
const stage = el('stage');

let doc = load();
let found = null;
let registration = { method: 'none', registered: 0, errors: [] };
let registeredNames = [];

function load() {
  try {
    const raw = localStorage.getItem(game.storageKey);
    if (raw) return JSON.parse(raw);
  } catch { /* a corrupt or blocked store starts a fresh game rather than failing */ }
  return game.createDoc(Date.now());
}

function save() {
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
    if (doc.tier !== tierBefore) syncTools();
  },
  now: () => Date.now()
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
  el('s-tier').textContent = `tier ${doc.tier}`;
  el('s-version').textContent = `v${doc.version}`;
  const grant = el('grant');
  grant.hidden = !game.canGrant(doc);
  grant.textContent = game.grantLabel;
}

function render() {
  stage.innerHTML = game.render(doc);
  renderLog();
  renderStatus();
}

/* ---- human input. None of this exists as a tool. --------------------- */

stage.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button || button.tagName !== 'BUTTON') return;
  const action = button.dataset.action;
  if (action === 'reveal') dispatch({ type: 'reveal' });
  if (action === 'judge') dispatch({ type: 'judge', verdict: button.dataset.verdict });
  if (action === 'next') dispatch({ type: 'next' });
});

stage.addEventListener('submit', (event) => {
  const form = event.target.closest('form[data-action="human_submit"]');
  if (!form) return;
  event.preventDefault();
  const input = form.querySelector('#human-answer');
  dispatch({ type: 'human_submit', text: input.value });
  input.value = '';
});

el('grant').addEventListener('click', () => dispatch({ type: 'grant_tier' }));

el('restart').addEventListener('click', () => {
  const started = doc.log.length > 0;
  if (started && !confirm('Restart wipes every answer and the whole log. There is no undo. Continue?')) return;
  doc = game.createDoc(Date.now());
  save();
  render();
});

el('export').addEventListener('click', () => {
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

boot();
