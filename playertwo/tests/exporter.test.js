import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDoc, reduce } from '../src/games/mirror/game.js';
import { renderPortrait } from '../src/games/mirror/render.js';
import { buildExport } from '../src/exporter.js';
import { open, afterOne } from './helpers.js';

function playedDoc() {
  let doc = open(createDoc(0, { mode: 'both' }));
  doc = reduce(doc, { type: 'agent_submit', text: 'a lighthouse' }).doc;
  doc = reduce(doc, { type: 'human_submit', text: 'a harbour' }).doc;
  doc = reduce(doc, { type: 'reveal' }).doc;
  return reduce(doc, { type: 'judge', verdict: 'missed' }).doc;
}

test('the export is three files', () => {
  const files = buildExport(playedDoc(), renderPortrait, '2026-08-31T00:00:00Z');
  assert.deepEqual(files.map((f) => f.name), ['mirror.json', 'portrait.md', 'journey.json']);
});

test('the state file round-trips as JSON and carries the export time', () => {
  const files = buildExport(playedDoc(), renderPortrait, '2026-08-31T00:00:00Z');
  const parsed = JSON.parse(files[0].body);
  assert.equal(parsed.exportedAt, '2026-08-31T00:00:00Z');
  assert.equal(parsed.rounds[0].agentAnswer, 'a lighthouse');
  assert.equal(parsed.schema, 2);
});

test('the portrait sets both columns side by side', () => {
  const md = buildExport(playedDoc(), renderPortrait, 'x')[1].body;
  assert.match(md, /a lighthouse/);
  assert.match(md, /a harbour/);
  assert.match(md, /Missed/);
});

test('the portrait carries the closed sittings with their grants', () => {
  const md = buildExport(afterOne('perspective', 'sealed'), renderPortrait, 'x')[1].body;
  assert.match(md, /Sitting 1 — First light \(sealed\)/);
  assert.match(md, /1 sitting closed/);
});

test('the journey carries every entry with its actor, so a run is reconstructable', () => {
  const doc = playedDoc();
  const journey = JSON.parse(buildExport(doc, renderPortrait, 'x')[2].body);
  assert.equal(journey.log.length, doc.log.length);
  assert.ok(journey.log.every((e) => e.actor && e.action && e.outcome));
  assert.ok(journey.log.some((e) => e.actor === 'agent'));
  assert.ok(journey.log.some((e) => e.actor === 'human'));
});

test('an untouched portrait still exports without throwing', () => {
  const files = buildExport(createDoc(), renderPortrait, 'x');
  assert.equal(files.length, 3);
  assert.ok(files.every((f) => typeof f.body === 'string'));
});
