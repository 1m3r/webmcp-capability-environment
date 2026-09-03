/* Watch mode — portrait with the opt-out off.

   From the first live run: "the portrait mode still carry the missed/landed, and
   still considering a second player input even when only agent is answering. i
   would rather that in that mode the user just watch his agent execute answering
   question after question until the end."

   With no second answer there is nothing to compare, nothing to keep secret and
   nothing to judge, so the round stops being a hand of a game and becomes a
   reading. These tests pin that it stays one. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDoc, reduce, isWatching, projectForAgent, canGrant, DOSSIER_ROUND, isComplete
} from '../src/games/mirror/game.js';
import { renderRound, renderResults, renderPortrait } from '../src/games/mirror/render.js';
import { buildDossier } from '../src/games/mirror/dossier.js';

const watched = () => createDoc(0, { mode: 'portrait', answerAboutAgent: false });

/* One round, exactly as the page drives it: the agent commits, and the page
   reveals — which in watch mode lands straight on judged. */
function readOne(doc, text) {
  doc = reduce(doc, { type: 'agent_submit', text }).doc;
  return reduce(doc, { type: 'reveal' }).doc;
}

function readAll(n = 8) {
  let doc = watched();
  for (let i = 0; i < n; i++) {
    if (i > 0) doc = reduce(doc, { type: 'next' }).doc;
    doc = readOne(doc, `reading ${i}`);
  }
  return doc;
}

test('watching is portrait with the opt-out off, and nothing else is', () => {
  assert.equal(isWatching(watched()), true);
  assert.equal(isWatching(createDoc(0, { mode: 'portrait' })), false);
  assert.equal(isWatching(createDoc(0, { mode: 'quiz', answerAboutAgent: false })), false,
    'quiz always needs both answers, so it can never be a watch');
});

/* ---- no second player ---------------------------------------------------- */

test('the page never asks the human to answer', () => {
  const html = renderRound(watched());
  assert.doesNotMatch(html, /id="human-answer"/,
    'there must be no input at all, not a disabled one');
  assert.doesNotMatch(html, /data-action="human_submit"/);
  assert.match(html, /round__excused/);
});

test('the human input is refused by the reducer as well as absent from the page', () => {
  const doc = reduce(watched(), { type: 'agent_submit', text: 'a kettle' }).doc;
  const refused = reduce(doc, { type: 'human_submit', text: 'anything' });
  assert.equal(refused.ok, false);
  assert.equal(refused.code, 'EXCUSED');
});

/* ---- no verdict ---------------------------------------------------------- */

test('a revealed reading is judged with no verdict', () => {
  const doc = readOne(watched(), 'a lighthouse');
  assert.equal(doc.rounds[0].state, 'judged');
  assert.equal(doc.rounds[0].verdict, null);
});

test('the page draws no Reveal and no verdict buttons', () => {
  let doc = reduce(watched(), { type: 'agent_submit', text: 'a kettle' }).doc;
  assert.doesNotMatch(renderRound(doc), /data-action="reveal"/,
    'the page reveals itself; a button for it is ceremony');

  doc = reduce(doc, { type: 'reveal' }).doc;
  const html = renderRound(doc);
  assert.doesNotMatch(html, /data-action="judge"/,
    'a verdict compares two answers and there is only one');
  assert.doesNotMatch(html, /Landed|Missed/);
});

test('the results screen reports readings, not a score', () => {
  const html = renderResults(readAll());
  assert.doesNotMatch(html, /0 of 8/, 'eight unjudged readings are not eight misses');
  assert.doesNotMatch(html, /landed|missed/i);
  assert.match(html, /8 readings/);
  assert.match(html, /What your agent made of you/);
});

test('the keepsake says it was a watch rather than reporting a rate', () => {
  const md = renderPortrait(readAll());
  assert.doesNotMatch(md, /0 of 8/);
  assert.match(md, /8 readings/);
  assert.match(md, /not a game/);
  assert.doesNotMatch(md, /verdict:/);
});

test('the dossier reports what was said rather than a hit rate', () => {
  let doc = readAll(4);
  const text = buildDossier(doc);
  assert.doesNotMatch(text, /0 of 4/);
  assert.match(text, /4 rounds read so far/);
  assert.ok(text.includes('reading 0'), 'it still carries the readings themselves');
});

/* ---- the page turns its own rounds --------------------------------------- */

test('a whole watched game completes with no verdict anywhere', () => {
  const doc = readAll();
  assert.equal(isComplete(doc), true,
    'isComplete must not require verdicts, or a watch could never end');
  assert.ok(doc.rounds.every((r) => r.verdict === null));
});

/* The one human decision left, and the reason the shell stops advancing. */
test('the dossier still unlocks at round four, on readings alone', () => {
  const doc = readAll(DOSSIER_ROUND);
  assert.equal(canGrant(doc), true,
    'the grant is the only authority the human keeps in this mode');
  const granted = reduce(doc, { type: 'grant_tier' });
  assert.equal(granted.ok, true);
  assert.equal(granted.doc.tier, 2);
});

test('the agent is told its teammate is reading, not writing', () => {
  const doc = reduce(watched(), { type: 'agent_submit', text: 'a kettle' }).doc;
  /* The reducer has not revealed yet — that is the shell's move — so this is the
     state the agent sees in the instant between. */
  assert.match(projectForAgent(doc).yourMove, /reading your answer/);

  const playing = reduce(
    reduce(createDoc(0, { mode: 'portrait' }), { type: 'agent_submit', text: 'x' }).doc,
    { type: 'read', text: 'get_round' }
  ).doc;
  assert.match(projectForAgent(playing).yourMove, /writing theirs/);
});

test('the projection reports no teammate answer to expect', () => {
  const p = projectForAgent(watched());
  assert.equal(p.teammateAnswersAbout, null);
});

/* Found live: the page auto-revealed a watched round and painted the word
   "null" in amber where the human's answer would have been. The reveal used to
   be a human click on a card nobody looked at twice, so it shipped unseen. */
test('a missing answer is never rendered as the word null', () => {
  const doc = readOne(watched(), 'a lighthouse');
  const html = renderRound(doc);
  assert.ok(!html.includes('>null<'), 'the word null reached the page');
  assert.doesNotMatch(html, /class="answer">null/);
  assert.match(html, /a lighthouse/);
});

test('watching draws one card, because there is one answer', () => {
  const html = renderRound(readOne(watched(), 'a lighthouse'));
  assert.doesNotMatch(html, /card--human/,
    'a second card with nothing in it is an empty seat at the table');
  assert.match(html, /card--agent/);
  assert.match(html, /data-single="true"/);
});

test('a two-sided portrait still draws both cards', () => {
  let doc = createDoc(0, { mode: 'portrait' });
  doc = reduce(doc, { type: 'agent_submit', text: 'mine' }).doc;
  const html = renderRound(doc);
  assert.match(html, /card--agent/);
  assert.match(html, /card--human/);
  assert.match(html, /data-single="false"/);
});

test('the results screen omits the absent answer rather than emptying a row', () => {
  const html = renderResults(readAll(2));
  assert.ok(!html.includes('>null<'));
  assert.doesNotMatch(html, /You, about your agent/,
    'there is no human answer in a watched game, so there is no label for one');
});
