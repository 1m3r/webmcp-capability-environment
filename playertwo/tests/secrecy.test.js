import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDoc, reduce, projectForAgent } from '../src/games/mirror/game.js';
import { renderRound, escapeHtml } from '../src/games/mirror/render.js';

const AGENT = 'zzagentsecretzz';
const HUMAN = 'zzhumansecretzz';

/* Every state a round passes through before the reveal. */
function statesBeforeReveal() {
  const posed = createDoc();
  const agentCommitted = reduce(posed, { type: 'agent_submit', text: AGENT }).doc;
  const bothCommitted = reduce(agentCommitted, { type: 'human_submit', text: HUMAN }).doc;
  return [
    ['posed', posed],
    ['agent_committed', agentCommitted],
    ['both_committed', bothCommitted]
  ];
}

test('the agent projection carries no answer text before the reveal', () => {
  for (const [name, doc] of statesBeforeReveal()) {
    const payload = JSON.stringify(projectForAgent(doc));
    assert.ok(!payload.includes(AGENT), `${name}: the projection leaked the agent's own answer`);
    assert.ok(!payload.includes(HUMAN), `${name}: the projection leaked the human's answer`);
  }
});

test('the rendered page carries no answer text before the reveal', () => {
  for (const [name, doc] of statesBeforeReveal()) {
    const html = renderRound(doc);
    assert.ok(!html.includes(AGENT), `${name}: the render leaked the agent's answer`);
    assert.ok(!html.includes(HUMAN), `${name}: the render leaked the human's answer`);
  }
});

test('the projection still reports who has answered', () => {
  const doc = reduce(createDoc(), { type: 'agent_submit', text: AGENT }).doc;
  const p = projectForAgent(doc);
  assert.equal(p.youHaveAnswered, true);
  assert.equal(p.teammateHasAnswered, false);
  assert.equal(p.state, 'agent_committed');
  assert.equal(p.round, 1);
  assert.equal(p.of, 8);
  assert.ok(p.question.length > 0);
});

test('both answers appear once the round is revealed', () => {
  let doc = createDoc();
  doc = reduce(doc, { type: 'agent_submit', text: AGENT }).doc;
  doc = reduce(doc, { type: 'human_submit', text: HUMAN }).doc;
  doc = reduce(doc, { type: 'reveal' }).doc;
  const p = projectForAgent(doc);
  assert.equal(p.yourAnswer, AGENT);
  assert.equal(p.teammateAnswer, HUMAN);
  const html = renderRound(doc);
  assert.ok(html.includes(AGENT));
  assert.ok(html.includes(HUMAN));
});

test('the human input is disabled until the agent has committed', () => {
  const posed = renderRound(createDoc());
  assert.match(posed, /id="human-answer"[^>]*disabled/,
    'the page must not accept a human answer while the round is posed');

  const committed = renderRound(reduce(createDoc(), { type: 'agent_submit', text: AGENT }).doc);
  assert.doesNotMatch(committed, /id="human-answer"[^>]*disabled/,
    'the human must be able to answer once the agent has committed');
});

test('the reveal control appears only when both have committed', () => {
  const [, agentCommitted] = statesBeforeReveal()[1];
  const [, bothCommitted] = statesBeforeReveal()[2];
  assert.doesNotMatch(renderRound(agentCommitted), /data-action="reveal"/);
  assert.match(renderRound(bothCommitted), /data-action="reveal"/);
});

test('answers are escaped, so an answer cannot inject markup', () => {
  let doc = createDoc();
  doc = reduce(doc, { type: 'agent_submit', text: '<img src=x onerror=1>' }).doc;
  doc = reduce(doc, { type: 'human_submit', text: 'plain' }).doc;
  doc = reduce(doc, { type: 'reveal' }).doc;
  const html = renderRound(doc);
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;img src=x'));
});

test('escapeHtml handles the five characters that matter', () => {
  assert.equal(escapeHtml(`<&>"'`), '&lt;&amp;&gt;&quot;&#39;');
});
