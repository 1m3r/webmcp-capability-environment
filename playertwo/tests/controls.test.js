/* The missing test class.

   Both of the defects found on 2 September were the same shape: the renderer
   emits a string the reducer must accept, and nothing asserted the round trip.
   Portrait mode shipped unplayable — the button offered `match`, the reducer
   accepted only `landed`, and the round had no legal move left — while
   game.test.js sat there asserting that `match` is refused in portrait mode.
   The suite knew the rule the renderer broke. Nothing connected them.

   So: parse the controls the page actually draws, feed each one back through
   the reducer, and assert none of them is refused. A control the page draws
   must be a move the game accepts. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDoc, reduce, VERDICTS, isComplete } from '../src/games/mirror/game.js';
import { renderRound, renderGame } from '../src/games/mirror/render.js';

const MODES = ['portrait', 'quiz'];

/* Every <button data-action> the round is currently offering, with its verdict
   if it carries one. Deliberately a dumb regex over the rendered string: it
   sees exactly what the browser's click handler in shell.js sees. */
function controlsIn(html) {
  const found = [];
  const re = /<button[^>]*\sdata-action="([^"]+)"([^>]*)>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const verdict = /data-verdict="([^"]+)"/.exec(m[2]);
    found.push({ action: m[1], verdict: verdict ? verdict[1] : undefined });
  }
  return found;
}

/* shell.js maps a data-action to a reducer action. This mirrors it. */
function toAction(control) {
  if (control.action === 'judge') return { type: 'judge', verdict: control.verdict };
  return { type: control.action };
}

/* Walk one whole game, and at every stop assert that each control on offer is
   a move the reducer accepts. */
function walk(mode, onState) {
  let doc = createDoc(0, { mode });
  let guard = 0;
  while (!isComplete(doc) && guard++ < 100) {
    const round = doc.rounds[doc.roundIndex];
    onState(doc);
    if (round.state === 'posed') {
      doc = reduce(doc, { type: 'agent_submit', text: `agent ${doc.roundIndex}` }).doc;
    } else if (round.state === 'agent_committed') {
      doc = reduce(doc, { type: 'human_submit', text: `human ${doc.roundIndex}` }).doc;
    } else if (round.state === 'both_committed') {
      doc = reduce(doc, { type: 'reveal' }).doc;
    } else if (round.state === 'revealed') {
      doc = reduce(doc, { type: 'judge', verdict: VERDICTS[mode][0] }).doc;
    } else if (round.state === 'judged') {
      if (doc.roundIndex + 1 >= doc.rounds.length) break;
      doc = reduce(doc, { type: 'next' }).doc;
    }
  }
  return doc;
}

for (const mode of MODES) {
  test(`${mode}: every control the round offers is a move the reducer accepts`, () => {
    walk(mode, (doc) => {
      const round = doc.rounds[doc.roundIndex];
      for (const control of controlsIn(renderRound(doc))) {
        const result = reduce(doc, toAction(control), 0);
        assert.equal(result.ok, true,
          `${mode} round ${doc.roundIndex + 1} in state ${round.state}: the page offers ` +
          `${control.action}${control.verdict ? `=${control.verdict}` : ''} ` +
          `but the reducer refused it — ${result.message}`);
      }
    });
  });

  test(`${mode}: a revealed round offers exactly this mode's two verdicts`, () => {
    let doc = createDoc(0, { mode });
    doc = reduce(doc, { type: 'agent_submit', text: 'a' }).doc;
    doc = reduce(doc, { type: 'human_submit', text: 'h' }).doc;
    doc = reduce(doc, { type: 'reveal' }).doc;

    const offered = controlsIn(renderRound(doc))
      .filter((c) => c.action === 'judge')
      .map((c) => c.verdict);

    assert.deepEqual(offered, VERDICTS[mode],
      `${mode} must offer ${VERDICTS[mode].join(' and ')}`);
  });

  /* This one drives the game the way a person does: the two answers go in
     through the form and the tool, and every other move is taken by clicking
     whatever button the page is currently drawing. Nothing here knows the
     vocabulary in advance — if the page offers a verdict the reducer will not
     take, the round never leaves `revealed` and the walk runs out of guard.
     That is the deadlock a human hit in the browser, reproduced in Node. */
  test(`${mode}: a whole game is playable by clicking only what the page draws`, () => {
    let doc = createDoc(0, { mode });
    let guard = 0;

    while (!isComplete(doc) && guard++ < 100) {
      const round = doc.rounds[doc.roundIndex];

      if (round.state === 'posed') {
        doc = reduce(doc, { type: 'agent_submit', text: `agent ${doc.roundIndex}` }).doc;
        continue;
      }
      if (round.state === 'agent_committed') {
        doc = reduce(doc, { type: 'human_submit', text: `human ${doc.roundIndex}` }).doc;
        continue;
      }

      /* Everything from here is a click. Take the first control on offer. */
      const [control] = controlsIn(renderRound(doc));
      assert.ok(control,
        `${mode} round ${doc.roundIndex + 1}: the page draws no control in state ` +
        `${round.state} — the game cannot be advanced from here`);

      const result = reduce(doc, toAction(control), 0);
      assert.equal(result.ok, true,
        `${mode} round ${doc.roundIndex + 1}: clicking ${control.action}` +
        `${control.verdict ? `=${control.verdict}` : ''} was refused — ${result.message}`);
      doc = result.doc;
    }

    assert.equal(isComplete(doc), true,
      `${mode} never finished — it stalled at round ${doc.roundIndex + 1} in state ` +
      `${doc.rounds[doc.roundIndex].state}`);
    assert.match(renderGame(doc), /class="results"/);
  });
}

/* The specific regression. Portrait shipped with the quiz vocabulary on its
   buttons, so this is the assertion that would have caught it on day one. */
test('portrait never offers a verdict the reducer reserves for quiz', () => {
  let doc = createDoc(0, { mode: 'portrait' });
  doc = reduce(doc, { type: 'agent_submit', text: 'a' }).doc;
  doc = reduce(doc, { type: 'human_submit', text: 'h' }).doc;
  doc = reduce(doc, { type: 'reveal' }).doc;
  const html = renderRound(doc);
  assert.doesNotMatch(html, /data-verdict="match"/);
  assert.doesNotMatch(html, /data-verdict="miss"/);
});

/* The export is the keepsake, and it reported `0 of 8 judged a match` on every
   portrait run ever played, because it counted a verdict portrait never uses. */
test('the portrait export counts the verdict its mode actually records', async () => {
  const { renderPortrait } = await import('../src/games/mirror/render.js');
  for (const mode of MODES) {
    const doc = walk(mode, () => {});
    const good = VERDICTS[mode][0];
    const md = renderPortrait(doc);
    assert.match(md, new RegExp(`8 of 8 judged ${good}`),
      `${mode}: the export miscounted a game where every round was ${good}`);
  }
});
