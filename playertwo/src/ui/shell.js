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

/* The one number the shell holds that is not in the document. The transmission
   fires on the version that granted the tier and is dismissed by matching it,
   so a dismissal costs no state field and leaves no event in the journey. */
let transmissionSeen = null;

/* The grant offer renders below round 4 rather than replacing it, which is
   right — you keep the reveal you just earned — but on a laptop it lands past
   the fold. Scrolled into view once, on the render where it first appears, so
   it cannot be missed and does not fight the page on every render after. */
let grantWasOffered = false;

/* Filled in at deploy time. Empty strings simply drop the link. */
const LINKS = {
  repoUrl: 'https://github.com/1m3r/webmcp-capability-environment',
  videoUrl: ''
};

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

/* A refusal needs no special handling here: it is in the document's log like
   every other event, and renderRound puts the current one on the stage. There
   used to be a sidebar flash as well — two surfaces for one event, one of them
   on a six-second timer that could expire mid-demo. */
function dispatch(action) {
  const result = game.reduce(doc, action, Date.now());
  ctx.setDoc(result.doc);
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
  document.body.dataset.landing = String(showLanding());
  el('s-entry').textContent = found ? found.entry : 'no model context';
  el('s-tools').textContent = `${registration.registered} tools`;
  el('s-tier').textContent = doc ? `tier ${doc.tier}` : 'no game';
  el('s-version').textContent = doc ? `v${doc.version}` : 'v0';
  const grant = el('grant');
  grant.hidden = !doc || !game.canGrant(doc);
  grant.textContent = game.grantLabel;
  const opt = el('panel-opt');
  opt.hidden = !doc || doc.mode !== 'portrait';
  /* Nothing to export and nothing to restart until a game exists. */
  el('export').hidden = !doc;
  el('restart').hidden = !doc;
  if (doc) el('panel-opt-input').checked = doc.answerAboutAgent !== false;
}

/* A judge arriving in ordinary Chrome gets the landing screen instead of a
   start screen that leads to a game which cannot take its first turn. Only when
   there is nothing to resume — a saved game still belongs to whoever saved it —
   and ?play=1 opts out so the page can be developed without the flag. */
function showLanding() {
  return !found
    && !doc
    && new URLSearchParams(location.search).get('play') !== '1';
}

function render() {
  if (showLanding()) {
    stage.innerHTML = game.renderLanding(LINKS);
    el('log').innerHTML = '';
    renderStatus();
    return;
  }
  if (!doc) {
    stage.innerHTML = game.renderStart();
    el('log').innerHTML = '';
    renderStatus();
    return;
  }
  stage.innerHTML = game.render(doc, { transmissionSeen });
  renderLog();
  renderStatus();

  const offered = game.atGrantMoment(doc);
  if (offered && !grantWasOffered) {
    /* Deferred a frame so the stage has laid out and knows its scrollHeight.
       Scrolling the stage to its end rather than calling scrollIntoView on the
       panel: the offer is the last thing in the stage, and an explicit target
       cannot be clamped or interrupted the way a centred scroll was. */
    requestAnimationFrame(() => {
      /* Instant, not smooth. A smooth scroll on this element is unreliable
         across browsers — it was observed animating back to 0 — and a demo
         cannot depend on it. The round stays above; scroll up to re-read it. */
      stage.scrollTo({ top: stage.scrollHeight, behavior: 'auto' });
    });
  }
  grantWasOffered = offered;
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
  if (action === 'grant') dispatch({ type: 'grant_tier' });
  /* Not a reducer action: dismissing the transmission changes nothing about the
     game, and an event for it would be noise in the run record. */
  if (action === 'dismiss') { transmissionSeen = doc.version; render(); }
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
  transmissionSeen = null;
  grantWasOffered = false;
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
  /* detect() first, then render once. Rendering before detection would show the
     start screen for a frame and then replace it with the landing screen. */
  found = detect();
  render();
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
