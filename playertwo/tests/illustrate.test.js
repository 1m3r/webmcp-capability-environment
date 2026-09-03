/* illustrate_answer — the page describing a capability it does not have.

   Every other tool in this game lends the agent a way to act inside a world the
   page owns. This one runs the other way: the page is static, offline,
   dependency-free and holds no key, so it cannot fetch an image — and it says so
   by defining a slot and leaving the agent to fill it.

   The tests below are mostly refusals, because the refusals are the design. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDoc, reduce, imagesFor, unillustrated, normaliseImage, COMPOSITION_SIZE
} from '../src/games/mirror/game.js';
import { buildTools } from '../src/games/mirror/tools.js';
import { createWaitRegistry } from '../src/waiters.js';

const nImages = (n, tag = 'x') => Array.from({ length: n }, (_, i) => ({
  url: `https://images.example/${tag}-${i}.jpg`,
  credit: `Photographer ${i}`,
  license: 'CC BY 4.0',
  source: `https://images.example/${tag}-${i}`
}));

const four = (tag = 'x') => Array.from({ length: COMPOSITION_SIZE }, (_, i) => ({
  url: `https://images.example/${tag}-${i}.jpg`,
  credit: `Photographer ${i}`,
  license: 'CC BY 4.0',
  source: `https://images.example/${tag}-${i}`
}));

/* A game with round 1 revealed and, optionally, more rounds played. */
function played(rounds = 1, mode = 'portrait') {
  let doc = createDoc(0, { mode });
  for (let i = 0; i < rounds; i++) {
    if (i > 0) doc = reduce(doc, { type: 'next' }).doc;
    doc = reduce(doc, { type: 'agent_submit', text: `agent ${i}` }).doc;
    doc = reduce(doc, { type: 'human_submit', text: `human ${i}` }).doc;
    doc = reduce(doc, { type: 'reveal' }).doc;
    if (i < rounds - 1) doc = reduce(doc, { type: 'judge', verdict: 'landed' }).doc;
  }
  return doc;
}

const illustrate = (doc, patch = {}) =>
  reduce(doc, { type: 'illustrate', round: 1, whose: 'agent', images: four(), ...patch });

/* ---- the happy path ---------------------------------------------------- */

test('four images attach to a revealed answer', () => {
  const result = illustrate(played());
  assert.equal(result.ok, true, result.message);
  const images = imagesFor(result.doc.rounds[0], 'agent');
  assert.equal(images.length, COMPOSITION_SIZE);
  assert.equal(images[0].credit, 'Photographer 0');
  assert.equal(images[0].license, 'CC BY 4.0');
});

test('each answer is illustrated separately', () => {
  let doc = illustrate(played()).doc;
  assert.ok(imagesFor(doc.rounds[0], 'agent'));
  assert.equal(imagesFor(doc.rounds[0], 'human'), null,
    "the agent's answer and the human's are two different compositions");

  doc = illustrate(doc, { whose: 'human', images: four('h') }).doc;
  assert.ok(imagesFor(doc.rounds[0], 'human'));
});

/* It targets a round by number, unlike every other action in this reducer,
   because the agent's subagents come back while the game has moved on. */
test('an earlier round can be illustrated from a later one', () => {
  let doc = played(3);
  assert.equal(doc.roundIndex, 2);
  const result = illustrate(doc, { round: 1 });
  assert.equal(result.ok, true, result.message);
  assert.ok(imagesFor(result.doc.rounds[0], 'agent'));
  assert.equal(result.doc.roundIndex, 2, 'illustrating must not move the game');
});

test('a finished game can still be illustrated', () => {
  let doc = createDoc(0, { mode: 'portrait' });
  for (let i = 0; i < 8; i++) {
    if (i > 0) doc = reduce(doc, { type: 'next' }).doc;
    doc = reduce(doc, { type: 'agent_submit', text: `a${i}` }).doc;
    doc = reduce(doc, { type: 'human_submit', text: `h${i}` }).doc;
    doc = reduce(doc, { type: 'reveal' }).doc;
    doc = reduce(doc, { type: 'judge', verdict: 'landed' }).doc;
  }
  assert.equal(unillustrated(doc).length, 16, 'eight rounds, two answers each');
  const result = illustrate(doc, { round: 8, whose: 'human' });
  assert.equal(result.ok, true,
    'the gallery is composed after the run, so a complete game must still accept images');
});

/* ---- the refusals, which are the design -------------------------------- */

test('an unrevealed round is refused, and the cause is secrecy', () => {
  const doc = reduce(createDoc(0, { mode: 'portrait' }),
    { type: 'agent_submit', text: 'mine' }).doc;
  const result = illustrate(doc);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'NOT_REVEALED');
  assert.match(result.message, /still secret/);
});

test('quiz mode does not have a gallery', () => {
  const result = illustrate(played(1, 'quiz'));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'NOT_IN_PORTRAIT');
});

test('a composition is exactly four images', () => {
  for (const n of [0, 1, 3, 5, 8]) {
    const result = illustrate(played(), { images: nImages(n) });
    assert.equal(result.ok, false, `${n} images should be refused`);
    assert.equal(result.code, 'BAD_COUNT', `${n} images gave ${result.code}`);
  }
  assert.equal(illustrate(played(), { images: 'not an array' }).code, 'BAD_COUNT');
  assert.equal(illustrate(played(), { images: undefined }).code, 'BAD_COUNT');
});

