/* Sittings, the close, the grant, and the level.

   A sitting is what you play; a portrait is what you keep. The close is the
   most consequential decision in the game — what the agent carries into the
   next sitting — and it is a human click with no tool behind it. These tests
   pin that the sitting boundary behaves, and that the tier moves only there. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDoc, reduce, isComplete, inSitting, tierFor, justGranted, projectForAgent,
  decksAvailable, GRANTS
} from '../src/games/mirror/game.js';

import { open, playOut, close } from './helpers.js';

test('a sitting cannot be opened while one is in play', () => {
  const doc = open(createDoc(0, { mode: 'both' }));
  const r = reduce(doc, { type: 'open_sitting', deckId: 'voices' });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'SITTING_OPEN');
});

test('a finished sitting must be closed before another opens', () => {
  const doc = playOut(open(createDoc(0, { mode: 'both' })));
  const r = reduce(doc, { type: 'open_sitting', deckId: 'voices' });
  assert.equal(r.code, 'SITTING_OPEN');
  assert.match(r.message, /not closed/);
});

test('a deck that does not exist, or is not yet unlocked, is refused by name', () => {
  const doc = createDoc(0, { mode: 'perspective' });
  assert.equal(reduce(doc, { type: 'open_sitting', deckId: 'nope' }).code, 'BAD_DECK');
  const locked = reduce(doc, { type: 'open_sitting', deckId: 'deep-water' });
  assert.equal(locked.code, 'DECK_LOCKED');
  assert.match(locked.message, /level 2/);
});

test('the close is refused until every round is judged, and it counts what is left', () => {
  let doc = open(createDoc(0, { mode: 'both' }));
  const r = reduce(doc, { type: 'close_sitting', grant: 'open' });
  assert.equal(r.code, 'NOT_FINISHED');
  assert.match(r.message, /5 rounds are still open/);
});

test('the grant is one of three words', () => {
  const doc = playOut(open(createDoc(0, { mode: 'both' })));
  const r = reduce(doc, { type: 'close_sitting', grant: 'everything' });
  assert.equal(r.code, 'BAD_GRANT');
  for (const grant of GRANTS) assert.equal(reduce(doc, { type: 'close_sitting', grant }).ok, true);
});

test('closing archives the sitting with its grant, bumps the level, and empties the table', () => {
  const played = playOut(open(createDoc(0, { mode: 'both' })));
  const doc = close(played, 'kept');
  assert.equal(doc.history.length, 1);
  assert.equal(doc.history[0].grant, 'kept');
  assert.equal(doc.history[0].n, 1);
  assert.equal(doc.history[0].title, 'Voices');
  assert.equal(doc.history[0].rounds.length, 5);
  assert.deepEqual(doc.history[0].rounds, played.rounds, 'the rounds move into history untouched');
  assert.equal(doc.level, 2);
  assert.equal(inSitting(doc), false);
  assert.equal(doc.deckId, null);
  assert.equal(doc.log.at(-1).action, 'close_sitting');
  assert.equal(doc.log.at(-1).actor, 'human');
  assert.match(doc.log.at(-1).detail, /kept/);
});

test('the tier is derived from the level and flips exactly at the first close', () => {
  let doc = createDoc(0, { mode: 'both' });
  assert.equal(tierFor(doc), 1);
  doc = playOut(open(doc));
  assert.equal(tierFor(doc), 1, 'finishing a sitting is not closing it');
  doc = close(doc);
  assert.equal(tierFor(doc), 2);
  doc = close(playOut(open(doc, 'weather-gods')));
  assert.equal(doc.level, 3);
  assert.equal(tierFor(doc), 3, 'the third level adds the third verb');
});

test('the transmission fires on a close that adds a verb, and is over once anything else happens', () => {
  let doc = close(playOut(open(createDoc(0, { mode: 'both' }))));
  assert.equal(justGranted(doc), true);
  doc = reduce(doc, { type: 'say', text: 'thank you' }).doc;
  assert.equal(justGranted(doc), false, 'the moment is over once anything else happens');
});

test('the second sitting can open a level-2 deck, and locked decks stay locked', () => {
  const doc = close(playOut(open(createDoc(0, { mode: 'perspective' }))));
  const available = decksAvailable(doc);
  assert.deepEqual(available.map((d) => d.unlocked), [true, true, false]);
  const second = reduce(doc, { type: 'open_sitting', deckId: 'deep-water' });
  assert.equal(second.ok, true, second.message);
  assert.equal(second.doc.rounds[0].questionId, 'water');
});

test('abandoning a sitting keeps the portrait', () => {
  let doc = close(playOut(open(createDoc(0, { mode: 'both' }))));
  doc = open(doc, 'weather-gods');
  doc = reduce(doc, { type: 'agent_submit', text: 'half way' }).doc;
  const r = reduce(doc, { type: 'abandon_sitting' });
  assert.equal(r.ok, true);
  assert.equal(inSitting(r.doc), false);
  assert.equal(r.doc.history.length, 1, 'the closed sitting survives');
  assert.equal(r.doc.level, 2, 'and so does the level');
  assert.equal(reduce(r.doc, { type: 'abandon_sitting' }).code, 'NO_SITTING');
});

test('between sittings the agent is told to wait for the next one', () => {
  const fresh = projectForAgent(createDoc());
  assert.equal(fresh.state, 'between_sittings');
  assert.match(fresh.yourMove, /wait_for_game_update/);
  assert.match(fresh.yourMove, /first sitting/);
  assert.equal(fresh.sittingsClosed, 0);

  const later = projectForAgent(close(playOut(open(createDoc(0, { mode: 'both' })))));
  assert.equal(later.sittingsClosed, 1);
  assert.equal(later.level, 2);
  assert.equal(later.tier, 2);
  assert.match(later.yourMove, /next sitting/);
  assert.ok(!('yourProposal' in later), 'nothing about proposals before level 3');
});

test('inside a sitting the projection names the sitting and the level', () => {
  const p = projectForAgent(open(createDoc(0, { mode: 'both' })));
  assert.equal(p.sitting, 1);
  assert.equal(p.level, 1);
  assert.equal(p.of, 5);
  assert.equal(p.round, 1);
});
