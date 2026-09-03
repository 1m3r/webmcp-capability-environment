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

import { renderResults, renderGame, renderStart } from '../src/games/mirror/render.js';
import { isComplete } from '../src/games/mirror/game.js';
import { QUIZ_PASS } from '../src/games/mirror/questions.js';

function finished(mode, verdicts) {
  let doc = createDoc(0, { mode });
  for (let i = 0; i < 8; i++) {
    doc = reduce(doc, { type: 'agent_submit', text: `agent ${i}` }).doc;
    doc = reduce(doc, { type: 'human_submit', text: `human ${i}` }).doc;
    doc = reduce(doc, { type: 'reveal' }).doc;
    doc = reduce(doc, { type: 'judge', verdict: verdicts[i] }).doc;
    if (i < 7) doc = reduce(doc, { type: 'next' }).doc;
  }
  return doc;
}

const LANDED = Array(8).fill('landed');

test('the results screen shows every round and the rate', () => {
  const doc = finished('portrait', ['landed', 'missed', 'landed', 'missed', 'landed', 'missed', 'landed', 'missed']);
  assert.equal(isComplete(doc), true);
  const html = renderResults(doc);
  assert.match(html, /4 of 8/);
  for (let i = 0; i < 8; i++) {
    assert.ok(html.includes(`agent ${i}`), `round ${i + 1} missing from the results`);
    assert.ok(html.includes(`human ${i}`), `round ${i + 1} missing from the results`);
  }
});

test('a quiz at or above the threshold passes, and below it does not', () => {
  const pass = Array(8).fill('miss');
  for (let i = 0; i < QUIZ_PASS; i++) pass[i] = 'match';
  assert.match(renderResults(finished('quiz', pass)), /PASSED/);

  const fail = Array(8).fill('miss');
  for (let i = 0; i < QUIZ_PASS - 1; i++) fail[i] = 'match';
  assert.match(renderResults(finished('quiz', fail)), /NOT PASSED/);
});

test('renderGame shows the round while playing and the results when finished', () => {
  assert.match(renderGame(createDoc()), /round__question/);
  assert.match(renderGame(finished('portrait', LANDED)), /results/);
});

test('the start screen offers both modes and the opt-out', () => {
  const html = renderStart();
  assert.match(html, /data-mode="portrait"/);
  assert.match(html, /data-mode="quiz"/);
  assert.match(html, /id="opt-about-agent"/);
});

test('the results screen is covered by the secrecy rule too', () => {
  for (const [name, doc] of statesBeforeReveal()) {
    const html = renderGame(doc);
    assert.ok(!html.includes(AGENT), `${name}: renderGame leaked the agent's answer`);
    assert.ok(!html.includes(HUMAN), `${name}: renderGame leaked the human's answer`);
  }
});

/* ---- the refusal panel ------------------------------------------------

   The stage now reads from the log, which is a new path by which text can reach
   the screen at display scale. Refusal messages are fixed strings that never
   interpolate an answer — but `say` and `read` put AGENT-AUTHORED text into the
   same `detail` field, so the panel must filter on outcome and not on recency.
   These tests are what keeps that true. */

import { lastRefusal } from '../src/games/mirror/game.js';

test('a refused action puts its cause on the stage', () => {
  let doc = reduce(createDoc(), { type: 'agent_submit', text: AGENT }).doc;
  doc = reduce(doc, { type: 'agent_submit', text: 'a second answer' }).doc;

  const refusal = lastRefusal(doc);
  assert.equal(refusal.outcome, 'refused');
  assert.match(renderRound(doc), /class="round__refusal"/);
  assert.match(renderRound(doc), /already committed this round/);
});

test('the refusal survives the agent talking about it', () => {
  let doc = reduce(createDoc(), { type: 'agent_submit', text: AGENT }).doc;
  doc = reduce(doc, { type: 'agent_submit', text: 'a second answer' }).doc;
  doc = reduce(doc, { type: 'say', text: 'Sorry — let me try that again.' }).doc;
  doc = reduce(doc, { type: 'read', text: 'get_round' }).doc;

  assert.ok(lastRefusal(doc), 'say and read must not clear the refusal');
  assert.match(renderRound(doc), /already committed this round/);
});

test('a second refusal does not clear the first — it replaces it', () => {
  let doc = reduce(createDoc(), { type: 'agent_submit', text: AGENT }).doc;
  doc = reduce(doc, { type: 'agent_submit', text: 'push one' }).doc;
  doc = reduce(doc, { type: 'agent_submit', text: 'push two' }).doc;
  assert.ok(lastRefusal(doc), 'the panel must not blink empty on the second push');
  assert.match(renderRound(doc), /class="round__refusal"/);
});

test('the refusal clears when the game actually moves on', () => {
  let doc = reduce(createDoc(), { type: 'agent_submit', text: AGENT }).doc;
  doc = reduce(doc, { type: 'agent_submit', text: 'a second answer' }).doc;
  assert.ok(lastRefusal(doc));

  doc = reduce(doc, { type: 'human_submit', text: HUMAN }).doc;
  assert.equal(lastRefusal(doc), null, 'an accepted state change clears it');
  assert.doesNotMatch(renderRound(doc), /class="round__refusal"/);
});

