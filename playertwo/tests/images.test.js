/* Images travel with the answer, and the page checks them before it accepts.

   The first live run needed a nudge before the agent reached for a separate
   illustrate verb, and the results showed broken links. Both are closed here
   structurally: there is no second verb to forget, because the images are a
   slot in the call the agent must make anyway — and a url the page could not
   load is refused, by name, before the reducer ever sees it. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDoc, reduce, normaliseImage, COMPOSITION_SIZE } from '../src/games/mirror/game.js';
import { buildTools } from '../src/games/mirror/tools.js';
import { createWaitRegistry } from '../src/waiters.js';
import { open } from './helpers.js';

const nImages = (n, tag = 'x') => Array.from({ length: n }, (_, i) => ({
  url: `https://images.example/${tag}-${i}.jpg`,
  credit: `Photographer ${i}`,
  license: 'CC BY 4.0',
  source: `https://images.example/${tag}-${i}`
}));
const four = (tag) => nImages(COMPOSITION_SIZE, tag);

const perspective = () => open(createDoc(0, { mode: 'perspective' }));
const submit = (doc, patch = {}) =>
  reduce(doc, { type: 'agent_submit', text: 'a kettle', images: four(), ...patch });

/* ---- the reducer -------------------------------------------------------- */

test('four images commit with the answer', () => {
  const r = submit(perspective());
  assert.equal(r.ok, true, r.message);
  const round = r.doc.rounds[0];
  assert.equal(round.state, 'agent_committed');
  assert.equal(round.agentImages.length, COMPOSITION_SIZE);
  assert.equal(round.agentImages[0].credit, 'Photographer 0');
  assert.equal(round.agentImages[0].license, 'CC BY 4.0');
});

test('a read is exactly four images', () => {
  for (const n of [0, 1, 3, 5, 8]) {
    const r = submit(perspective(), { images: nImages(n) });
    assert.equal(r.ok, false, `${n} images should be refused`);
    assert.equal(r.code, 'BAD_IMAGES', `${n} images gave ${r.code}`);
    assert.match(r.message, new RegExp(`had ${n}`));
  }
  assert.equal(submit(perspective(), { images: 'not an array' }).code, 'BAD_IMAGES');
  assert.equal(submit(perspective(), { images: undefined }).code, 'BAD_IMAGES');
});

test('a url the page could not load is refused by name', () => {
  const r = submit(perspective(), { rejected: ['https://images.example/x-2.jpg'] });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'BAD_IMAGES');
  assert.match(r.message, /did not load/);
  assert.match(r.message, /x-2\.jpg/);
  assert.equal(r.doc.rounds[0].state, 'posed', 'a refused read leaves the round untouched');
  assert.equal(r.doc.log.at(-1).outcome, 'refused');
});

test('only http(s) urls survive, so an agent cannot inline a payload', () => {
  assert.equal(normaliseImage({ url: 'data:image/png;base64,AAAA' }), null);
  assert.equal(normaliseImage({ url: 'javascript:alert(1)' }), null);
  assert.equal(normaliseImage({ url: 'file:///etc/passwd' }), null);
  assert.equal(normaliseImage({ url: '' }), null);
  assert.equal(normaliseImage(null), null);
  assert.ok(normaliseImage({ url: 'http://example.test/a.png' }));
  assert.ok(normaliseImage({ url: 'https://example.test/a.png' }));
});

test('a rejected scheme is dropped and takes the whole read with it', () => {
  const images = four();
  images[2] = { url: 'data:image/png;base64,AAAA' };
  const r = submit(perspective(), { images });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'BAD_IMAGES', 'three usable images is not a 2x2');
  assert.match(r.message, /http or https/);
});

test('missing credit and licence default to empty rather than undefined', () => {
  const bare = Array.from({ length: 4 }, (_, i) => ({ url: `https://e.test/${i}.jpg` }));
  const doc = submit(perspective(), { images: bare }).doc;
  for (const image of doc.rounds[0].agentImages) {
    assert.equal(image.credit, '');
    assert.equal(image.license, '');
  }
});

