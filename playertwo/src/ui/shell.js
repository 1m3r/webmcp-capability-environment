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
const params = new URLSearchParams(location.search);

/* The instruments — the log, the version, the tier — are the experiment's, not
   the player's. Off by default; `?instrument=on` for a run or a judge. */
document.body.dataset.instrument = params.get('instrument') === 'on' ? 'on' : 'off';

let doc = load();
let found = null;
let registration = { method: 'none', registered: 0, errors: [] };

/* What the agent is currently holding, as tool OBJECTS rather than names.
   reregister compares bodies, because this game shapes submit_answer's schema
   from the mode and a name alone cannot say whether a registration is stale. */
let registeredTools = [];

/* Everything that changes the shape of the tool surface. The mode chooses
   submit_answer's schema and the level chooses which verbs exist, so a change
   in either has to reach the client. Tier alone was not enough: picking a game
   moves the mode without moving the tier, and that is exactly the transition
   that shipped an agent a submit_answer it could not put images into. */
const surfaceKey = (d) => `${d ? d.mode : 'none'}:${game.tierFor(d)}`;

/* The one number the shell holds that is not in the document. The transmission
   fires on the version that flipped the tier and is dismissed by matching it,
   so a dismissal costs no state field and leaves no event in the journey. */
let transmissionSeen = doc ? loadSeen(doc.mode) : null;

/* Persisted beside the portrait, so a reload after a close does not replay
   the moment. Still not in the document: the journey stays unpolluted. */
function seenKey(mode) { return `${game.storageKeyFor(mode)}.seen`; }
function loadSeen(mode) {
  try { const v = localStorage.getItem(seenKey(mode)); return v === null ? null : Number(v); } catch { return null; }
}
function markSeen() {
  transmissionSeen = doc.version;
  try { localStorage.setItem(seenKey(doc.mode), String(doc.version)); } catch { /* fine */ }
}

/* Which screen the stage is currently showing. The stage scrolls internally, so
   a new screen inherits the last one's scroll offset. Reset when this changes. */
let lastScreen = null;

/* How long the page has been waiting on the agent, in tiers the CSS reads.
   Presentational only: a data attribute on the stage, no document mutation. */
const WAIT_LONG_MS = 20000;
const WAIT_STALLED_MS = 60000;
let waitingSince = null;
let waitTimer = null;

function stampWait() {
  clearTimeout(waitTimer);
  const elapsed = waitingSince === null ? 0 : Date.now() - waitingSince;
  stage.dataset.wait = waitingSince === null ? 'none'
    : elapsed >= WAIT_STALLED_MS ? 'stalled'
    : elapsed >= WAIT_LONG_MS ? 'long'
    : 'short';
  if (waitingSince === null || elapsed >= WAIT_STALLED_MS) return;
  const next = elapsed < WAIT_LONG_MS ? WAIT_LONG_MS - elapsed : WAIT_STALLED_MS - elapsed;
  waitTimer = setTimeout(stampWait, next + 50);
}

/* The clock starts when a round is posed and stops the moment the agent commits,
   so it measures the agent's silence and not the human's deliberation. */
function trackWaiting() {
  const posed = Boolean(doc)
    && game.inSitting(doc)
    && !game.isComplete(doc)
    && doc.rounds[doc.roundIndex].state === 'posed';
  if (!posed) {
    waitingSince = null;
  } else if (waitingSince === null) {
    waitingSince = Date.now();
  }
  stampWait();
}

/* Filled in at deploy time. Empty strings simply drop the link. */
const LINKS = {
  repoUrl: 'https://github.com/1m3r/webmcp-capability-environment',
  videoUrl: ''
};

/* ---- storage: one portrait per game ---------------------------------- */

function readPortrait(mode) {
  try {
    const raw = localStorage.getItem(game.storageKeyFor(mode));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    /* A portrait saved under an older schema is not migrated; it dies. */
    return parsed && parsed.schema === 2 ? parsed : null;
  } catch { return null; }
}

function load() {
  try {
    const active = localStorage.getItem(game.storageKey);
    if (active && game.modes.includes(active)) return readPortrait(active);
  } catch { /* a corrupt or blocked store starts fresh rather than failing */ }
  return null;   // no game chosen: the start screen decides
}

function save() {
  if (!doc) return;
  try {
    localStorage.setItem(game.storageKeyFor(doc.mode), JSON.stringify(doc));
    localStorage.setItem(game.storageKey, doc.mode);
  } catch { /* private mode: the game still plays, it just will not survive a reload */ }
}

