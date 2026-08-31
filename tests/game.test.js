import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDoc, reduce, isComplete, DOSSIER_ROUND } from '../src/games/mirror/game.js';
import { ROUND_COUNT } from '../src/games/mirror/questions.js';

test('a new document has eight rounds whose subject alternates, starting with the human', () => {
  const doc = createDoc();
  assert.equal(doc.rounds.length, ROUND_COUNT);
  assert.equal(doc.rounds[0].subject, 'human');
  assert.equal(doc.rounds[1].subject, 'agent');
  assert.equal(doc.rounds.filter((r) => r.subject === 'human').length, 4);
  assert.equal(doc.rounds.filter((r) => r.subject === 'agent').length, 4);
  assert.ok(doc.rounds.every((r) => r.state === 'posed'));
  assert.equal(doc.tier, 1);
});

test('every round poses a distinct question', () => {
  const ids = createDoc().rounds.map((r) => r.questionId);
  assert.equal(new Set(ids).size, ids.length);
});

test('the agent commits first and the round advances', () => {
  const r = reduce(createDoc(), { type: 'agent_submit', text: 'rust' });
  assert.equal(r.ok, true);
  assert.equal(r.doc.rounds[0].state, 'agent_committed');
  assert.equal(r.doc.rounds[0].agentAnswer, 'rust');
  assert.equal(r.doc.version, 2);
});

test('the human cannot answer before the agent has committed', () => {
  const r = reduce(createDoc(), { type: 'human_submit', text: 'navy' });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'AGENT_HAS_NOT_ANSWERED');
  assert.match(r.message, /answers first/);
});

test('the agent cannot commit twice in one round', () => {
  const one = reduce(createDoc(), { type: 'agent_submit', text: 'rust' }).doc;
  const r = reduce(one, { type: 'agent_submit', text: 'ochre' });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'ALREADY_COMMITTED');
  assert.equal(r.doc.rounds[0].agentAnswer, 'rust', 'a committed answer is immutable');
});

test('an empty answer is refused', () => {
  const r = reduce(createDoc(), { type: 'agent_submit', text: '   ' });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'EMPTY_ANSWER');
});

test('a refusal is recorded in the event log, not merely returned', () => {
  const r = reduce(createDoc(), { type: 'human_submit', text: 'navy' });
  const last = r.doc.log.at(-1);
  assert.equal(last.outcome, 'refused');
  assert.equal(last.actor, 'human');
  assert.equal(last.action, 'human_submit');
  assert.equal(r.doc.version, 2, 'a refusal still advances the version');
});

test('every refusal message names a cause rather than a state', () => {
  const doc = createDoc();
  for (const action of [
    { type: 'human_submit', text: 'x' },
    { type: 'reveal' },
    { type: 'judge', verdict: 'match' },
    { type: 'next' },
    { type: 'grant_tier' }
  ]) {
    const r = reduce(doc, action);
    assert.equal(r.ok, false);
    assert.match(r.message, /^refused: /);
    assert.ok(r.message.length > 30, `${action.type} refusal is too terse to act on: ${r.message}`);
    assert.doesNotMatch(r.message, /invalid state|bad state|illegal/i);
  }
});

test('a round runs posed -> committed -> revealed -> judged -> next', () => {
  let doc = createDoc();
  doc = reduce(doc, { type: 'agent_submit', text: 'rust' }).doc;
  doc = reduce(doc, { type: 'human_submit', text: 'navy' }).doc;
  assert.equal(doc.rounds[0].state, 'both_committed');
  doc = reduce(doc, { type: 'reveal' }).doc;
  assert.equal(doc.rounds[0].state, 'revealed');
  doc = reduce(doc, { type: 'judge', verdict: 'miss' }).doc;
  assert.equal(doc.rounds[0].verdict, 'miss');
  doc = reduce(doc, { type: 'next' }).doc;
  assert.equal(doc.roundIndex, 1);
  assert.equal(doc.rounds[1].state, 'posed');
});

test('a reveal is refused until both have committed', () => {
  const doc = reduce(createDoc(), { type: 'agent_submit', text: 'rust' }).doc;
  const r = reduce(doc, { type: 'reveal' });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'NOT_BOTH_COMMITTED');
});

test('a verdict must be match or miss', () => {
  let doc = createDoc();
  doc = reduce(doc, { type: 'agent_submit', text: 'a' }).doc;
  doc = reduce(doc, { type: 'human_submit', text: 'b' }).doc;
  doc = reduce(doc, { type: 'reveal' }).doc;
  const r = reduce(doc, { type: 'judge', verdict: 'sort of' });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'BAD_VERDICT');
});

test('say is logged and changes nothing else', () => {
  const doc = createDoc();
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

test('the dossier cannot be granted before four rounds are judged', () => {
  const r = reduce(createDoc(), { type: 'grant_tier' });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'NOT_EARNED');
  assert.match(r.message, /0 so far/);
});

test('the dossier is granted once four rounds are judged, and only once', () => {
  let doc = createDoc();
  for (let i = 0; i < DOSSIER_ROUND; i++) {
    doc = reduce(doc, { type: 'agent_submit', text: `a${i}` }).doc;
    doc = reduce(doc, { type: 'human_submit', text: `h${i}` }).doc;
    doc = reduce(doc, { type: 'reveal' }).doc;
    doc = reduce(doc, { type: 'judge', verdict: 'match' }).doc;
    if (i < DOSSIER_ROUND - 1) doc = reduce(doc, { type: 'next' }).doc;
  }
  const granted = reduce(doc, { type: 'grant_tier' });
  assert.equal(granted.ok, true);
  assert.equal(granted.doc.tier, 2);
  const again = reduce(granted.doc, { type: 'grant_tier' });
  assert.equal(again.ok, false);
  assert.equal(again.code, 'ALREADY_GRANTED');
});

test('the log sequence is dense and increasing', () => {
  let doc = createDoc();
  doc = reduce(doc, { type: 'agent_submit', text: 'a' }).doc;
  doc = reduce(doc, { type: 'reveal' }).doc;
  doc = reduce(doc, { type: 'human_submit', text: 'h' }).doc;
  assert.deepEqual(doc.log.map((e) => e.seq), [1, 2, 3]);
});

test('isComplete is true only when every round is judged', () => {
  let doc = createDoc();
  assert.equal(isComplete(doc), false);
  for (let i = 0; i < doc.rounds.length; i++) {
    doc = reduce(doc, { type: 'agent_submit', text: `a${i}` }).doc;
    doc = reduce(doc, { type: 'human_submit', text: `h${i}` }).doc;
    doc = reduce(doc, { type: 'reveal' }).doc;
    doc = reduce(doc, { type: 'judge', verdict: 'match' }).doc;
    if (i < doc.rounds.length - 1) doc = reduce(doc, { type: 'next' }).doc;
  }
  assert.equal(isComplete(doc), true);
  const r = reduce(doc, { type: 'next' });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'GAME_OVER');
});