test('both-ways and quiz answers carry no images, whatever the agent sends', () => {
  for (const mode of ['both', 'quiz']) {
    const r = reduce(open(createDoc(0, { mode })), { type: 'agent_submit', text: 'plain', images: four() });
    assert.equal(r.ok, true, r.message);
    assert.equal(r.doc.rounds[0].agentImages, null);
  }
});

test('the reasons travel with the answer', () => {
  const r = submit(perspective(), { because: '  you never turn the light off  ' });
  assert.equal(r.doc.rounds[0].agentBecause, 'you never turn the light off');
});

/* ---- the tool boundary ---------------------------------------------------- */

function harness(doc, loadImage) {
  const box = { doc };
  const ctx = {
    getDoc: () => box.doc,
    setDoc: (d) => { box.doc = d; },
    now: () => 0,
    waits: createWaitRegistry(),
    ...(loadImage ? { loadImage } : {})
  };
  return { box, submit: buildTools(ctx).find((t) => t.name === 'submit_answer') };
}

test('the perspective submit schema requires the four images, so the harness enforces the slot', () => {
  const { submit } = harness(perspective());
  assert.ok(submit.inputSchema.required.includes('images'));
  assert.equal(submit.inputSchema.properties.images.minItems, COMPOSITION_SIZE);
  assert.equal(submit.inputSchema.properties.images.maxItems, COMPOSITION_SIZE);
  assert.ok('because' in submit.inputSchema.properties);

  const { submit: both } = harness(open(createDoc(0, { mode: 'both' })));
  assert.ok(!('images' in both.inputSchema.properties), 'both-ways has no gallery, so no slot');
  assert.ok('because' in both.inputSchema.properties);

  const { submit: quiz } = harness(open(createDoc(0, { mode: 'quiz' })));
  assert.ok(!('images' in quiz.inputSchema.properties));
  assert.ok(!('because' in quiz.inputSchema.properties), 'a fact has no why');
});

test('with no loader every image passes, so Node needs no DOM', async () => {
  const { box, submit } = harness(perspective());
  const out = (await submit.execute({ text: 'a kettle', images: four() }, {})).content[0].text;
  assert.match(out, /Committed/);
  assert.equal(box.box ? 1 : box.doc.rounds[0].agentImages.length, 4);
});

test('a loader that fails one url produces a refusal naming it, logged with the agent as actor', async () => {
  const loaded = [];
  const loader = async (url) => { loaded.push(url); return !url.endsWith('x-1.jpg'); };
  const { box, submit } = harness(perspective(), loader);
  const out = (await submit.execute({ text: 'a kettle', images: four() }, {})).content[0].text;
  assert.match(out, /^refused:/);
  assert.match(out, /x-1\.jpg/);
  assert.doesNotMatch(out, /x-0\.jpg/, 'only the failures are named');
  assert.equal(loaded.length, 4, 'every image is checked, not the first failure');
  assert.equal(box.doc.rounds[0].state, 'posed');
  assert.equal(box.doc.log.at(-1).outcome, 'refused');
  assert.equal(box.doc.log.at(-1).actor, 'agent');
});

test('a loader that passes everything commits, and the reply says the reveal is coming', async () => {
  const { box, submit } = harness(perspective(), async () => true);
  const out = (await submit.execute({ text: 'a kettle', because: 'why', images: four() }, {})).content[0].text;
  assert.match(out, /Committed/);
  assert.equal(box.doc.rounds[0].agentImages.length, 4);
  assert.equal(box.doc.rounds[0].agentBecause, 'why');
});

test('a wrong count is refused without loading anything', async () => {
  let calls = 0;
  const { submit } = harness(perspective(), async () => { calls++; return true; });
  const out = (await submit.execute({ text: 'a kettle', images: nImages(2) }, {})).content[0].text;
  assert.match(out, /^refused:/);
  assert.equal(calls, 0, 'no point loading two images that cannot make a 2x2');
});

test('a loader that throws counts as a failure, not a crash', async () => {
  const { submit } = harness(perspective(), async () => { throw new Error('network'); });
  const out = (await submit.execute({ text: 'a kettle', images: four() }, {})).content[0].text;
  assert.match(out, /^refused:/);
  assert.match(out, /did not load/);
});
