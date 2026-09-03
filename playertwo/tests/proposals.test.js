/* Level 3: the agent may propose a question; only a human click asks it.

   The same pattern as the probe's request_rule_change: the agent puts a thing
   on the table, and nothing it can call moves it off. An accepted question is
   appended to the next sitting the human opens. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDoc, reduce, tierFor, pendingProposal, acceptedProposal, projectForAgent, justGranted
} from '../src/games/mirror/game.js';
import { buildTools } from '../src/games/mirror/tools.js';
import { renderBetween, renderRound, renderGranted } from '../src/games/mirror/render.js';
import { manualFor } from '../src/games/mirror/manual.js';
import { createWaitRegistry } from '../src/waiters.js';
import { open, playOut, close, afterOne } from './helpers.js';

/* A portrait with n sittings closed. */
function atLevel(level, mode = 'both') {
  let doc = createDoc(0, { mode });
  const decks = { both: ['voices', 'weather-gods'], perspective: ['first-light', 'deep-water', 'the-dark'], quiz: ['daily', 'habits'] }[mode];
  for (let i = 1; i < level; i++) {
    doc = close(playOut(open(doc, decks[Math.min(i - 1, decks.length - 1)])), 'open');
  }
  assert.equal(doc.level, level);
  return doc;
}

test('the tier climbs one verb per close up to four, and the transmission fires each time', () => {
  let doc = createDoc(0, { mode: 'both' });
  const seen = [];
  for (let i = 0; i < 5; i++) {
    doc = close(playOut(open(doc, i % 2 ? 'weather-gods' : 'voices')));
    seen.push([doc.level, tierFor(doc), justGranted(doc)]);
  }
  assert.deepEqual(seen, [[2, 2, true], [3, 3, true], [4, 4, true], [5, 4, false], [6, 4, false]]);
});

test('proposing is refused below level 3, by name', () => {
  const r = reduce(afterOne('both'), { type: 'propose', text: 'What song is this person?' });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'NOT_YET');
  assert.match(r.message, /level 3/);
});

test('at level 3 the agent may propose one question, and only one at a time', () => {
  const doc = atLevel(3);
  const first = reduce(doc, { type: 'propose', text: 'What song is this person?' });
  assert.equal(first.ok, true, first.message);
  assert.equal(pendingProposal(first.doc).text, 'What song is this person?');
  assert.equal(first.doc.log.at(-1).actor, 'agent');

  const second = reduce(first.doc, { type: 'propose', text: 'Another' });
  assert.equal(second.code, 'ONE_AT_A_TIME');
  assert.equal(reduce(doc, { type: 'propose', text: '  ' }).code, 'EMPTY_PROPOSAL');
});

test('accepting or declining is a human move, and there is nothing to answer without a proposal', () => {
  const doc = atLevel(3);
  assert.equal(reduce(doc, { type: 'accept_proposal' }).code, 'NO_PROPOSAL');
  const proposed = reduce(doc, { type: 'propose', text: 'What song is this person?' }).doc;

  const declined = reduce(proposed, { type: 'decline_proposal' });
  assert.equal(declined.ok, true);
  assert.equal(pendingProposal(declined.doc), null);
  assert.equal(acceptedProposal(declined.doc), null);
  assert.equal(declined.doc.log.at(-1).actor, 'human');

  const accepted = reduce(proposed, { type: 'accept_proposal' });
  assert.equal(accepted.ok, true);
  assert.equal(acceptedProposal(accepted.doc).text, 'What song is this person?');
});

test('an accepted question becomes the last round of the next sitting, once', () => {
  let doc = atLevel(3, 'perspective');
  doc = reduce(doc, { type: 'propose', text: 'What song is this person?' }).doc;
  doc = reduce(doc, { type: 'accept_proposal' }).doc;
  doc = open(doc, 'first-light');
  assert.equal(doc.rounds.length, 6);
  const last = doc.rounds[5];
  assert.equal(last.question, 'What song is this person?');
  assert.equal(last.proposed, true);
  assert.equal(last.agentTarget, 'human');
  assert.equal(last.humanTarget, null);
  assert.match(doc.log.at(-1).detail, /agent’s question/);
  assert.equal(acceptedProposal(doc), null, 'used once');

  doc = close(playOut(doc), 'open');
  doc = open(doc, 'deep-water');
  assert.equal(doc.rounds.length, 5, 'the next sitting does not carry it again');
});

