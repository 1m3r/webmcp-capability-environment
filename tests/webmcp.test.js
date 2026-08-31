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
