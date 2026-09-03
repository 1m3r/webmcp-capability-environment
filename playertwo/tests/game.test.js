import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDoc, reduce, isComplete, inSitting, MODES } from '../src/games/mirror/game.js';
import {
  decksFor, deckById, deckUnlocked, roundPlan, ROUNDS_PER_SITTING, QUIZ_PASS
} from '../src/games/mirror/questions.js';

/* ---- decks ---------------------------------------------------------------- */

test('every mode has decks of five, and the first is open at level 1', () => {
  for (const mode of MODES) {
    const decks = decksFor(mode);
    assert.ok(decks.length >= 2, `${mode} needs at least two decks so there is a second sitting`);
    assert.equal(decks[0].level, 1, `${mode}: the first deck must be playable on arrival`);
    for (const deck of decks) {
      const expected = mode === 'quiz' ? 6 : ROUNDS_PER_SITTING;
      assert.equal(deck.questions.length, expected, `${mode}/${deck.id} has the wrong length`);
      assert.ok(deck.title && deck.blurb, `${mode}/${deck.id} needs a title and a blurb`);
    }
  }
});

test('decks unlock by level, never by anything else', () => {
  const [first, second] = decksFor('perspective');
  assert.equal(deckUnlocked(first, 1), true);
  assert.equal(deckUnlocked(second, 1), false);
  assert.equal(deckUnlocked(second, 2), true);
  assert.equal(deckUnlocked(null, 9), false);
});

test('a perspective plan is the agent reading the human, with no human answer', () => {
  const plan = roundPlan('perspective', 'first-light');
  assert.equal(plan.length, ROUNDS_PER_SITTING);
  assert.ok(plan.every((r) => r.agentTarget === 'human' && r.humanTarget === null));
  assert.equal(new Set(plan.map((r) => r.questionId)).size, plan.length, 'no question repeats');
});

test('a both-ways plan has each reading the other', () => {
  const plan = roundPlan('both', 'voices');
  assert.ok(plan.every((r) => r.agentTarget === 'human' && r.humanTarget === 'agent'));
});

test('a quiz plan alternates who knows, human first', () => {
  const plan = roundPlan('quiz', 'daily');
  assert.equal(plan[0].agentTarget, 'human', 'round 1 asks about the human, so the agent guesses');
  assert.equal(plan[1].agentTarget, 'agent', 'round 2 asks about the agent, so the agent knows');
  assert.ok(plan.every((r) => r.agentTarget === r.humanTarget), 'in quiz both answer about the same person');
  assert.equal(plan.filter((r) => r.agentTarget === 'human').length, 3);
  assert.ok(QUIZ_PASS <= plan.length);
});

test('an unknown deck throws rather than producing an empty sitting', () => {
  assert.throws(() => roundPlan('perspective', 'nope'), /no perspective deck/);
  assert.equal(deckById('quiz', 'nope'), null);
});

/* ---- the document --------------------------------------------------------- */

test('a new portrait is between sittings, at level 1, with nothing in its history', () => {
  const doc = createDoc();
  assert.equal(doc.mode, 'perspective');
  assert.equal(doc.schema, 2);
  assert.equal(doc.level, 1);
  assert.deepEqual(doc.history, []);
  assert.deepEqual(doc.rounds, []);
  assert.equal(inSitting(doc), false);
  assert.equal(isComplete(doc), false);
  assert.ok(!('tier' in doc), 'tier is derived from level, never stored');
  assert.ok(!('answerAboutAgent' in doc), 'the opt-out is gone — the modes are separate games');
});

test('an unknown mode is refused at creation', () => {
  assert.throws(() => createDoc(0, { mode: 'portrait' }), /no mode named portrait/);
});

function opened(mode = 'both', deckId) {
  const doc = createDoc(0, { mode });
  const id = deckId || decksFor(mode)[0].id;
  const r = reduce(doc, { type: 'open_sitting', deckId: id });
  assert.equal(r.ok, true, r.message);
  return r.doc;
}

test('opening a sitting poses every round of the deck', () => {
  const doc = opened('both');
  assert.equal(doc.rounds.length, ROUNDS_PER_SITTING);
  assert.ok(doc.rounds.every((r) => r.state === 'posed'));
  assert.equal(doc.deckId, 'voices');
  assert.equal(inSitting(doc), true);
  assert.equal(doc.log.at(-1).actor, 'human');
  assert.equal(doc.log.at(-1).action, 'open_sitting');
});

test('the agent commits first and the round advances', () => {
  const r = reduce(opened(), { type: 'agent_submit', text: 'rust' });
  assert.equal(r.ok, true);
  assert.equal(r.doc.rounds[0].state, 'agent_committed');
  assert.equal(r.doc.rounds[0].agentAnswer, 'rust');
});

test('the human cannot answer before the agent has committed', () => {
  const r = reduce(opened(), { type: 'human_submit', text: 'navy' });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'AGENT_HAS_NOT_ANSWERED');
  assert.match(r.message, /answers first/);
});

test('the agent cannot commit twice in one round', () => {
  const one = reduce(opened(), { type: 'agent_submit', text: 'rust' }).doc;
  const r = reduce(one, { type: 'agent_submit', text: 'ochre' });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'ALREADY_COMMITTED');
  assert.equal(r.doc.rounds[0].agentAnswer, 'rust', 'a committed answer is immutable');
});

test('an empty answer is refused', () => {
  const r = reduce(opened(), { type: 'agent_submit', text: '   ' });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'EMPTY_ANSWER');
});

