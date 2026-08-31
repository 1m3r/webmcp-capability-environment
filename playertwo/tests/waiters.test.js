import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWaitRegistry } from '../src/waiters.js';

test('a version already ahead resolves immediately without registering a waiter', async () => {
  const r = createWaitRegistry();
  const out = await r.wait({ since: 3, currentVersion: 7 });
  assert.deepEqual(out, { moved: true, version: 7 });
  assert.equal(r.size(), 0);
});

test('a version behind means the game was restarted', async () => {
  const r = createWaitRegistry();
  const out = await r.wait({ since: 14, currentVersion: 1 });
  assert.deepEqual(out, { reset: true, version: 1 });
});

test('a waiter resolves when notify carries a higher version', async () => {
  const r = createWaitRegistry();
  const pending = r.wait({ since: 5, currentVersion: 5 });
  assert.equal(r.size(), 1);
  r.notify(6);
  assert.deepEqual(await pending, { moved: true, version: 6 });
  assert.equal(r.size(), 0, 'the waiter must deregister itself');
});

test('a waiter resolves as reset when notify carries a lower version', async () => {
  const r = createWaitRegistry();
  const pending = r.wait({ since: 5, currentVersion: 5 });
  r.notify(1);
  assert.deepEqual(await pending, { reset: true, version: 1 });
});

test('notify with the same version wakes nobody', async () => {
  const r = createWaitRegistry();
  r.wait({ since: 5, currentVersion: 5, timeoutMs: 1000 });
  r.notify(5);
  await new Promise((res) => setTimeout(res, 20));
  assert.equal(r.size(), 1, 'a version that did not move must not wake a waiter');
});

test('a timeout resolves normally rather than throwing', async () => {
  const r = createWaitRegistry();
  const out = await r.wait({ since: 5, currentVersion: 5, timeoutMs: 1000 });
  assert.deepEqual(out, { timedOut: true, version: 5 });
  assert.equal(r.size(), 0);
});

test('the timeout is clamped into range', async () => {
  const r = createWaitRegistry();
  const started = Date.now();
  await r.wait({ since: 5, currentVersion: 5, timeoutMs: 5 });
  assert.ok(Date.now() - started >= 990, 'a tiny timeout is raised to the 1000ms floor');
});

test('dispose settles every outstanding waiter', async () => {
  const r = createWaitRegistry();
  const a = r.wait({ since: 1, currentVersion: 1 });
  const b = r.wait({ since: 2, currentVersion: 2 });
  r.dispose();
  assert.deepEqual(await a, { disposed: true });
  assert.deepEqual(await b, { disposed: true });
  assert.equal(r.size(), 0);
});

test('waiting after disposal returns disposed rather than hanging', async () => {
  const r = createWaitRegistry();
  r.dispose();
  assert.deepEqual(await r.wait({ since: 1, currentVersion: 1 }), { disposed: true });
});

test('an abort signal rejects the wait and deregisters it', async () => {
  const r = createWaitRegistry();
  const controller = new AbortController();
  const pending = r.wait({ since: 5, currentVersion: 5, signal: controller.signal });
  assert.equal(r.size(), 1);
  controller.abort(new Error('client cancelled'));
  await assert.rejects(pending, /client cancelled/);
  assert.equal(r.size(), 0);
});

test('a signal already aborted rejects without registering', async () => {
  const r = createWaitRegistry();
  const controller = new AbortController();
  controller.abort(new Error('too late'));
  await assert.rejects(
    r.wait({ since: 5, currentVersion: 5, signal: controller.signal }), /too late/);
  assert.equal(r.size(), 0);
});

test('many waiters on different versions each get the right ending', async () => {
  const r = createWaitRegistry();
  const early = r.wait({ since: 1, currentVersion: 3 });
  const at3 = r.wait({ since: 3, currentVersion: 3 });
  const at9 = r.wait({ since: 9, currentVersion: 3 });
  r.notify(4);
  assert.deepEqual(await early, { moved: true, version: 3 });
  assert.deepEqual(await at3, { moved: true, version: 4 });
  assert.deepEqual(await at9, { reset: true, version: 3 },
    'a since ahead of the current version is already a reset and never registers');
});
