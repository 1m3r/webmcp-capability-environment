/* The game's central claim, asserted by substring search over rendered output.

   Before the reveal, nothing on the page and nothing in the agent's projection
   carries either answer — nor the agent's reasons, nor an image url. In every
   mode. On every screen that can render while a round is in flight. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDoc, reduce, projectForAgent, lastRefusal, MODES } from '../src/games/mirror/game.js';
import {
  renderRound, renderGame, renderStart, renderClose, renderBetween, renderGranted, renderPortrait, escapeHtml
} from '../src/games/mirror/render.js';
import { buildDossier } from '../src/games/mirror/dossier.js';
import { open, playOut, close, afterOne } from './helpers.js';

const AGENT = 'zzagentsecretzz';
const WHY = 'zzagentwhyzz';
const HUMAN = 'zzhumansecretzz';
const SECRET_URL = 'https://images.example/zzleakzz.jpg';
const secretImages = Array.from({ length: 4 }, (_, i) => ({ url: `${SECRET_URL}?${i}`, credit: 'zzcreditzz' }));

/* Every state a round passes through before the reveal, per mode. */
function statesBeforeReveal(mode) {
  const posed = open(createDoc(0, { mode }));
  const agentCommitted = reduce(posed, {
    type: 'agent_submit', text: AGENT, because: WHY, images: secretImages
  }).doc;
  const states = [['posed', posed], ['agent_committed', agentCommitted]];
  if (mode !== 'perspective') {
    states.push(['both_committed', reduce(agentCommitted, { type: 'human_submit', text: HUMAN }).doc]);
  }
  return states;
}

const SECRETS = [AGENT, WHY, HUMAN, 'zzleakzz', 'zzcreditzz'];

function assertMute(text, where) {
  for (const secret of SECRETS) {
    assert.ok(!text.includes(secret), `${where}: leaked ${secret}`);
  }
}

for (const mode of MODES) {
  test(`${mode}: the agent projection carries nothing secret before the reveal`, () => {
    for (const [name, doc] of statesBeforeReveal(mode)) {
      assertMute(JSON.stringify(projectForAgent(doc)), `${mode}/${name} projection`);
    }
  });

  test(`${mode}: the rendered page carries nothing secret before the reveal`, () => {
    for (const [name, doc] of statesBeforeReveal(mode)) {
      const html = renderGame(doc, {});
      assertMute(html, `${mode}/${name} render`);
      assert.ok(!html.includes('<img'), `${mode}/${name}: an image tag rendered before the reveal`);
      assert.ok(!html.includes('composition'), `${mode}/${name}: a composition rendered before the reveal`);
    }
  });

  test(`${mode}: the dossier carries nothing from the sitting in play, ever`, () => {
    let doc = afterOne(mode, 'open');
    doc = open(doc, mode === 'quiz' ? 'habits' : mode === 'both' ? 'weather-gods' : 'deep-water');
    doc = reduce(doc, { type: 'agent_submit', text: AGENT, because: WHY, images: secretImages }).doc;
    assertMute(buildDossier(doc), `${mode} dossier, committed`);
    doc = reduce(doc, { type: 'reveal' }).doc;
    assertMute(buildDossier(doc), `${mode} dossier, revealed`);
  });
}

test('the projection still reports who has answered', () => {
  const doc = reduce(open(createDoc(0, { mode: 'both' })), { type: 'agent_submit', text: AGENT }).doc;
  const p = projectForAgent(doc);
  assert.equal(p.youHaveAnswered, true);
  assert.equal(p.teammateHasAnswered, false);
  assert.equal(p.state, 'agent_committed');
  assert.equal(p.round, 1);
  assert.equal(p.of, 5);
  assert.ok(p.question.length > 0);
});

test('both answers appear once the round is revealed', () => {
  let doc = open(createDoc(0, { mode: 'both' }));
  doc = reduce(doc, { type: 'agent_submit', text: AGENT, because: WHY }).doc;
  doc = reduce(doc, { type: 'human_submit', text: HUMAN }).doc;
  doc = reduce(doc, { type: 'reveal' }).doc;
  const p = projectForAgent(doc);
  assert.equal(p.yourAnswer, AGENT);
  assert.equal(p.teammateAnswer, HUMAN);
  const html = renderRound(doc);
  assert.ok(html.includes(AGENT));
  assert.ok(html.includes(WHY));
  assert.ok(html.includes(HUMAN));
});