test('images are immutable once attached, like the answer they illustrate', () => {
  const doc = illustrate(played()).doc;
  const again = illustrate(doc, { images: four('other') });
  assert.equal(again.ok, false);
  assert.equal(again.code, 'ALREADY_ILLUSTRATED');
  assert.equal(imagesFor(again.doc.rounds[0], 'agent')[0].url,
    'https://images.example/x-0.jpg', 'the original composition must survive');
});

test('a round that does not exist is refused by number', () => {
  for (const round of [0, 9, -1, 'two', null]) {
    const result = illustrate(played(), { round });
    assert.equal(result.ok, false, `round ${round} should be refused`);
    assert.equal(result.code, 'BAD_ROUND');
  }
});

test('whose is agent or human and nothing else', () => {
  const result = illustrate(played(), { whose: 'both' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'BAD_WHOSE');
});

test('an excused round has no human answer to illustrate', () => {
  let doc = createDoc(0, { mode: 'portrait', answerAboutAgent: false });
  doc = reduce(doc, { type: 'agent_submit', text: 'mine alone' }).doc;
  doc = reduce(doc, { type: 'reveal' }).doc;

  assert.equal(illustrate(doc, { whose: 'agent' }).ok, true);
  const human = illustrate(doc, { whose: 'human' });
  assert.equal(human.ok, false);
  assert.equal(human.code, 'NO_ANSWER');
});

/* ---- what the page will render ----------------------------------------- */

test('only http(s) urls survive, so an agent cannot inline a payload', () => {
  assert.equal(normaliseImage({ url: 'data:image/png;base64,AAAA' }), null);
  assert.equal(normaliseImage({ url: 'javascript:alert(1)' }), null);
  assert.equal(normaliseImage({ url: 'file:///etc/passwd' }), null);
  assert.equal(normaliseImage({ url: '' }), null);
  assert.equal(normaliseImage(null), null);
  assert.ok(normaliseImage({ url: 'http://example.test/a.png' }));
  assert.ok(normaliseImage({ url: 'https://example.test/a.png' }));
});

test('a rejected url is dropped and takes the whole composition with it', () => {
  const images = four();
  images[2] = { url: 'data:image/png;base64,AAAA' };
  const result = illustrate(played(), { images });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'BAD_COUNT',
    'three usable images is not a 2x2, and silently rendering three would be worse');
  assert.match(result.message, /http or https/);
});

test('missing credit and licence default to empty rather than undefined', () => {
  const bare = Array.from({ length: 4 }, (_, i) => ({ url: `https://e.test/${i}.jpg` }));
  const doc = illustrate(played(), { images: bare }).doc;
  for (const image of imagesFor(doc.rounds[0], 'agent')) {
    assert.equal(image.credit, '');
    assert.equal(image.license, '');
    assert.equal(typeof image.url, 'string');
  }
});

/* ---- bookkeeping the agent uses to know when it is done ---------------- */

test('unillustrated counts only revealed answers that exist', () => {
  assert.deepEqual(unillustrated(createDoc(0, { mode: 'portrait' })), [],
    'nothing is revealed, so nothing is illustratable');

  const doc = played(2);
  assert.deepEqual(unillustrated(doc), [
    { round: 1, whose: 'agent' }, { round: 1, whose: 'human' },
    { round: 2, whose: 'agent' }, { round: 2, whose: 'human' }
  ]);

  const after = illustrate(doc, { round: 2, whose: 'human' }).doc;
  assert.equal(unillustrated(after).length, 3);
});

test('quiz mode reports nothing to illustrate', () => {
  assert.deepEqual(unillustrated(played(2, 'quiz')), []);
});

test('imagesFor tolerates a game saved before the gallery existed', () => {
  const legacy = { state: 'judged', agentAnswer: 'a', humanAnswer: 'h' };   // no `images` key
  assert.equal(imagesFor(legacy, 'agent'), null);
  assert.equal(imagesFor(undefined, 'agent'), null);
});

/* ---- through the tool -------------------------------------------------- */

function toolFor(doc) {
  const box = { doc };
  const ctx = {
    getDoc: () => box.doc,
    setDoc: (d) => { box.doc = d; },
    now: () => 0,
    waits: createWaitRegistry()
  };
  return { box, tool: buildTools(ctx).find((t) => t.name === 'illustrate_answer') };
}

test('the tool reports what is still waiting, so the agent knows when it is done', async () => {
  const { box, tool } = toolFor(played(1));
  const first = (await tool.execute({ round: 1, whose: 'agent', images: four() }, {})).content[0].text;
  assert.match(first, /round 1 \(human\)/, 'it should name what is left');

  const second = (await tool.execute({ round: 1, whose: 'human', images: four('h') }, {})).content[0].text;
  assert.match(second, /gallery is complete/);
  assert.equal(unillustrated(box.doc).length, 0);
});

test('the tool refuses in words the agent can act on', async () => {
  const { tool } = toolFor(played(1));
  const out = (await tool.execute({ round: 4, whose: 'agent', images: four() }, {})).content[0].text;
  assert.match(out, /^refused:/);
  assert.match(out, /has not been revealed/);
});

test('the refusal reaches the log, because the run record is the evidence', () => {
  const doc = illustrate(played(), { round: 7 }).doc;
  const last = doc.log[doc.log.length - 1];
  assert.equal(last.action, 'illustrate');
  assert.equal(last.outcome, 'refused');
  assert.equal(last.actor, 'agent');
});