test('an empty log has no refusal', () => {
  assert.equal(lastRefusal(createDoc()), null);
  assert.doesNotMatch(renderRound(createDoc()), /class="round__refusal"/);
});

/* The one the handoff did not think of. An agent controls the text in `say`,
   and `say` writes to the same field the panel renders. If the panel ever read
   the log tail rather than filtering to refusals, an agent could put its own
   uncommitted answer on the stage in display type. */
test('the stage never renders agent-authored text from the log', () => {
  let doc = reduce(createDoc(), { type: 'agent_submit', text: AGENT }).doc;
  doc = reduce(doc, { type: 'say', text: `my answer is ${AGENT}` }).doc;

  const html = renderRound(doc);
  assert.ok(!html.includes(AGENT),
    'a say() reached the stage — the panel must filter to refusals, not take the log tail');
});

test('a refusal on screen still leaks no answer', () => {
  let doc = reduce(createDoc(), { type: 'agent_submit', text: AGENT }).doc;
  doc = reduce(doc, { type: 'agent_submit', text: AGENT }).doc;
  doc = reduce(doc, { type: 'human_submit', text: HUMAN }).doc;
  doc = reduce(doc, { type: 'human_submit', text: HUMAN }).doc;

  const html = renderRound(doc);
  assert.match(html, /class="round__refusal"/, 'the refusal should be showing');
  assert.ok(!html.includes(AGENT), 'the refusal panel leaked the agent answer');
  assert.ok(!html.includes(HUMAN), 'the refusal panel leaked the human answer');
});

test('cyan retires at the reveal, so one card is never in two states', () => {
  let doc = reduce(createDoc(), { type: 'agent_submit', text: AGENT }).doc;
  assert.match(renderRound(doc), /card--agent" data-committed="true"/,
    'a committed card must carry the signal before the reveal');

  doc = reduce(doc, { type: 'human_submit', text: HUMAN }).doc;
  doc = reduce(doc, { type: 'reveal' }).doc;
  const html = renderRound(doc);
  assert.doesNotMatch(html, /data-committed="true"/,
    'after the reveal the committed halo must retire and leave the moment to amber');
});

/* ---- the grant and the transmission -----------------------------------

   Both are new surfaces that render while a game is in flight, so both are
   inside the secrecy rule. The transmission in particular renders at display
   scale, which is the worst possible place for a leak. */

import { renderGrant, renderGranted } from '../src/games/mirror/render.js';
import { justGranted } from '../src/games/mirror/game.js';

function atGrantMoment(mode = 'portrait') {
  let doc = createDoc(0, { mode });
  for (let i = 0; i < 4; i++) {
    if (i > 0) doc = reduce(doc, { type: 'next' }).doc;
    doc = reduce(doc, { type: 'agent_submit', text: `${AGENT}${i}` }).doc;
    doc = reduce(doc, { type: 'human_submit', text: `${HUMAN}${i}` }).doc;
    doc = reduce(doc, { type: 'reveal' }).doc;
    doc = reduce(doc, { type: 'judge', verdict: 'landed' }).doc;
  }
  return doc;
}

test('the grant offer carries no answer text of its own', () => {
  const html = renderGrant(atGrantMoment());
  assert.ok(!html.includes(AGENT), 'the grant offer leaked an agent answer');
  assert.ok(!html.includes(HUMAN), 'the grant offer leaked a human answer');
});

test('the transmission carries no answer text', () => {
  const doc = reduce(atGrantMoment(), { type: 'grant_tier' }).doc;
  assert.equal(justGranted(doc), true);
  const html = renderGranted(doc);
  assert.ok(!html.includes(AGENT), 'the transmission leaked an agent answer');
  assert.ok(!html.includes(HUMAN), 'the transmission leaked a human answer');
});

/* The grant can only be reached with four rounds already revealed, so nothing
   is secret by then — but a renderer that is safe only by circumstance is a
   renderer waiting to be moved. Assert it where it cannot be reached, too. */
test('the transmission stays mute about an unrevealed round beneath it', () => {
  let doc = reduce(atGrantMoment(), { type: 'grant_tier' }).doc;
  doc = reduce(doc, { type: 'next' }).doc;
  doc = reduce(doc, { type: 'agent_submit', text: AGENT }).doc;
  doc = reduce(doc, { type: 'grant_tier' }).doc;   // refused: already granted

  const html = renderGame(doc, {});
  assert.ok(!html.includes(AGENT),
    'round 5 is uncommitted and its answer must not appear anywhere on the stage');
});

/* ---- the gallery -------------------------------------------------------

   Image URLs are agent-authored strings that reach the DOM as attributes, and a
   composition renders an answer in display type. Both are exactly the class of
   thing this file exists to police. */

import { renderPortrait } from '../src/games/mirror/render.js';

const SECRET_URL = 'https://images.example/zzleakzz.jpg';