/* ---- the boundary the tools write through --------------------------- */

/* Loads one image the way the page will render it — same referrer policy — and
   answers whether it painted. This is the check that turns a broken link into
   a refusal the agent can act on, instead of an empty frame the human finds
   later. Bounded, because a host that never answers is a failure too. */
const IMAGE_TIMEOUT_MS = 8000;
function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve(false), IMAGE_TIMEOUT_MS);
    img.referrerPolicy = 'no-referrer';
    img.onload = () => { clearTimeout(timer); resolve(true); };
    img.onerror = () => { clearTimeout(timer); resolve(false); };
    img.src = url;
  });
}

/* The tools read and write through here, so a tool call and a click land in the
   same place and neither can bypass the reducer. */
const ctx = {
  getDoc: () => doc,
  setDoc: (next) => {
    const surfaceBefore = surfaceKey(doc);
    doc = next;
    save();
    settlePerspective();
    render();
    waits.notify(doc.version);
    if (surfaceKey(doc) !== surfaceBefore) syncTools();
  },
  now: () => Date.now(),
  waits,
  loadImage
};

function dispatch(action) {
  const result = game.reduce(doc, action, Date.now());
  ctx.setDoc(result.doc);
}

/* Perspective reveals on commit: there is no second answer to wait for, so the
   gate that protects one has nothing to protect. Called from setDoc AND from
   boot, because a reload lands on whatever was saved. Runs before render(), so
   the page never paints a card reading `committed` that it is about to open. */
function settlePerspective() {
  if (!doc || !game.isPerspective(doc) || !game.inSitting(doc)) return;
  if (doc.rounds[doc.roundIndex].state !== 'agent_committed') return;
  const revealed = game.reduce(doc, { type: 'reveal' }, Date.now());
  if (revealed.ok) {
    doc = revealed.doc;
    save();
  }
}

function transmissionShowing() {
  return Boolean(doc) && game.justGranted(doc) && transmissionSeen !== doc.version;
}

/* ---- rendering ---------------------------------------------------------- */

function renderLog() {
  const node = el('log');
  if (!doc || doc.log.length === 0) {
    node.innerHTML = `<li class="log__empty">Nothing yet. Anything your agent says
      out loud lands here — it is looking at this page, not at your chat.</li>`;
    return;
  }
  node.innerHTML = doc.log
    .slice(-40)
    .reverse()
    .map((e) => {
      const detail = String(e.detail ?? '');
      const kind = e.outcome === 'refused' ? 'refusal'
        : e.action === 'say' ? 'speech'
        : 'event';
      return `<li class="log__entry log__entry--${e.actor}"
        data-outcome="${e.outcome}" data-kind="${kind}">
        <span class="log__actor">${e.actor}</span>
        <span class="log__action">${e.action}</span>
        <span class="log__detail">${detail.replace(/[<>&]/g, '')}</span>
      </li>`;
    })
    .join('');
}

function renderStatus() {
  document.body.dataset.landing = String(showLanding());
  document.body.dataset.nogame = String(!doc);
  el('s-entry').textContent = found ? found.entry : 'no model context';
  el('s-tools').textContent = `${registration.registered} tools`;
  el('s-tier').textContent = doc ? `level ${doc.level}` : 'no game';
  el('s-version').textContent = doc ? `v${doc.version}` : 'v0';
  el('export').hidden = !doc;
  el('abandon').hidden = !doc || !game.inSitting(doc);
  el('games').hidden = !doc;
  el('forget').hidden = !doc;
}

/* A judge arriving in ordinary Chrome gets the landing screen instead of a
   start screen that leads to a game which cannot take its first turn. */
function showLanding() {
  return !found && !doc && params.get('play') !== '1';
}

function render() {
  if (showLanding()) {
    stage.innerHTML = game.renderLanding(LINKS);
    renderLog();
    renderStatus();
    return;
  }
  if (!doc) {
    stage.innerHTML = game.renderStart({
      entry: found ? found.entry : null,
      tools: registration.registered
    });
    renderLog();
    renderStatus();
    return;
  }
  const screen = transmissionShowing() ? 'transmission'
    : !game.inSitting(doc) ? `between-${doc.history.length}`
    : game.isComplete(doc) ? 'close'
    : `round-${doc.history.length}-${doc.roundIndex}`;

  stage.innerHTML = game.render(doc, { transmissionSeen });
  renderLog();
  renderStatus();

  if (screen !== lastScreen) stage.scrollTop = 0;
  lastScreen = screen;

  trackWaiting();
}

