import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, EMPTY_DOC } from '../src/state.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
  };
}

test('a fresh store starts at version 0', () => {
  const store = createStore({ storage: memoryStorage() });
  assert.equal(store.version, 0);
  assert.equal(store.get().phase, 'intake');
});

test('get() returns a copy, so callers cannot mutate the document', () => {
  const store = createStore({ storage: memoryStorage() });
  const doc = store.get();
  doc.phase = 'ship';
  assert.equal(store.get().phase, 'intake');
});

test('mutate bumps the version and applies the change', () => {
  const store = createStore({ storage: memoryStorage() });
  const r = store.mutate(
    { actor: 'agent', kind: 'record_intake', touched: ['intake'] },
    (d) => { d.intake = { summary: 'a coffee subscription site', knowns: [], unknowns: ['budget'], assumptions: [] }; }
  );
  assert.equal(r.ok, true);
  assert.equal(r.version, 1);
  assert.equal(store.get().intake.summary, 'a coffee subscription site');
});

test('a mutation carrying the current version succeeds', () => {
  const store = createStore({ storage: memoryStorage() });
  const r = store.mutate({ expectedVersion: 0, actor: 'agent', kind: 'x', touched: ['tasks'] }, (d) => { d.tasks.push({ id: 'T1' }); });
  assert.equal(r.ok, true);
});

test('a stale mutation is rejected and names what changed', () => {
  const store = createStore({ storage: memoryStorage() });
  store.mutate({ actor: 'agent', kind: 'a', touched: ['tasks'] }, (d) => { d.tasks.push({ id: 'T1' }); });
  store.mutate({ actor: 'human', kind: 'b', touched: ['questions.q4'] }, (d) => { d.questions.push({ id: 'q4' }); });

  const r = store.mutate({ expectedVersion: 1, actor: 'agent', kind: 'c', touched: ['tasks'] }, (d) => { d.tasks.push({ id: 'T2' }); });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'STALE_STATE');
  assert.equal(r.currentVersion, 2);
  assert.deepEqual(r.changed, ['questions.q4']);
});

test('a rejected mutation leaves the document untouched', () => {
  const store = createStore({ storage: memoryStorage() });
  store.mutate({ actor: 'human', kind: 'a', touched: ['questions'] }, (d) => { d.questions.push({ id: 'q1' }); });
  store.mutate({ expectedVersion: 0, actor: 'agent', kind: 'b', touched: ['tasks'] }, (d) => { d.tasks.push({ id: 'T1' }); });
  assert.equal(store.get().tasks.length, 0);
  assert.equal(store.version, 1);
});

test('a throwing mutation rolls back and does not bump the version', () => {
  const store = createStore({ storage: memoryStorage() });
  assert.throws(() => store.mutate({ actor: 'agent', kind: 'boom', touched: [] }, () => { throw new Error('boom'); }));
  assert.equal(store.version, 0);
  assert.equal(store.get().tasks.length, 0);
});

test('every accepted mutation appends one event', () => {
  const store = createStore({ storage: memoryStorage() });
  store.mutate({ actor: 'agent', kind: 'record_intake', detail: 'summary written', touched: ['intake'] }, (d) => { d.intake = { summary: 's', knowns: [], unknowns: [], assumptions: [] }; });
  const events = store.get().events;
  assert.equal(events.length, 1);
  assert.equal(events[0].actor, 'agent');
  assert.equal(events[0].kind, 'record_intake');
  assert.equal(events[0].version, 1);
});

test('state round-trips through storage', () => {
  const storage = memoryStorage();
  const a = createStore({ storage });
  a.mutate({ actor: 'human', kind: 'answer', touched: ['questions'] }, (d) => { d.questions.push({ id: 'q1', answer: 'yes' }); });
  const b = createStore({ storage });
  assert.equal(b.version, 1);
  assert.equal(b.get().questions[0].answer, 'yes');
});

test('EMPTY_DOC has every collection the checks read', () => {
  for (const key of ['questions', 'claims', 'decisions', 'tasks', 'findings', 'events']) {
    assert.ok(Array.isArray(EMPTY_DOC[key]), `${key} must be an array`);
  }
  assert.equal(typeof EMPTY_DOC.narrative, 'object');
});
