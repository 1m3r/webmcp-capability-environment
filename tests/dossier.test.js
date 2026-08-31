import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDoc, reduce } from '../src/games/mirror/game.js';
import { buildDossier } from '../src/games/mirror/dossier.js';
import { manualFor } from '../src/games/mirror/manual.js';

function playRounds(count, answers = (i) => ({ agent: `agent${i}`, human: `human${i}` })) {
  let doc = createDoc();
  for (let i = 0; i < count; i++) {
    const a = answers(i);
    doc = reduce(doc, { type: 'agent_submit', text: a.agent }).doc;
    doc = reduce(doc, { type: 'human_submit', text: a.human }).doc;
    doc = reduce(doc, { type: 'reveal' }).doc;
    doc = reduce(doc, { type: 'judge', verdict: i % 2 === 0 ? 'landed' : 'missed' }).doc;
    doc = reduce(doc, { type: 'next' }).doc;
  }
  return doc;
}

test('an empty dossier says so rather than returning nothing', () => {
  const text = buildDossier(createDoc());
  assert.ok(text.length > 0);
  assert.match(text, /nothing/i);
});

test('the dossier carries every judged round, both columns and the verdict', () => {
  const doc = playRounds(4);
  const text = buildDossier(doc);
  for (let i = 0; i < 4; i++) {
    assert.ok(text.includes(`agent${i}`), `round ${i} agent answer missing`);
    assert.ok(text.includes(`human${i}`), `round ${i} human answer missing`);
  }
  assert.match(text, /landed/);
  assert.match(text, /missed/);
});

test('the dossier separates what was learned about each side', () => {
  const text = buildDossier(playRounds(4));
  assert.match(text, /About your teammate/i);
  assert.match(text, /About you/i);
});

test('in portrait, each round files the agent read under the human and vice versa', () => {
  const text = buildDossier(playRounds(2));
  const teammate = text.slice(text.indexOf('About your teammate'), text.indexOf('About you (the agent)'));
  assert.ok(teammate.includes('agent0'), "the agent's read of the human belongs under the human");
  assert.ok(!teammate.includes('human0'), "the human's read of the agent does not");
});

test('the dossier reports the running match rate', () => {
  const text = buildDossier(playRounds(4));
  assert.match(text, /2 of 4/);
});

test('THE LEAK TEST: the dossier never carries the round in play', () => {
  let doc = playRounds(4);
  doc = reduce(doc, { type: 'agent_submit', text: 'zzliveagentzz' }).doc;
  const afterAgent = buildDossier(doc);
  assert.ok(!afterAgent.includes('zzliveagentzz'),
    'the dossier leaked the live round — it is a second reveal channel and must respect the same rule');

  doc = reduce(doc, { type: 'human_submit', text: 'zzlivehumanzz' }).doc;
  const afterBoth = buildDossier(doc);
  assert.ok(!afterBoth.includes('zzlivehumanzz'));
  assert.ok(!afterBoth.includes('zzliveagentzz'));

  doc = reduce(doc, { type: 'reveal' }).doc;
  assert.ok(buildDossier(doc).includes('zzliveagentzz'), 'once revealed it belongs in the dossier');
});

test('the tier 1 manual states the turn order and does not mention the dossier', () => {
  const one = manualFor(1);
  assert.match(one, /answer first/i);
  assert.doesNotMatch(one, /dossier/i,
    'tier 1 must not name a tool the agent does not have — that is an unfulfillable instruction');
});

test('the manual teaches the wait loop rather than leaving the agent to ask', () => {
  const one = manualFor(1);
  assert.match(one, /wait_for_game_update/);
  assert.match(one, /do not ask/i, 'the manual must tell the agent not to wait to be told');
  assert.match(one, /timedOut/, 'and what to do when the wait comes back empty');
});

test('the manual describes the mode being played and not the other one', () => {
  assert.match(manualFor(1, 'portrait'), /about each other/i);
  assert.doesNotMatch(manualFor(1, 'portrait'), /right answer exists/i);
  assert.match(manualFor(1, 'quiz'), /right answer/i);
});

test('the tier 2 manual keeps everything from tier 1 and adds the dossier', () => {
  const two = manualFor(2);
  assert.ok(two.includes(manualFor(1)), 'tier 2 must not drop what tier 1 taught');
  assert.match(two, /get_dossier/);
});