/* ---- human input. None of this exists as a tool. --------------------- */

function chooseGame(mode) {
  doc = readPortrait(mode) || game.createDoc(Date.now(), { mode });
  transmissionSeen = loadSeen(mode);
  lastScreen = null;
  save();
  settlePerspective();
  render();
  waits.notify(doc.version);
  syncTools();
}

stage.addEventListener('click', (event) => {
  const pick = event.target.closest('[data-game]');
  if (pick) { chooseGame(pick.dataset.game); return; }
  if (!doc) return;
  const button = event.target.closest('[data-action]');
  if (!button || button.tagName !== 'BUTTON') return;
  const action = button.dataset.action;
  if (action === 'reveal') dispatch({ type: 'reveal' });
  if (action === 'judge') {
    const correction = stage.querySelector('#correction');
    dispatch({ type: 'judge', verdict: button.dataset.verdict, correction: correction ? correction.value : '' });
  }
  if (action === 'next') dispatch({ type: 'next' });
  if (action === 'open_sitting') dispatch({ type: 'open_sitting', deckId: button.dataset.deck });
  if (action === 'close_sitting') dispatch({ type: 'close_sitting', grant: button.dataset.grant });
  if (action === 'accept_proposal' || action === 'decline_proposal') dispatch({ type: action });
  /* Not a reducer action: dismissing the transmission changes nothing about the
     game, and an event for it would be noise in the run record. */
  if (action === 'dismiss') { markSeen(); render(); }
  if (action === 'export') exportGame();
});

stage.addEventListener('submit', (event) => {
  const form = event.target.closest('form[data-action="human_submit"]');
  if (!form || !doc) return;
  event.preventDefault();
  const input = form.querySelector('#human-answer');
  dispatch({ type: 'human_submit', text: input.value });
  input.value = '';
});

/* Back to the three games. The portrait stays saved; only the pointer clears. */
el('games').addEventListener('click', () => {
  doc = null;
  transmissionSeen = null;
  lastScreen = null;
  waitingSince = null;
  clearTimeout(waitTimer);
  try { localStorage.removeItem(game.storageKey); } catch { /* nothing to clear */ }
  waits.notify(0);   // release any agent waiting on a version that will never come
  render();
  syncTools();
});

/* Abandon throws away the sitting in play and nothing else. */
el('abandon').addEventListener('click', () => {
  if (!doc || !game.inSitting(doc)) return;
  if (!confirm('Abandon this sitting? Its rounds are lost. Everything already closed stays.')) return;
  dispatch({ type: 'abandon_sitting' });
});

/* The only way to lose a portrait, and it asks twice by being an instrument
   control: it is hidden unless ?instrument=on. */
el('forget').addEventListener('click', () => {
  if (!doc) return;
  if (!confirm('Forget this whole portrait — every sitting, every read? There is no undo.')) return;
  const mode = doc.mode;
  doc = null;
  transmissionSeen = null;
  lastScreen = null;
  try {
    localStorage.removeItem(game.storageKeyFor(mode));
    localStorage.removeItem(game.storageKey);
  } catch { /* nothing to clear */ }
  waits.notify(0);
  render();
  syncTools();
});

function exportGame() {
  if (!doc) return;
  for (const file of buildExport(doc, game.renderPortrait)) {
    const url = URL.createObjectURL(new Blob([file.body], { type: file.type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  }
}

el('export').addEventListener('click', exportGame);

/* ---- WebMCP ---------------------------------------------------------- */

async function syncTools() {
  if (!found) return;
  const tools = game.buildTools(ctx);
  const result = await reregister(found.mc, tools, registeredTools);
  registeredTools = tools;
  registration = {
    method: result.method,
    registered: registeredTools.length,
    errors: registration.errors.concat(result.errors)
  };
  renderStatus();
}

async function boot() {
  found = detect();
  settlePerspective();
  render();
  if (!found) {
    renderStatus();
    console.warn('[mirror] no model context — the page is mute to an agent');
    return;
  }
  const tools = game.buildTools(ctx);
  registration = await registerTools(found.mc, tools);
  registeredTools = tools;
  renderStatus();
  console.log(`[mirror] ${registration.registered} tools via ${registration.method} on ${found.entry}`);
  if (registration.errors.length) console.warn('[mirror]', registration.errors);
}

/* A waiter left pending across a teardown is an agent stuck until its timeout. */
addEventListener('pagehide', () => waits.dispose());

boot();
