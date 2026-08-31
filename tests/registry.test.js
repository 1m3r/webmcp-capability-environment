import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register, get, list } from '../src/registry.js';
import { mirror } from '../src/games/mirror/index.js';

test('a game missing a required part is rejected at registration', () => {
  assert.throws(() => register({ id: 'broken', title: 'Broken' }), /must supply/);
});

test('mirror registers and comes back out', () => {
  register(mirror);
  assert.equal(get('mirror').title, 'Mirror');
  assert.ok(list().some((g) => g.id === 'mirror'));
  assert.equal(get('warren'), null);
});

test('canGrant is false until four rounds are judged', () => {
  const doc = mirror.createDoc();
  assert.equal(mirror.canGrant(doc), false);
});
