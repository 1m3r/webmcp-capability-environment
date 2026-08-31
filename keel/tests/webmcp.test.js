import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detect, registerTools } from '../src/webmcp.js';

test('detect prefers document.modelContext and reports which entry point it used', () => {
  const mc = { registerTool() {} };
  assert.deepEqual(detect({ document: { modelContext: mc }, navigator: {} }), { mc, entry: 'document.modelContext' });
});

test('detect falls back to navigator.modelContext', () => {
  const mc = { provideContext() {} };
  assert.deepEqual(detect({ document: {}, navigator: { modelContext: mc } }), { mc, entry: 'navigator.modelContext' });
});

test('detect returns null when there is no model context, and does not throw on a hostile scope', () => {
  assert.equal(detect({ document: {}, navigator: {} }), null);
  assert.equal(detect({ get document() { throw new Error('blocked'); }, navigator: {} }), null);
});

test('registerTools uses registerTool one tool at a time when that is what the client offers', async () => {
  const seen = [];
  const r = await registerTools({ registerTool: async (t) => seen.push(t.name) }, [{ name: 'a' }, { name: 'b' }]);
  assert.equal(r.method, 'registerTool');
  assert.equal(r.registered, 2);
  assert.deepEqual(seen, ['a', 'b']);
});

test('registerTools prefers provideContext when it exists, because it replaces the set', async () => {
  let got = null;
  const r = await registerTools({ provideContext: async (x) => { got = x; }, registerTool: async () => {} }, [{ name: 'a' }]);
  assert.equal(r.method, 'provideContext');
  assert.deepEqual(got.tools.map((t) => t.name), ['a']);
});

test('registerTools collects a per-tool failure without abandoning the rest', async () => {
  const r = await registerTools({ registerTool: async (t) => { if (t.name === 'a') throw new Error('refused'); } }, [{ name: 'a' }, { name: 'b' }]);
  assert.equal(r.registered, 1);
  assert.match(r.errors[0], /a: refused/);
});

test('registerTools reports a client that offers neither entry point', async () => {
  const r = await registerTools({}, [{ name: 'a' }]);
  assert.equal(r.method, 'none');
  assert.equal(r.registered, 0);
  assert.match(r.errors[0], /neither registerTool nor provideContext/);
});