test('the human input is disabled until the agent has committed', () => {
  const posed = renderRound(open(createDoc(0, { mode: 'both' })));
  assert.match(posed, /id="human-answer"[^>]*disabled/, 'the page must not accept a human answer while the round is posed');
  const committed = renderRound(reduce(open(createDoc(0, { mode: 'both' })), { type: 'agent_submit', text: AGENT }).doc);
  assert.doesNotMatch(committed, /id="human-answer"[^>]*disabled/, 'the human must be able to answer once the agent has committed');
});

test('the reveal control appears only when both have committed', () => {
  const [, , [, agentCommitted]] = [null, null, statesBeforeReveal('both')[1]];
  const [, bothCommitted] = statesBeforeReveal('both')[2];
  assert.doesNotMatch(renderRound(agentCommitted), /data-action="reveal"/);
  assert.match(renderRound(bothCommitted), /data-action="reveal"/);
});

test('answers, reasons, corrections and credits are escaped, so none can inject markup', () => {
  let doc = open(createDoc(0, { mode: 'perspective' }));
  const hostile = 'https://e.test/a.jpg" onerror="alert(1)';
  doc = reduce(doc, {
    type: 'agent_submit', text: '<img src=x onerror=1>', because: '<script>why</script>',
    images: [hostile, hostile, hostile, hostile].map((url) => ({ url, credit: '<script>x</script>' }))
  }).doc;
  doc = reduce(doc, { type: 'reveal' }).doc;
  doc = reduce(doc, { type: 'judge', verdict: 'not', correction: '<b>me</b>' }).doc;
  const html = renderRound(doc) + renderClose(playOut(doc));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('onerror="alert(1)"'), 'the url escaped its attribute');
  assert.ok(!html.includes('<b>me</b>'));
  assert.ok(html.includes('&lt;img src=x'));
});

test('escapeHtml handles the five characters that matter', () => {
  assert.equal(escapeHtml(`<&>"'`), '&lt;&amp;&gt;&quot;&#39;');
});

/* ---- the screens around the round --------------------------------------- */

test('the close screen shows every round and the mode’s line', () => {
  const both = playOut(open(createDoc(0, { mode: 'both' })), ['landed', 'missed', 'landed', 'missed', 'landed']);
  const html = renderClose(both);
  assert.match(html, /3 of 5 landed/);
  for (let i = 0; i < 5; i++) {
    assert.ok(html.includes(`agent ${i}`), `round ${i + 1} missing from the close`);
    assert.ok(html.includes(`human ${i}`), `round ${i + 1} missing from the close`);
  }
});

test('a quiz at or above the threshold passes, and below it does not', () => {
  const pass = playOut(open(createDoc(0, { mode: 'quiz' })), ['match', 'match', 'match', 'match', 'miss', 'miss']);
  assert.match(renderClose(pass), /PASSED/);
  const fail = playOut(open(createDoc(0, { mode: 'quiz' })), ['match', 'match', 'match', 'miss', 'miss', 'miss']);
  assert.match(renderClose(fail), /NOT PASSED/);
});

test('renderGame chooses the screen: between, round, close, transmission', () => {
  const fresh = createDoc(0, { mode: 'both' });
  assert.match(renderGame(fresh), /class="between"/);
  assert.match(renderGame(open(fresh)), /round__question/);
  const done = playOut(open(fresh));
  assert.match(renderGame(done), /class="results close"/);
  const closed = close(done);
  assert.match(renderGame(closed), /class="transmission"/);
  assert.match(renderGame(closed, { transmissionSeen: closed.version }), /class="between"/);
});

test('the start screen offers the three games and no checkbox', () => {
  const html = renderStart();
  for (const mode of MODES) assert.match(html, new RegExp(`data-game="${mode}"`));
  assert.doesNotMatch(html, /type="checkbox"/);
  assert.doesNotMatch(html, /--signal|--reveal/);
});

