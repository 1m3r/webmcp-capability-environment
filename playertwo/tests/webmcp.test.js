import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detect, registerTools, reregister } from '../src/webmcp.js';

const tool = (name) => ({ name, description: 'x', inputSchema: { type: 'object', properties: {} }, execute: async () => ({ content: [] }) });

test('detect prefers document.modelContext and reports the entry point', () => {
  const mc = {};
  const found = detect({ document: { modelContext: mc }, navigator: { modelContext: {} } });
  assert.equal(found.mc, mc);
  assert.equal(found.entry, 'document.modelContext');
});

test('detect falls back to navigator.modelContext', () => {
  const mc = {};
  const found = detect({ navigator: { modelContext: mc } });
  assert.equal(found.mc, mc);
  assert.equal(found.entry, 'navigator.modelContext');
});

test('detect returns null with no model context, and does not throw on a hostile scope', () => {
  assert.equal(detect({}), null);
  const hostile = { get document() { throw new Error('nope'); }, get navigator() { throw new Error('nope'); } };
  assert.equal(detect(hostile), null);
});

test('registerTools prefers registerTool, one tool at a time', async () => {
  const calls = [];
  const mc = { registerTool: async (t) => { calls.push(t.name); } };
  const result = await registerTools(mc, [tool('a'), tool('b')]);
  assert.equal(result.method, 'registerTool');
  assert.equal(result.registered, 2);
  assert.deepEqual(calls, ['a', 'b']);
  assert.deepEqual(result.errors, []);
});

test('registerTools falls back to provideContext when registerTool is absent', async () => {
  let given = null;
  const mc = { provideContext: async (payload) => { given = payload; } };
  const result = await registerTools(mc, [tool('a'), tool('b')]);
  assert.equal(result.method, 'provideContext');
  assert.equal(result.registered, 2);
  assert.deepEqual(given.tools.map((t) => t.name), ['a', 'b']);
});

test('one failing tool does not abandon the rest', async () => {
  const mc = { registerTool: async (t) => { if (t.name === 'a') throw new Error('rejected'); } };
  const result = await registerTools(mc, [tool('a'), tool('b')]);
  assert.equal(result.registered, 1);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /^a: rejected/);
});

test('a client offering neither entry point is reported rather than thrown', async () => {
  const result = await registerTools({}, [tool('a')]);
  assert.equal(result.method, 'none');
  assert.equal(result.registered, 0);
  assert.match(result.errors[0], /neither registerTool nor provideContext/);
});

test('re-registration adds only the new tool when registerTool is additive', async () => {
  const calls = [];
  const mc = { registerTool: async (t) => { calls.push(t.name); } };
  await reregister(mc, [tool('a'), tool('b'), tool('c')], ['a', 'b']);
  assert.deepEqual(calls, ['c'], 'registering a tool twice is at best wasteful and at worst an error');
});

test('re-registration re-provides the whole set when provideContext replaces it', async () => {
  let given = null;
  const mc = { provideContext: async (payload) => { given = payload; } };
  await reregister(mc, [tool('a'), tool('b'), tool('c')], ['a', 'b']);
  assert.deepEqual(given.tools.map((t) => t.name), ['a', 'b', 'c']);
});

/* ---- the surface changes shape, not just size ---------------------------

   Found by a live agent, not by these tests. Tools register on arrival, before
   the human has picked a game, so submit_answer was built with no mode and
   carried only `text`. Picking Perspective rebuilt the surface correctly and
   reregister skipped every tool whose NAME was already registered — so the
   agent went on holding a submit_answer with no image slot, could not commit a
   read, and said so on the shared screen.

   A name is not a tool. These tests compare bodies. */

import { signatureOf } from '../src/webmcp.js';

const shaped = (name, schema) => ({
  name,
  description: 'x'.repeat(30),
  inputSchema: schema,
  execute: async () => ({ content: [] })
});

const TEXT_ONLY = { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] };
const WITH_IMAGES = {
  type: 'object',
  properties: { text: { type: 'string' }, images: { type: 'array' } },
  required: ['text', 'images']
};

function client() {
  const registered = new Map();
  return {
    registered,
    mc: {
      registerTool: async (t) => { registered.set(t.name, t); },
      unregisterTool: async (name) => { registered.delete(name); }
    }
  };
}

test('signatureOf changes when the schema does, and not when nothing does', () => {
  assert.equal(signatureOf(shaped('a', TEXT_ONLY)), signatureOf(shaped('a', TEXT_ONLY)));
  assert.notEqual(signatureOf(shaped('a', TEXT_ONLY)), signatureOf(shaped('a', WITH_IMAGES)));
});

test('THE LIVE-RUN BUG: a tool whose schema changed is registered again', async () => {
  const c = client();
  const before = [shaped('submit_answer', TEXT_ONLY)];
  await registerTools(c.mc, before);
  assert.ok(!('images' in c.registered.get('submit_answer').inputSchema.properties));

  const after = [shaped('submit_answer', WITH_IMAGES)];
  const result = await reregister(c.mc, after, before);

  assert.equal(result.registered, 1, 'the changed tool must reach the client');
  assert.ok('images' in c.registered.get('submit_answer').inputSchema.properties,
    'the agent must end up holding the schema the game actually built');
  assert.deepEqual(result.errors, []);
});

test('an unchanged tool is not registered twice', async () => {
  const c = client();
  const tools = [shaped('get_round', TEXT_ONLY), shaped('say', TEXT_ONLY)];
  await registerTools(c.mc, tools);
  const result = await reregister(c.mc, tools, tools);
  assert.equal(result.registered, 0, 'registering a tool twice is at best wasteful');
});

test('a verb the game no longer offers is unregistered, not left standing', async () => {
  const c = client();
  const before = [shaped('get_round', TEXT_ONLY), shaped('get_dossier', TEXT_ONLY)];
  await registerTools(c.mc, before);

  const after = [shaped('get_round', TEXT_ONLY)];
  await reregister(c.mc, after, before);

  assert.deepEqual([...c.registered.keys()], ['get_round'],
    'authority is the absence of a tool, so a withdrawn verb must actually be absent');
});

test('a client that cannot unregister is reported rather than passed over', async () => {
  const registered = new Map();
  const mc = { registerTool: async (t) => { registered.set(t.name, t); } };
  const before = [shaped('get_dossier', TEXT_ONLY)];
  await registerTools(mc, before);
  const result = await reregister(mc, [], before);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /cannot unregister/);
});

test('provideContext is handed the whole set, which is both the update and the removal', async () => {
  let given = null;
  const mc = { provideContext: async (payload) => { given = payload; } };
  const after = [shaped('submit_answer', WITH_IMAGES)];
  await reregister(mc, after, [shaped('submit_answer', TEXT_ONLY), shaped('gone', TEXT_ONLY)]);
  assert.deepEqual(given.tools.map((t) => t.name), ['submit_answer']);
  assert.ok('images' in given.tools[0].inputSchema.properties);
});