test('images cannot be attached to a round that has not been revealed', () => {
  let doc = createDoc(0, { mode: 'portrait' });
  doc = reduce(doc, { type: 'agent_submit', text: AGENT }).doc;

  const result = reduce(doc, {
    type: 'illustrate', round: 1, whose: 'agent',
    images: Array.from({ length: 4 }, () => ({ url: SECRET_URL }))
  });

  assert.equal(result.ok, false, 'a committed-but-unrevealed round must refuse images');
  assert.equal(result.code, 'NOT_REVEALED');
  assert.ok(!renderGame(result.doc, {}).includes(SECRET_URL),
    'a refused illustration must not reach the page');
});

test('no image url reaches the page before the reveal', () => {
  for (const [name, doc] of statesBeforeReveal()) {
    const html = renderGame(doc, {});
    assert.ok(!html.includes('composition'), `${name}: a composition rendered before the reveal`);
    assert.ok(!html.includes('<img'), `${name}: an image tag rendered before the reveal`);
  }
});

/* An agent picks these URLs. A url is written into an attribute, so a quote in
   it would close the attribute and everything after would be markup. */
test('an image url cannot break out of its attribute', () => {
  let doc = createDoc(0, { mode: 'portrait' });
  doc = reduce(doc, { type: 'agent_submit', text: 'mine' }).doc;
  doc = reduce(doc, { type: 'human_submit', text: 'theirs' }).doc;
  doc = reduce(doc, { type: 'reveal' }).doc;
  doc = reduce(doc, { type: 'judge', verdict: 'landed' }).doc;

  const hostile = 'https://e.test/a.jpg" onerror="alert(1)';
  doc = reduce(doc, {
    type: 'illustrate', round: 1, whose: 'agent',
    images: [hostile, hostile, hostile, hostile].map((url) => ({ url, credit: '<script>x</script>' }))
  }).doc;

  const html = renderResults(doc);
  assert.ok(!html.includes('onerror="alert(1)"'), 'the url escaped its attribute');
  assert.ok(!html.includes('<script>'), 'a credit injected markup');
  assert.match(html, /&quot;/);
});

test('a composition renders the answer, and only after the reveal', () => {
  let doc = createDoc(0, { mode: 'portrait' });
  doc = reduce(doc, { type: 'agent_submit', text: AGENT }).doc;
  doc = reduce(doc, { type: 'human_submit', text: HUMAN }).doc;

  assert.ok(!renderRound(doc).includes(AGENT), 'still secret before the reveal');

  doc = reduce(doc, { type: 'reveal' }).doc;
  doc = reduce(doc, { type: 'judge', verdict: 'landed' }).doc;
  doc = reduce(doc, {
    type: 'illustrate', round: 1, whose: 'agent',
    images: Array.from({ length: 4 }, (_, i) => ({ url: `https://e.test/${i}.jpg` }))
  }).doc;

  const html = renderResults(doc);
  assert.match(html, /class="composition"/);
  assert.ok(html.includes(AGENT), 'the composition shows the answer it illustrates');
});

/* The fallback is the feature's most important property, so it is asserted
   rather than assumed. */
test('an unillustrated game renders exactly as it did before the gallery', () => {
  let doc = createDoc(0, { mode: 'portrait' });
  for (let i = 0; i < 8; i++) {
    if (i > 0) doc = reduce(doc, { type: 'next' }).doc;
    doc = reduce(doc, { type: 'agent_submit', text: `agent ${i}` }).doc;
    doc = reduce(doc, { type: 'human_submit', text: `human ${i}` }).doc;
    doc = reduce(doc, { type: 'reveal' }).doc;
    doc = reduce(doc, { type: 'judge', verdict: 'landed' }).doc;
  }

  const html = renderResults(doc);
  assert.ok(!html.includes('<img'), 'no images means no image tags, not empty frames');
  assert.ok(!html.includes('composition'), 'and no empty compositions');
  assert.match(html, /class="results__answer"/, 'the text layout still renders');
  for (let i = 0; i < 8; i++) assert.ok(html.includes(`agent ${i}`));

  assert.ok(!renderPortrait(doc).includes('illustrated by'),
    'and the export says nothing about images it does not have');
});

test('a half-illustrated round renders one composition and one line of text', () => {
  let doc = createDoc(0, { mode: 'portrait' });
  doc = reduce(doc, { type: 'agent_submit', text: AGENT }).doc;
  doc = reduce(doc, { type: 'human_submit', text: HUMAN }).doc;
  doc = reduce(doc, { type: 'reveal' }).doc;
  doc = reduce(doc, { type: 'judge', verdict: 'landed' }).doc;
  doc = reduce(doc, {
    type: 'illustrate', round: 1, whose: 'agent',
    images: Array.from({ length: 4 }, (_, i) => ({ url: `https://e.test/${i}.jpg` }))
  }).doc;

  const html = renderResults(doc);
  assert.equal((html.match(/class="composition"/g) || []).length, 1);
  assert.match(html, /class="results__answer"/);
  assert.ok(html.includes(HUMAN), 'the unillustrated answer still shows as text');
});
