import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderNarrative, renderGraph, topoSort } from '../src/views.js';
import { buildExport } from '../src/exporter.js';
import { EMPTY_DOC } from '../src/state.js';

const T = (id, patch = {}) => ({ id, title: 't ' + id, deps: [], acceptance: 'it runs', tracesTo: [], ...patch });
function doc(patch) { return { ...structuredClone(EMPTY_DOC), ...patch }; }

test('topoSort orders dependencies before dependents', () => {
  const order = topoSort([T('T3', { deps: ['T2'] }), T('T1'), T('T2', { deps: ['T1'] })]);
  assert.deepEqual(order, ['T1', 'T2', 'T3']);
});

test('topoSort returns null on a cycle rather than looping forever', () => {
  assert.equal(topoSort([T('T1', { deps: ['T2'] }), T('T2', { deps: ['T1'] })]), null);
});

test('renderGraph carries the ordering and the inputs each task serves', () => {
  const d = doc({
    questions: [{ id: 'q1', text: 'who?', answer: 'roasters' }],
    tasks: [T('T2', { deps: ['T1'], tracesTo: ['q1'] }), T('T1', { tracesTo: ['q1'] })],
  });
  const g = renderGraph(d);
  assert.deepEqual(g.order, ['T1', 'T2']);
  assert.equal(g.tasks.length, 2);
  assert.equal(g.inputs.q1.text, 'who?');
});

test('renderNarrative includes the intake summary, the decisions and the prose', () => {
  const d = doc({
    intake: { summary: 'a subscription site', knowns: [], unknowns: ['budget'], assumptions: [] },
    decisions: [{ id: 'd1', question: 'stack?', chosen: 'vanilla', rationale: 'no build step', options: [{ label: 'vanilla' }, { label: 'react' }], rejected: [{ option: 'react', reason: 'a build step for six components' }], locked: true }],
    tasks: [T('T1')],
    narrative: { overview: 'we build it in order, starting with [T1].' },
  });
  const md = renderNarrative(d);
  assert.match(md, /a subscription site/);
  assert.match(md, /no build step/);
  assert.match(md, /a build step for six components/);
  assert.match(md, /starting with \[T1\]/);
});

test('renderNarrative records rejected options, which is the point of keeping them', () => {
  const d = doc({ decisions: [{ id: 'd1', question: 'host?', chosen: 'static', rationale: 'nothing to fail', options: [{ label: 'static' }, { label: 'node' }], rejected: [{ option: 'node', reason: 'a server to keep alive on demo day' }], locked: true }] });
  assert.match(renderNarrative(d), /a server to keep alive on demo day/);
});

test('buildExport produces the narrative, the graph and the event journey', () => {
  const d = doc({
    intake: { summary: 's', knowns: [], unknowns: ['u'], assumptions: [] },
    tasks: [T('T1')],
    narrative: { overview: 'do [T1]' },
    events: [{ version: 1, at: '2026-08-31T10:00:00.000Z', actor: 'agent', kind: 'record_intake', detail: '' }],
  });
  const out = buildExport(d);
  assert.match(out.md, /do \[T1\]/);
  assert.equal(out.json.order[0], 'T1');
  assert.equal(out.journey.events.length, 1);
  assert.equal(out.journey.events[0].actor, 'agent');
});

test('an empty document still exports without throwing', () => {
  const out = buildExport(doc({}));
  assert.equal(typeof out.md, 'string');
  assert.deepEqual(out.json.order, []);
});
