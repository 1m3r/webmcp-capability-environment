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

test('mirror keeps one portrait per game, under its own key', () => {
  const keys = mirror.modes.map((mode) => mirror.storageKeyFor(mode));
  assert.equal(new Set(keys).size, mirror.modes.length, 'two games must never share a key');
  assert.ok(keys.every((k) => k !== mirror.storageKey), 'the active pointer is not a portrait');
  assert.ok(keys.every((k) => k.includes('v2')), 'a new schema gets a new key; old games die rather than migrate');
});