test('the between screen offers unlocked decks as controls and locked ones as nothing', () => {
  const fresh = renderBetween(createDoc(0, { mode: 'perspective' }));
  assert.match(fresh, /data-action="open_sitting" data-deck="first-light"/);
  assert.doesNotMatch(fresh, /data-deck="deep-water"/, 'a locked deck must not be a control');
  assert.match(fresh, /opens at level 2/);

  const later = renderBetween(afterOne('perspective', 'kept', ['me', 'not', 'me', 'not', 'me']));
  assert.match(later, /data-deck="deep-water"/);
  assert.match(later, /Open the kept reads only/, 'the sitting shows the grant it closed with');
  assert.ok(later.includes('agent 0'), 'the portrait shows its reads');
  assert.ok(later.includes('correction 1'), 'and the corrections');
  assert.match(later, /class="composition"/);
  assert.match(later, /data-action="export"/);
});

test('the transmission carries no answer text and spends neither colour', () => {
  const doc = close(playOut(open(createDoc(0, { mode: 'perspective' }))));
  const html = renderGranted(doc);
  assert.ok(!html.includes('agent 0'));
  assert.doesNotMatch(html, /--signal|--reveal/);
  assert.match(html, /get_dossier/);
  assert.match(html, /5 tools/);
  assert.match(html, /6 tools/);
});

/* ---- the refusal panel ------------------------------------------------ */

test('a refused action puts its cause on the stage, and it survives the agent talking', () => {
  let doc = reduce(open(createDoc(0, { mode: 'both' })), { type: 'agent_submit', text: AGENT }).doc;
  doc = reduce(doc, { type: 'agent_submit', text: 'a second answer' }).doc;
  assert.equal(lastRefusal(doc).outcome, 'refused');
  assert.match(renderRound(doc), /already committed this round/);

  doc = reduce(doc, { type: 'say', text: `Sorry — my answer is ${AGENT}` }).doc;
  doc = reduce(doc, { type: 'read', text: 'get_round' }).doc;
  const html = renderRound(doc);
  assert.match(html, /already committed this round/, 'say and read must not clear the refusal');
  assert.ok(!html.includes(AGENT), 'a say() reached the stage — the panel must filter to refusals');

  doc = reduce(doc, { type: 'human_submit', text: HUMAN }).doc;
  assert.equal(lastRefusal(doc), null, 'an accepted state change clears it');
  assert.doesNotMatch(renderRound(doc), /class="round__refusal"/);
});

test('a refusal on screen still leaks no answer', () => {
  let doc = reduce(open(createDoc(0, { mode: 'both' })), { type: 'agent_submit', text: AGENT }).doc;
  doc = reduce(doc, { type: 'agent_submit', text: AGENT }).doc;
  doc = reduce(doc, { type: 'human_submit', text: HUMAN }).doc;
  doc = reduce(doc, { type: 'human_submit', text: HUMAN }).doc;
  const html = renderRound(doc);
  assert.match(html, /class="round__refusal"/);
  assertMute(html, 'refusal panel');
});

test('an image refusal names the url on the stage — that url is not secret, the answer beside it is', () => {
  let doc = open(createDoc(0, { mode: 'perspective' }));
  doc = reduce(doc, { type: 'agent_submit', text: AGENT, images: secretImages, rejected: ['https://images.example/broken.jpg'] }).doc;
  const html = renderRound(doc);
  assert.match(html, /broken\.jpg/);
  assert.ok(!html.includes(AGENT));
  assert.ok(!html.includes('zzleakzz'));
});

test('cyan retires at the reveal, so one card is never in two states', () => {
  let doc = reduce(open(createDoc(0, { mode: 'both' })), { type: 'agent_submit', text: AGENT }).doc;
  assert.match(renderRound(doc), /card--agent" data-committed="true"/);
  doc = reduce(doc, { type: 'human_submit', text: HUMAN }).doc;
  doc = reduce(doc, { type: 'reveal' }).doc;
  assert.doesNotMatch(renderRound(doc), /data-committed="true"/);
});

test('the keepsake carries every closed sitting and only revealed rounds of the one in play', () => {
  let doc = afterOne('perspective', 'open', ['me', 'not']);
  doc = open(doc, 'deep-water');
  doc = reduce(doc, { type: 'agent_submit', text: AGENT, because: WHY, images: secretImages }).doc;
  const md = renderPortrait(doc);
  assert.match(md, /Sitting 1 — First light \(open\)/);
  assert.ok(md.includes('agent 0'));
  assert.ok(md.includes('correction 1'));
  assert.match(md, /illustrated by/);
  assertMute(md, 'portrait markdown');
});
