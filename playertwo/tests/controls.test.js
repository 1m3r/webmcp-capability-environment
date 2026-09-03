/* A control the page draws must be a move the game accepts.

   Both of the defects found on 2 September were the same shape: the renderer
   emits a string the reducer must accept, and nothing asserted the round trip.
   So: parse the controls the page actually draws, feed each one back through
   the reducer, and assert none of them is refused — across every mode, on
   every screen, from the between screen through a sitting to the close. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDoc, reduce, VERDICTS, isComplete, inSitting, MODES } from '../src/games/mirror/game.js';
import { renderRound, renderGame } from '../src/games/mirror/render.js';
import { four, GOOD } from './helpers.js';

/* Every <button data-action> the screen is currently offering, with its data. */
function controlsIn(html) {
  const found = [];
  const re = /<button[^>]*\sdata-action="([^"]+)"([^>]*)>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attr = (name) => { const hit = new RegExp(`data-${name}="([^"]+)"`).exec(m[2]); return hit ? hit[1] : undefined; };
    found.push({ action: m[1], verdict: attr('verdict'), deck: attr('deck'), grant: attr('grant') });
  }
  return found;
}

/* Controls the PAGE owns rather than the game: no tool, no reducer action. */
const PAGE_ONLY = new Set(['export', 'dismiss', 'games']);

/* shell.js maps a data-action to a reducer action. This mirrors it. */
function toAction(control) {
  if (control.action === 'judge') return { type: 'judge', verdict: control.verdict };
  if (control.action === 'open_sitting') return { type: 'open_sitting', deckId: control.deck };
  if (control.action === 'close_sitting') return { type: 'close_sitting', grant: control.grant };
  return { type: control.action };
}

const humanMove = (mode, round) => round.state === 'agent_committed' && mode !== 'perspective';

/* Drive one sitting by clicking whatever the page draws, feeding the two
   answers in through the tool path and the form. Returns the closed doc. */
function clickThrough(mode, onScreen = () => {}) {
  let doc = createDoc(0, { mode });
  let guard = 0;
  while (guard++ < 200) {
    const html = renderGame(doc, {});
    onScreen(doc, html);
    if (inSitting(doc) && !isComplete(doc)) {
      const round = doc.rounds[doc.roundIndex];
      if (round.state === 'posed') {
        doc = reduce(doc, { type: 'agent_submit', text: `agent ${doc.roundIndex}`, images: four() }).doc;
        continue;
      }
      if (humanMove(mode, round)) {
        doc = reduce(doc, { type: 'human_submit', text: `human ${doc.roundIndex}` }).doc;
        continue;
      }
      if (mode === 'perspective' && round.state === 'agent_committed') {
        doc = reduce(doc, { type: 'reveal' }).doc;   // the shell does this on commit
        continue;
      }
    }
    const [control] = controlsIn(html).filter((c) => !PAGE_ONLY.has(c.action));
    if (!control) break;
    const result = reduce(doc, toAction(control), 0);
    assert.equal(result.ok, true,
      `${mode}: clicking ${control.action}${control.verdict ? `=${control.verdict}` : ''}` +
      `${control.grant ? `=${control.grant}` : ''} was refused — ${result.message}`);
    doc = result.doc;
    if (doc.history.length === 1 && !inSitting(doc)) break;
  }
  return doc;
}

for (const mode of MODES) {
  test(`${mode}: every control on every screen is a move the reducer accepts`, () => {
    clickThrough(mode, (doc, html) => {
      for (const control of controlsIn(html)) {
        if (PAGE_ONLY.has(control.action)) continue;
        const result = reduce(doc, toAction(control), 0);
        assert.equal(result.ok, true,
          `${mode}: the page offers ${control.action}${control.verdict ? `=${control.verdict}` : ''}` +
          `${control.deck ? ` deck=${control.deck}` : ''}${control.grant ? ` grant=${control.grant}` : ''} ` +
          `but the reducer refused it — ${result.message}`);
      }
    });
  });

  test(`${mode}: a whole sitting is playable by clicking only what the page draws, through the close`, () => {
    const seen = new Set();
    const doc = clickThrough(mode, (_, html) => { for (const c of controlsIn(html)) seen.add(c.action); });
    assert.equal(doc.history.length, 1, `${mode}: the sitting never closed`);
    assert.equal(inSitting(doc), false);
    assert.ok(seen.has('open_sitting') && seen.has('judge') && seen.has('next') && seen.has('close_sitting'),
      `${mode}: the sweep should pass through open, judge, next and close — saw ${[...seen].join(', ')}`);
    if (mode !== 'perspective') assert.ok(seen.has('reveal'));
    /* The transmission is on top; the between screen is behind it. */
    const behind = controlsIn(renderGame(doc, { transmissionSeen: doc.version })).map((c) => c.action);
    assert.ok(behind.includes('export'), `${mode}: the between screen should offer the export once there is history`);
    assert.ok(behind.includes('open_sitting'), `${mode}: and the next deck`);
  });

  test(`${mode}: a revealed round offers exactly this mode's two verdicts`, () => {
    let doc = reduce(createDoc(0, { mode }), { type: 'open_sitting', deckId: mode === 'quiz' ? 'daily' : mode === 'both' ? 'voices' : 'first-light' }).doc;
    doc = reduce(doc, { type: 'agent_submit', text: 'a', images: four() }).doc;
    if (mode !== 'perspective') doc = reduce(doc, { type: 'human_submit', text: 'h' }).doc;
    doc = reduce(doc, { type: 'reveal' }).doc;
    const offered = controlsIn(renderRound(doc)).filter((c) => c.action === 'judge').map((c) => c.verdict);
    assert.deepEqual(offered, VERDICTS[mode]);
  });
}

test('the close screen offers exactly the three grants and nothing that moves a round', () => {
  let doc = createDoc(0, { mode: 'both' });
  doc = reduce(doc, { type: 'open_sitting', deckId: 'voices' }).doc;
  while (!isComplete(doc)) {
    const round = doc.rounds[doc.roundIndex];
    if (round.state === 'posed') doc = reduce(doc, { type: 'agent_submit', text: 'a' }).doc;
    else if (round.state === 'agent_committed') doc = reduce(doc, { type: 'human_submit', text: 'h' }).doc;
    else if (round.state === 'both_committed') doc = reduce(doc, { type: 'reveal' }).doc;
    else if (round.state === 'revealed') doc = reduce(doc, { type: 'judge', verdict: GOOD.both }).doc;
    else doc = reduce(doc, { type: 'next' }).doc;
  }
  const controls = controlsIn(renderGame(doc, {}));
  assert.deepEqual(controls.map((c) => c.action), ['close_sitting', 'close_sitting', 'close_sitting']);
  assert.deepEqual(controls.map((c) => c.grant), ['open', 'kept', 'sealed']);
});

test('the transmission offers exactly one control, and the page owns it', () => {
  const doc = clickThrough('both');
  const moment = controlsIn(renderGame(doc, {}));
  assert.deepEqual(moment.map((c) => c.action), ['dismiss']);
});
