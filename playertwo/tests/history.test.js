/* Level 4: the history is the dossier seen lengthwise, and it obeys the same
   rule — granted sittings only, kept sittings contribute only the kept reads,
   sealed sittings contribute nothing, the sitting in play is never in it. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDoc, reduce } from '../src/games/mirror/game.js';
import { buildHistory } from '../src/games/mirror/history.js';
import { buildTools } from '../src/games/mirror/tools.js';
import { createWaitRegistry } from '../src/waiters.js';
import { open, playOut, close, four } from './helpers.js';

/* Two perspective sittings on the same deck, so every question is asked twice. */
function twice(grants = ['open', 'open']) {
  let doc = createDoc(0, { mode: 'perspective' });
  doc = close(playOut(open(doc, 'first-light'), ['me', 'not', 'me', 'not', 'me']), grants[0]);
  doc = close(playOut(open(doc, 'first-light'), ['me', 'me', 'me', 'not', 'not']), grants[1]);
  return doc;
}

test('an empty history says so', () => {
  assert.match(buildHistory(createDoc()), /no history/i);
});

test('a question asked twice shows both reads in order, with the responses', () => {
  const text = buildHistory(twice());
  assert.match(text, /What colour is this person\?  \(asked 2 times\)/);
  const colour = text.slice(text.indexOf('What colour'), text.indexOf('What animal'));
  assert.ok(colour.includes('sitting 1: agent 0'));
  assert.ok(colour.includes('sitting 2: agent 0'));
  assert.match(colour, /that’s me/);
  assert.ok(text.includes('"correction 1"'), 'a correction rides with the not-quite');
});

test('a kept sitting contributes only the reads that were kept', () => {
  const text = buildHistory(twice(['kept', 'open']));
  const start = text.indexOf('What animal');
  const animal = text.slice(start, text.indexOf('\n\n', start));
  assert.ok(!animal.includes('sitting 1:'), 'sitting 1 marked animal not-quite, and was kept — so it is absent');
  assert.ok(animal.includes('sitting 2:'));
});

test('a sealed sitting contributes nothing at all', () => {
  const text = buildHistory(twice(['sealed', 'sealed']));
  assert.match(text, /no history/i);
  const half = buildHistory(twice(['sealed', 'open']));
  assert.ok(!half.includes('sitting 1:'));
  assert.ok(half.includes('sitting 2:'));
});

test('THE LEAK TEST: the sitting in play is never in the history', () => {
  let doc = open(twice(), 'first-light');
  doc = reduce(doc, { type: 'agent_submit', text: 'zzliveread', because: 'zzlivewhy', images: four('l') }).doc;
  doc = reduce(doc, { type: 'reveal' }).doc;
  doc = reduce(doc, { type: 'judge', verdict: 'not', correction: 'zzlivecorrection' }).doc;
  const text = buildHistory(doc);
  for (const secret of ['zzliveread', 'zzlivewhy', 'zzlivecorrection']) {
    assert.ok(!text.includes(secret), `leaked ${secret}`);
  }
});

test('the tool is registered at level 4, reads the history, and logs the read', async () => {
  let doc = twice();
  doc = close(playOut(open(doc, 'deep-water')), 'open');
  assert.equal(doc.level, 4);
  const box = { doc };
  const ctx = { getDoc: () => box.doc, setDoc: (d) => { box.doc = d; }, now: () => 0, waits: createWaitRegistry() };
  const tool = buildTools(ctx).find((t) => t.name === 'get_portrait_history');
  assert.ok(tool, 'level 4 registers the history');
  const out = (await tool.execute({}, {})).content[0].text;
  assert.match(out, /asked 2 times/);
  assert.equal(box.doc.log.at(-1).detail, 'get_portrait_history');
  assert.equal(box.doc.log.at(-1).action, 'read');
});
