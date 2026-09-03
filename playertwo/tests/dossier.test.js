/* The dossier reads granted history and nothing else.

   The property that keeps a perspective honest — no feedback until the sitting
   closes — lives here, in the shape of buildDossier, and these tests are what
   hold it in place. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDoc, reduce } from '../src/games/mirror/game.js';
import { buildDossier } from '../src/games/mirror/dossier.js';
import { manualFor } from '../src/games/mirror/manual.js';
import { open, playOut, close, afterOne, four } from './helpers.js';

test('an empty dossier says so rather than returning nothing', () => {
  const text = buildDossier(createDoc());
  assert.ok(text.length > 0);
  assert.match(text, /no sitting has been closed/i);
});

test('an open sitting carries every read, the response and the correction', () => {
  const text = buildDossier(afterOne('perspective', 'open', ['me', 'not', 'me', 'not', 'me']));
  for (let i = 0; i < 5; i++) {
    assert.ok(text.includes(`agent ${i}`), `read ${i} missing`);
    assert.ok(text.includes(`because ${i}`), `reason ${i} missing`);
    assert.ok(text.includes(`correction ${i}`), `correction ${i} missing`);
  }
  assert.match(text, /that’s me/);
  assert.match(text, /not quite/);
  assert.match(text, /SITTING 1 — First light/);
});

test('a kept sitting carries only the reads that landed', () => {
  const text = buildDossier(afterOne('perspective', 'kept', ['me', 'not', 'me', 'not', 'me']));
  for (const i of [0, 2, 4]) assert.ok(text.includes(`agent ${i}`), `kept read ${i} missing`);
  for (const i of [1, 3]) {
    assert.ok(!text.includes(`agent ${i}`), `read ${i} was not kept and must not be here`);
    assert.ok(!text.includes(`correction ${i}`), `correction ${i} belongs to a read that was not kept`);
  }
  assert.match(text, /only the reads they kept/);
});

test('a sealed sitting contributes its existence and not one answer', () => {
  const text = buildDossier(afterOne('perspective', 'sealed'));
  assert.match(text, /SITTING 1/);
  assert.match(text, /Sealed/);
  for (let i = 0; i < 5; i++) {
    assert.ok(!text.includes(`agent ${i}`), `a sealed read leaked: agent ${i}`);
    assert.ok(!text.includes(`correction ${i}`), `a sealed correction leaked`);
    assert.ok(!text.includes(`because ${i}`), `a sealed reason leaked`);
  }
});

test('both-ways files each column and the verdict', () => {
  const text = buildDossier(afterOne('both', 'open', ['landed', 'missed']));
  assert.ok(text.includes('agent 0') && text.includes('human 0'));
  assert.match(text, /judged a landed/);
  assert.match(text, /judged a missed/);
  assert.match(text, /Your agent, about you/);
  assert.match(text, /You, about your agent/);
});

test('THE LEAK TEST: the sitting in play is never in the dossier, revealed or not', () => {
  let doc = afterOne('perspective', 'open');
  doc = open(doc, 'deep-water');
  doc = reduce(doc, { type: 'agent_submit', text: 'zzliveagentzz', because: 'zzlivewhyzz', images: four('live') }).doc;
  assert.ok(!buildDossier(doc).includes('zzliveagentzz'), 'the dossier leaked a committed read');

  doc = reduce(doc, { type: 'reveal' }).doc;
  assert.ok(!buildDossier(doc).includes('zzliveagentzz'), 'a revealed round of the sitting in play is still feedback the agent must not get');

  doc = reduce(doc, { type: 'judge', verdict: 'not', correction: 'zzlivecorrectionzz' }).doc;
  const judged = buildDossier(doc);
  assert.ok(!judged.includes('zzlivecorrectionzz'), 'the correction is the exact thing that must wait for the close');
  assert.ok(!judged.includes('zzlivewhyzz'));
  assert.ok(!judged.includes('images.example/live'));

  doc = close(playOut(doc), 'open');
  assert.ok(buildDossier(doc).includes('zzlivecorrectionzz'), 'once closed and opened, it belongs there');
});

test('the dossier counts what is open and says the sitting in play is not here', () => {
  let doc = afterOne('both', 'sealed');
  doc = close(playOut(open(doc, 'weather-gods')), 'open');
  const text = buildDossier(doc);
  assert.match(text, /2 sittings closed, 1 open to you/);
  assert.match(text, /sitting in play is not here/);
});

/* ---- the manual ------------------------------------------------------- */

test('the tier 1 manual states the turn order and does not mention the dossier', () => {
  const one = manualFor(1);
  assert.match(one, /answer first/i);
  assert.doesNotMatch(one, /dossier/i,
    'tier 1 must not name a tool the agent does not have — that is an unfulfillable instruction');
});

test('the manual teaches the wait loop rather than leaving the agent to ask', () => {
  const one = manualFor(1);
  assert.match(one, /wait_for_game_update/);
  assert.match(one, /do not ask/i);
  assert.match(one, /timedOut/);
  assert.match(one, /between_sittings/);
});

test('the manual describes the game being played and not the other two', () => {
  const p = manualFor(1, 'perspective');
  assert.match(p, /images/);
  assert.match(p, /because/);
  assert.match(p, /correction/i);
  assert.match(p, /sealed/i);
  assert.doesNotMatch(p, /right answer exists/i);

  const b = manualFor(1, 'both');
  assert.match(b, /about each other/i);
  assert.doesNotMatch(b, /four/);

  const q = manualFor(1, 'quiz');
  assert.match(q, /right answer/i);
  assert.doesNotMatch(q, /images/);
});

test('the tier 2 manual keeps everything from tier 1 and adds the dossier', () => {
  for (const mode of ['perspective', 'both', 'quiz']) {
    const two = manualFor(2, mode);
    assert.ok(two.includes(manualFor(1, mode)), `${mode}: tier 2 must not drop what tier 1 taught`);
    assert.match(two, /get_dossier/);
  }
});

test('the arrival manual names the three games and the wait', () => {
  const none = manualFor(1, null);
  assert.match(none, /Perspective, Both ways or\nQuiz|Perspective, Both ways or Quiz/);
  assert.match(none, /since: 0/);
  assert.doesNotMatch(none, /dossier/i);
});