test('in both-ways the proposed round has both targets, and in quiz the human knows', () => {
  let both = reduce(atLevel(3, 'both'), { type: 'propose', text: 'Q?' }).doc;
  both = open(reduce(both, { type: 'accept_proposal' }).doc);
  assert.deepEqual([both.rounds[5].agentTarget, both.rounds[5].humanTarget], ['human', 'agent']);

  let quiz = reduce(atLevel(3, 'quiz'), { type: 'propose', text: 'Q?' }).doc;
  quiz = open(reduce(quiz, { type: 'accept_proposal' }).doc);
  assert.deepEqual([quiz.rounds[6].agentTarget, quiz.rounds[6].humanTarget], ['human', 'human']);
});

test('the between screen offers the two answers to a pending proposal, and nothing otherwise', () => {
  const doc = atLevel(3);
  assert.doesNotMatch(renderBetween(doc), /data-action="accept_proposal"/);
  const proposed = reduce(doc, { type: 'propose', text: 'What <song> is this person?' }).doc;
  const html = renderBetween(proposed);
  assert.match(html, /data-action="accept_proposal"/);
  assert.match(html, /data-action="decline_proposal"/);
  assert.ok(html.includes('What &lt;song&gt; is this person?'), 'escaped');
  const accepted = reduce(proposed, { type: 'accept_proposal' }).doc;
  assert.doesNotMatch(renderBetween(accepted), /data-action="accept_proposal"/);
  assert.match(renderBetween(accepted), /ends on your agent’s question/);
});

test('the round screen marks a proposed question as the agent’s own', () => {
  let doc = reduce(atLevel(3), { type: 'propose', text: 'Q?' }).doc;
  doc = open(reduce(doc, { type: 'accept_proposal' }).doc);
  for (let i = 0; i < 5; i++) {
    doc = reduce(doc, { type: 'agent_submit', text: 'a' }).doc;
    doc = reduce(doc, { type: 'human_submit', text: 'h' }).doc;
    doc = reduce(doc, { type: 'reveal' }).doc;
    doc = reduce(doc, { type: 'judge', verdict: 'landed' }).doc;
    doc = reduce(doc, { type: 'next' }).doc;
  }
  assert.match(renderRound(doc), /its own question/);
});

test('the projection tells the agent where its proposal stands, from level 3 only', () => {
  assert.ok(!('yourProposal' in projectForAgent(afterOne('both'))));
  const doc = atLevel(3);
  assert.match(projectForAgent(doc).yourProposal, /none/);
  const proposed = reduce(doc, { type: 'propose', text: 'Q?' }).doc;
  assert.match(projectForAgent(proposed).yourProposal, /pending/);
  const accepted = reduce(proposed, { type: 'accept_proposal' }).doc;
  assert.match(projectForAgent(accepted).yourProposal, /accepted/);
  assert.match(projectForAgent(open(accepted)).yourProposal, /none/);
});

test('the surface grows to seven and then eight, and the transmission names each verb', () => {
  const ctx = (doc) => ({ getDoc: () => doc, setDoc: () => {}, now: () => 0, waits: createWaitRegistry() });
  const three = atLevel(3);
  assert.deepEqual(buildTools(ctx(three)).map((t) => t.name).slice(5), ['get_dossier', 'propose_question']);
  assert.match(renderGranted(three), /propose_question/);
  assert.match(renderGranted(three), /6 tools/);
  assert.match(renderGranted(three), /7 tools/);

  const four = atLevel(4);
  assert.deepEqual(buildTools(ctx(four)).map((t) => t.name).slice(5), ['get_dossier', 'propose_question', 'get_portrait_history']);
  assert.match(renderGranted(four), /get_portrait_history/);
  assert.match(renderGranted(four), /8 tools/);
  assert.doesNotMatch(renderGranted(four), /--signal|--reveal/);
});

test('the tool proposes and refuses in words the agent can act on', async () => {
  let doc = atLevel(3);
  const box = { doc };
  const c = { getDoc: () => box.doc, setDoc: (d) => { box.doc = d; }, now: () => 0, waits: createWaitRegistry() };
  const tool = buildTools(c).find((t) => t.name === 'propose_question');
  const ok = (await tool.execute({ text: 'What song is this person?' }, {})).content[0].text;
  assert.match(ok, /Proposed/);
  const again = (await tool.execute({ text: 'Another' }, {})).content[0].text;
  assert.match(again, /^refused:/);
  assert.match(again, /One at a time/);
});

test('the manual introduces each verb at its tier and not before', () => {
  assert.doesNotMatch(manualFor(2), /propose_question/);
  assert.match(manualFor(3), /propose_question/);
  assert.doesNotMatch(manualFor(3), /get_portrait_history/);
  assert.match(manualFor(4), /get_portrait_history/);
  assert.ok(manualFor(4).includes(manualFor(3)), 'tier 4 keeps everything tier 3 taught');
});
