/* Perspective — the game where you find out how your agent sees you.

   One reader, one card. The agent commits a read with its reasons and four
   images; the page reveals it; the human responds — That's me, or Not quite
   with a correction. There is no answer of the human's to protect, so the
   ordering guards nothing here; what protects the read is that the agent gets
   no feedback until the sitting closes (dossier.test.js). */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDoc, reduce, projectForAgent, isPerspective, readyToReveal, VERDICTS
} from '../src/games/mirror/game.js';
import { renderRound, renderClose } from '../src/games/mirror/render.js';
import { open, playOut } from './helpers.js';

const four = (tag = 'x') => Array.from({ length: 4 }, (_, i) => ({
  url: `https://images.example/${tag}-${i}.jpg`, credit: `Photographer ${i}`, license: 'CC BY 4.0'
}));

const fresh = () => open(createDoc(0, { mode: 'perspective' }));

function committed(doc = fresh(), text = 'a lighthouse at the end of its shift') {
  const r = reduce(doc, { type: 'agent_submit', text, because: 'you keep going after the light is needed', images: four() });
  assert.equal(r.ok, true, r.message);
  return r.doc;
}

test('perspective is one of the three modes, and the other two are not it', () => {
  assert.equal(isPerspective(createDoc(0, { mode: 'perspective' })), true);
  assert.equal(isPerspective(createDoc(0, { mode: 'both' })), false);
  assert.equal(isPerspective(createDoc(0, { mode: 'quiz' })), false);
});

/* ---- no second answer ------------------------------------------------ */

test('the page never asks the human to answer', () => {
  const html = renderRound(fresh());
  assert.doesNotMatch(html, /id="human-answer"/, 'there must be no input at all, not a disabled one');
  assert.doesNotMatch(html, /data-action="human_submit"/);
  assert.match(html, /data-single="true"/);
  assert.doesNotMatch(html, /card--human/, 'a second card with nothing in it is an empty seat');
});

test('the reducer refuses a human answer as well, naming the mode', () => {
  const r = reduce(committed(), { type: 'human_submit', text: 'anything' });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'NO_SECOND_ANSWER');
  assert.match(r.message, /perspective/);
});

test('the reveal opens from agent_committed, because there is nothing else to wait for', () => {
  const doc = committed();
  assert.equal(readyToReveal(doc, doc.rounds[0]), true);
  const r = reduce(doc, { type: 'reveal' });
  assert.equal(r.ok, true);
  assert.equal(r.doc.rounds[0].state, 'revealed', 'revealed, not judged — the human has a move now');
});

test('the projection tells the agent its teammate is reading, and reports no second answer', () => {
  const p = projectForAgent(committed());
  assert.match(p.yourMove, /reading your answer/);
  assert.equal(p.teammateAnswersAbout, null);
});

/* ---- the response ----------------------------------------------------- */

test('the verdicts are That’s me and Not quite, and the correction is stored', () => {
  const revealed = reduce(committed(), { type: 'reveal' }).doc;
  assert.deepEqual(VERDICTS.perspective, ['me', 'not']);
  assert.equal(reduce(revealed, { type: 'judge', verdict: 'landed' }).code, 'BAD_VERDICT');

  const me = reduce(revealed, { type: 'judge', verdict: 'me', correction: '  ' });
  assert.equal(me.ok, true);
  assert.equal(me.doc.rounds[0].correction, '');

  const not = reduce(revealed, { type: 'judge', verdict: 'not', correction: ' more of a harbour ' });
  assert.equal(not.ok, true);
  assert.equal(not.doc.rounds[0].correction, 'more of a harbour');
  assert.match(not.doc.log.at(-1).detail, /corrected/);
});

test('a correction is the human’s move in perspective only', () => {
  let doc = open(createDoc(0, { mode: 'both' }));
  doc = reduce(doc, { type: 'agent_submit', text: 'a' }).doc;
  doc = reduce(doc, { type: 'human_submit', text: 'b' }).doc;
  doc = reduce(doc, { type: 'reveal' }).doc;
  doc = reduce(doc, { type: 'judge', verdict: 'missed', correction: 'ignored' }).doc;
  assert.equal(doc.rounds[0].correction, '', 'both-ways has its own second column; no correction');
});

test('the page draws the two responses and the correction field only once revealed', () => {
  const before = renderRound(committed());
  assert.doesNotMatch(before, /data-action="judge"/);
  assert.doesNotMatch(before, /id="correction"/);
  assert.doesNotMatch(before, /data-action="reveal"/, 'the page reveals itself; a button for it is ceremony');

  const revealed = reduce(committed(), { type: 'reveal' }).doc;
  const html = renderRound(revealed);
  assert.match(html, /data-verdict="me"/);
  assert.match(html, /data-verdict="not"/);
  assert.match(html, /That’s me/);
  assert.match(html, /Not quite/);
  assert.match(html, /id="correction"/);
});

test('the correction is shown after judging, beside the read it corrects', () => {
  let doc = reduce(committed(), { type: 'reveal' }).doc;
  doc = reduce(doc, { type: 'judge', verdict: 'not', correction: 'zzcorrectionzz' }).doc;
  assert.match(renderRound(doc), /zzcorrectionzz/);
  assert.match(renderRound(doc), /data-action="next"/);
});

/* ---- the composition ----------------------------------------------------- */

test('the reveal shows the read at the centre of its four images, with the why', () => {
  const html = renderRound(reduce(committed(), { type: 'reveal' }).doc);
  assert.match(html, /class="composition"/);
  assert.equal((html.match(/<img /g) || []).length, 4);
  assert.match(html, /a lighthouse at the end of its shift/);
  assert.match(html, /after the light is needed/);
  assert.match(html, /Photographer 0/);
});

test('before the reveal there is no image, no answer and no reason on the page', () => {
  const html = renderRound(committed());
  assert.doesNotMatch(html, /<img/);
  assert.doesNotMatch(html, /composition/);
  assert.ok(!html.includes('lighthouse'));
  assert.ok(!html.includes('after the light is needed'));
  assert.ok(!html.includes('images.example'));
});

test('a whole perspective sitting plays to the close with a response every round', () => {
  const doc = playOut(fresh(), ['me', 'not', 'me', 'not', 'me']);
  assert.ok(doc.rounds.every((r) => r.verdict !== null), 'every round carries a response');
  const html = renderClose(doc);
  assert.match(html, /data-grant="open"/);
  assert.match(html, /data-grant="kept"/);
  assert.match(html, /data-grant="sealed"/);
  assert.match(html, /correction 1/, 'the close shows the corrections the agent may carry');
  assert.doesNotMatch(html, /\d of \d/, 'a perspective sitting is not scored');
});