test('a refusal is recorded in the event log, not merely returned', () => {
  const doc = opened();
  const r = reduce(doc, { type: 'human_submit', text: 'navy' });
  const last = r.doc.log.at(-1);
  assert.equal(last.outcome, 'refused');
  assert.equal(last.actor, 'human');
  assert.equal(last.action, 'human_submit');
  assert.equal(r.doc.version, doc.version + 1, 'a refusal still advances the version');
});

test('every refusal message names a cause rather than a state', () => {
  const doc = opened();
  for (const action of [
    { type: 'human_submit', text: 'x' },
    { type: 'reveal' },
    { type: 'judge', verdict: 'landed' },
    { type: 'next' },
    { type: 'close_sitting', grant: 'open' },
    { type: 'open_sitting', deckId: 'voices' }
  ]) {
    const r = reduce(doc, action);
    assert.equal(r.ok, false, `${action.type} should be refused here`);
    assert.match(r.message, /^refused: /);
    assert.ok(r.message.length > 30, `${action.type} refusal is too terse to act on: ${r.message}`);
    assert.doesNotMatch(r.message, /invalid state|bad state|illegal/i);
  }
});

test('between sittings, every move but opening one is refused by name', () => {
  const doc = createDoc(0, { mode: 'both' });
  for (const type of ['agent_submit', 'human_submit', 'reveal', 'judge', 'next', 'close_sitting', 'abandon_sitting']) {
    const r = reduce(doc, { type, text: 'x', verdict: 'landed', grant: 'open' });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'NO_SITTING', `${type} between sittings gave ${r.code}`);
  }
});

test('a round runs posed -> committed -> revealed -> judged -> next', () => {
  let doc = opened();
  doc = reduce(doc, { type: 'agent_submit', text: 'rust' }).doc;
  doc = reduce(doc, { type: 'human_submit', text: 'navy' }).doc;
  assert.equal(doc.rounds[0].state, 'both_committed');
  doc = reduce(doc, { type: 'reveal' }).doc;
  assert.equal(doc.rounds[0].state, 'revealed');
  doc = reduce(doc, { type: 'judge', verdict: 'missed' }).doc;
  assert.equal(doc.rounds[0].verdict, 'missed');
  doc = reduce(doc, { type: 'next' }).doc;
  assert.equal(doc.roundIndex, 1);
  assert.equal(doc.rounds[1].state, 'posed');
});

test('a reveal is refused until both have committed', () => {
  const doc = reduce(opened(), { type: 'agent_submit', text: 'rust' }).doc;
  const r = reduce(doc, { type: 'reveal' });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'NOT_BOTH_COMMITTED');
});

test('verdicts belong to their mode, and the wrong vocabulary is refused', () => {
  let doc = opened('both');
  doc = reduce(doc, { type: 'agent_submit', text: 'a' }).doc;
  doc = reduce(doc, { type: 'human_submit', text: 'b' }).doc;
  doc = reduce(doc, { type: 'reveal' }).doc;
  assert.equal(reduce(doc, { type: 'judge', verdict: 'sort of' }).code, 'BAD_VERDICT');
  assert.equal(reduce(doc, { type: 'judge', verdict: 'landed' }).ok, true);
  const wrong = reduce(doc, { type: 'judge', verdict: 'match' });
  assert.equal(wrong.ok, false);
  assert.equal(wrong.code, 'BAD_VERDICT');
  assert.match(wrong.message, /landed/);
  assert.equal(reduce(doc, { type: 'judge', verdict: 'me' }).ok, false,
    'the perspective vocabulary is not this game’s');
});

test('say is logged and changes nothing else', () => {
  const doc = opened();
  const r = reduce(doc, { type: 'say', text: 'thinking about this one' });
  assert.equal(r.ok, true);
  assert.equal(r.doc.rounds[0].state, 'posed');
  assert.equal(r.doc.log.at(-1).actor, 'agent');
  assert.equal(r.doc.log.at(-1).action, 'say');
});

test('a read is recorded, so the journey shows what the agent reached for', () => {
  const r = reduce(createDoc(), { type: 'read', text: 'get_field_manual' });
  assert.equal(r.ok, true);
  assert.equal(r.doc.log.at(-1).action, 'read');
  assert.equal(r.doc.log.at(-1).actor, 'agent');
  assert.equal(r.doc.log.at(-1).detail, 'get_field_manual');
});

test('the log sequence is dense and increasing', () => {
  let doc = opened();
  doc = reduce(doc, { type: 'agent_submit', text: 'a' }).doc;
  doc = reduce(doc, { type: 'reveal' }).doc;
  doc = reduce(doc, { type: 'human_submit', text: 'h' }).doc;
  assert.deepEqual(doc.log.map((e) => e.seq), [1, 2, 3, 4]);
});

test('isComplete is true only when every round is judged, and next then says to close', () => {
  let doc = opened();
  assert.equal(isComplete(doc), false);
  for (let i = 0; i < doc.rounds.length; i++) {
    doc = reduce(doc, { type: 'agent_submit', text: `a${i}` }).doc;
    doc = reduce(doc, { type: 'human_submit', text: `h${i}` }).doc;
    doc = reduce(doc, { type: 'reveal' }).doc;
    doc = reduce(doc, { type: 'judge', verdict: 'landed' }).doc;
    if (i < doc.rounds.length - 1) doc = reduce(doc, { type: 'next' }).doc;
  }
  assert.equal(isComplete(doc), true);
  const r = reduce(doc, { type: 'next' });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'GAME_OVER');
  assert.match(r.message, /close the sitting/);
});
