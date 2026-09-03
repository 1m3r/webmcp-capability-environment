/* The grant offer and the transmission.

   The design these replace keyed the interstitial on `roundIndex === 3`, which
   meant pressing Next round before granting lost the moment for good — and its
   only proposed mitigation was a line in the runbook. This repository's founding
   result is that prose does not carry authority, so these tests exist to hold
   what a runbook line could not. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDoc, reduce, canGrant, justGranted, DOSSIER_ROUND, toolNamesFor
} from '../src/games/mirror/game.js';
import { renderGame, renderGrant, renderGranted } from '../src/games/mirror/render.js';
import { buildTools } from '../src/games/mirror/tools.js';

/* Play `n` rounds to judged, leaving the game on the last of them. */
function playTo(n, mode = 'portrait') {
  let doc = createDoc(0, { mode });
  for (let i = 0; i < n; i++) {
    if (i > 0) doc = reduce(doc, { type: 'next' }).doc;
    doc = reduce(doc, { type: 'agent_submit', text: `agent ${i}` }).doc;
    doc = reduce(doc, { type: 'human_submit', text: `human ${i}` }).doc;
    doc = reduce(doc, { type: 'reveal' }).doc;
    doc = reduce(doc, { type: 'judge', verdict: 'landed' }).doc;
  }
  return doc;
}

test('the offer appears only once the dossier is earned', () => {
  assert.equal(canGrant(playTo(DOSSIER_ROUND - 1)), false);
  assert.equal(canGrant(playTo(DOSSIER_ROUND)), true);
});

test('the offer renders BESIDE round 4, not instead of it', () => {
  const doc = playTo(DOSSIER_ROUND);
  const html = renderGame(doc);

  assert.match(html, /class="grant"/, 'the offer should be on screen');
  assert.match(html, /class="round"/, 'round 4 must still be rendered');
  assert.ok(html.includes('agent 3'), "round 4's revealed answer must stay visible");
  assert.ok(html.includes('human 3'), "round 4's revealed answer must stay visible");
  assert.match(html, /data-action="next"/, 'declining by moving on must stay possible');
});

test('declining the grant is possible and the game plays on', () => {
  let doc = playTo(DOSSIER_ROUND);
  doc = reduce(doc, { type: 'next' }).doc;
  assert.equal(doc.tier, 1, 'the tier must not be granted by advancing');
  assert.equal(canGrant(doc), true, 'and the dossier stays available later');
});

/* R3, the whole point. */
test('the transmission fires on a grant taken LATE, not just at round 4', () => {
  let doc = playTo(DOSSIER_ROUND);
  doc = reduce(doc, { type: 'next' }).doc;            // skipped the offer
  doc = reduce(doc, { type: 'agent_submit', text: 'agent 4' }).doc;
  doc = reduce(doc, { type: 'human_submit', text: 'human 4' }).doc;
  assert.equal(justGranted(doc), false);

  doc = reduce(doc, { type: 'grant_tier' }).doc;      // sidebar, mid-round 5
  assert.equal(justGranted(doc), true, 'a late grant must still be a moment');
  assert.match(renderGame(doc), /class="transmission"/);
});

test('the transmission clears when the shell marks it seen', () => {
  let doc = playTo(DOSSIER_ROUND);
  doc = reduce(doc, { type: 'grant_tier' }).doc;

  assert.match(renderGame(doc), /class="transmission"/);
  assert.doesNotMatch(renderGame(doc, { transmissionSeen: doc.version }), /class="transmission"/,
    'dismissing must return the stage to the round');
  assert.match(renderGame(doc, { transmissionSeen: doc.version }), /class="round"/);
});

test('a dismissal from an earlier grant cannot swallow a later one', () => {
  let doc = playTo(DOSSIER_ROUND);
  doc = reduce(doc, { type: 'grant_tier' }).doc;
  const seen = doc.version;

  /* Anything that happens after the dismissal moves the version on, so the
     stale `seen` can never match again. */
  doc = reduce(doc, { type: 'say', text: 'thank you' }).doc;
  assert.equal(justGranted(doc), false, 'the moment is over once anything else happens');
  assert.doesNotMatch(renderGame(doc, { transmissionSeen: seen }), /class="transmission"/);
});

test('the transmission names the verb that was actually added', () => {
  let doc = playTo(DOSSIER_ROUND);
  doc = reduce(doc, { type: 'grant_tier' }).doc;
  const html = renderGranted(doc);

  const before = toolNamesFor(doc.mode, 1);
  const added = toolNamesFor(doc.mode, 2).filter((n) => !before.includes(n));
  assert.deepEqual(added, ['get_dossier']);
  assert.match(html, /get_dossier/);
  assert.match(html, new RegExp(`${before.length} tools`));
  assert.match(html, new RegExp(`${toolNamesFor(doc.mode, 2).length} tools`));
  for (const name of toolNamesFor(doc.mode, 2)) {
    assert.ok(html.includes(name), `the body should show ${name}`);
  }
});

/* The transmission claims a tool count. If it ever disagrees with what the page
   actually registers, it is a lie told at display scale. */
test('the count the transmission claims is the count that gets registered', () => {
  for (const tier of [1, 2]) {
    let doc = playTo(DOSSIER_ROUND);
    if (tier === 2) doc = reduce(doc, { type: 'grant_tier' }).doc;
    const ctx = { getDoc: () => doc, setDoc: () => {}, now: () => 0 };
    const names = buildTools(ctx).map((t) => t.name);
    assert.deepEqual(names, toolNamesFor(doc.mode, tier),
      `tier ${tier}: the transmission would name a body the page does not build`);
  }
});

test('the grant offer names the round it follows', () => {
  const html = renderGrant(playTo(DOSSIER_ROUND));
  assert.match(html, new RegExp(`round ${DOSSIER_ROUND} is judged`));
  assert.match(html, /data-action="grant"/);
});

test('the transmission spends neither load-bearing colour', () => {
  let doc = playTo(DOSSIER_ROUND);
  doc = reduce(doc, { type: 'grant_tier' }).doc;
  const html = renderGranted(doc) + renderGrant(playTo(DOSSIER_ROUND));
  assert.doesNotMatch(html, /--signal|--reveal/,
    'cyan means committed and amber means revealed; the grant is neither');
});

/* The offer is a moment, not a panel that follows you around. canGrant stays
   true for the rest of the game — the sidebar button is the later fallback —
   but the stage makes the offer once. */
test('the offer does not follow you into later rounds', () => {
  let doc = playTo(DOSSIER_ROUND);
  assert.match(renderGame(doc), /class="grant"/);

  doc = reduce(doc, { type: 'next' }).doc;
  doc = reduce(doc, { type: 'agent_submit', text: 'agent 4' }).doc;

  assert.equal(canGrant(doc), true, 'the dossier is still available from the sidebar');
  assert.doesNotMatch(renderGame(doc), /class="grant"/,
    'but the stage must not nag about it under every subsequent round');
});
