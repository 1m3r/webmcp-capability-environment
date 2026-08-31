import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/state.js';
import { buildTools, TOOL_DEFS, GLOBAL_TOOLS } from '../src/tools.js';
import { PHASES } from '../src/phases.js';

function ctx(patch = {}) {
  const store = createStore({});
  if (patch.seed) store.mutate({ actor: 'test', kind: 'seed', touched: [] }, patch.seed);
  return { store };
}
const call = (tools, name, args) => tools.find((t) => t.name === name).execute(args);
const textOf = (r) => r.content[0].text;

test('every tool named by a phase config exists in TOOL_DEFS', () => {
  for (const phase of PHASES) {
    for (const name of phase.tools) assert.ok(TOOL_DEFS[name], `phase "${phase.id}" names missing tool "${name}"`);
  }
  for (const name of GLOBAL_TOOLS) assert.ok(TOOL_DEFS[name], `missing global tool "${name}"`);
});

test('there is no tool for human authority anywhere in TOOL_DEFS', () => {
  for (const name of Object.keys(TOOL_DEFS)) {
    assert.ok(!/^(answer|resolve_decision|approve|accept|declare|unlock|set_phase|advance_phase)$/.test(name),
      `"${name}" would hand the agent authority that belongs to the human`);
  }
});

test('a phase exposes its own tools plus the three global ones, and nothing else', () => {
  const tools = buildTools('intake', ctx());
  assert.deepEqual(tools.map((t) => t.name).sort(), ['get_phase_guide', 'get_state', 'load_concept', 'record_intake', 'request_advance'].sort());
});

test('a phase does not expose another phase\'s tools', () => {
  const names = buildTools('intake', ctx()).map((t) => t.name);
  assert.ok(!names.includes('add_task'));
  assert.ok(!names.includes('ask_question'));
});

test('every tool object is shaped the way a WebMCP client expects', () => {
  for (const phase of PHASES) {
    for (const tool of buildTools(phase.id, ctx())) {
      assert.equal(typeof tool.name, 'string');
      assert.ok(tool.description.length > 20, `${tool.name} needs a real description — it is the only steering the page owns`);
      assert.equal(tool.inputSchema.type, 'object');
      assert.equal(typeof tool.execute, 'function');
    }
  }
});

test('execute accepts arguments wrapped or bare', async () => {
  const c = ctx();
  const tools = buildTools('intake', c);
  await call(tools, 'load_concept', {});
  await call(tools, 'record_intake', { arguments: { summary: 'wrapped', knowns: [], unknowns: ['x'], assumptions: [] } });
  assert.equal(c.store.get().intake.summary, 'wrapped');
  await call(tools, 'record_intake', { summary: 'bare', knowns: [], unknowns: ['x'], assumptions: [] });
  assert.equal(c.store.get().intake.summary, 'bare');
});

test('get_state reports the version, the phase, and the current gate verdict', async () => {
  const c = ctx();
  const out = JSON.parse(textOf(await call(buildTools('intake', c), 'get_state', {})));
  assert.equal(out.version, 0);
  assert.equal(out.phase, 'intake');
  assert.equal(out.gate.ok, false);
  assert.ok(out.gate.failed.some((f) => f.id === 'concept_loaded'));
});

test('get_phase_guide returns the guide for the phase the workspace is in', async () => {
  const c = ctx();
  const out = textOf(await call(buildTools('intake', c), 'get_phase_guide', {}));
  assert.match(out, /PHASE 0 — INTAKE/);
});

test('request_advance refuses while a check fails, and names the offenders', async () => {
  const c = ctx();
  const out = textOf(await call(buildTools('intake', c), 'request_advance', {}));
  assert.match(out, /not open/i);
  assert.match(out, /concept_loaded/);
  assert.equal(c.store.get().pendingAdvance, null);
  assert.equal(c.store.get().phase, 'intake');
});

test('request_advance queues a transition when the gate opens, and never advances by itself', async () => {
  /* the human drops the file; load_concept only READS it */
  const c = ctx({ seed: (d) => { d.concept = { name: 'brief.md', text: 'a subscription site' }; } });
  const tools = buildTools('intake', c);
  await call(tools, 'load_concept', {});
  await call(tools, 'record_intake', { summary: 'a subscription site', knowns: ['audience'], unknowns: ['budget'], assumptions: [] });

  const out = textOf(await call(tools, 'request_advance', {}));
  assert.match(out, /confirm/i);
  assert.equal(c.store.get().pendingAdvance.to, 'interrogate');
  assert.equal(c.store.get().phase, 'intake', 'the agent must never move the journey itself');
});

test('a stale write is rejected with the current version and what changed', async () => {
  const c = ctx();
  const tools = buildTools('intake', c);
  c.store.mutate({ actor: 'human', kind: 'load_concept', touched: ['concept'] }, (d) => { d.concept = { name: 'b.md', text: 'x' }; });   // version 1
  c.store.mutate({ actor: 'human', kind: 'answer', touched: ['questions.q1'] }, (d) => { d.questions.push({ id: 'q1', answer: 'yes' }); }); // version 2

  const out = textOf(await call(tools, 'record_intake', { expectedVersion: 1, summary: 's', knowns: [], unknowns: ['x'], assumptions: [] }));
  assert.match(out, /STALE_STATE/);
  assert.match(out, /questions\.q1/);
  assert.equal(c.store.get().intake, null, 'a rejected write must not land');
});

test('ask_question records a question the agent cannot answer', async () => {
  const c = ctx({ seed: (d) => { d.phase = 'interrogate'; } });
  const tools = buildTools('interrogate', c);
  await call(tools, 'ask_question', { text: 'who is this for?', why: 'it decides the tone', options: ['roasters', 'drinkers'], addresses: 'audience' });
  const q = c.store.get().questions[0];
  assert.equal(q.text, 'who is this for?');
  assert.equal(q.answer, null);
});

test('nothing in the interrogate phase can write an answer', async () => {
  const c = ctx({ seed: (d) => { d.phase = 'interrogate'; } });
  const tools = buildTools('interrogate', c);
  await call(tools, 'ask_question', { text: 'who?', why: 'tone' });

  /* get_answers reads; it must not write. Drive every tool in the phase with
     an answer-shaped payload and assert the question stays unanswered. */
  const before = c.store.version;
  await call(tools, 'get_answers', { id: 'q1', answer: 'roasters' });
  assert.equal(c.store.version, before, 'get_answers must be read-only');
  assert.equal(c.store.get().questions[0].answer, null);

  for (const tool of tools) {
    await tool.execute({ id: 'q1', questionId: 'q1', answer: 'roasters', value: 'roasters' });
  }
  assert.equal(c.store.get().questions[0].answer, null, 'no tool in this phase may answer a question');
});

test('validate_plan reports the plan phase verdict without mutating anything', async () => {
  const c = ctx({ seed: (d) => { d.phase = 'plan'; d.tasks.push({ id: 'T1', title: 'x', deps: [], acceptance: '', tracesTo: [] }); } });
  const before = c.store.version;
  const out = textOf(await call(buildTools('plan', c), 'validate_plan', {}));
  assert.match(out, /plan_acceptance/);
  assert.equal(c.store.version, before);
});

test('check_ready reports every phase, not only the current one', async () => {
  const c = ctx({ seed: (d) => { d.phase = 'ship'; } });
  const out = JSON.parse(textOf(await call(buildTools('ship', c), 'check_ready', {})));
  assert.equal(out.ready, false);
  assert.deepEqual(Object.keys(out.phases), PHASES.map((p) => p.id));
});

test('a tool refuses when the workspace has moved on from its phase', async () => {
  const c = ctx();
  const intakeTools = buildTools('intake', c);
  c.store.mutate({ actor: 'human', kind: 'confirm_advance', touched: ['phase'] }, (d) => { d.phase = 'interrogate'; });

  const out = textOf(await call(intakeTools, 'record_intake', { summary: 's', knowns: [], unknowns: ['x'], assumptions: [] }));
  assert.match(out, /belongs to the "intake" phase/);
  assert.equal(c.store.get().intake, null, 'an out-of-phase call must not write');
});

test('the global tools work in every phase', async () => {
  const c = ctx();
  const intakeTools = buildTools('intake', c);
  c.store.mutate({ actor: 'human', kind: 'confirm_advance', touched: ['phase'] }, (d) => { d.phase = 'ship'; });
  const out = textOf(await call(intakeTools, 'get_state', {}));
  assert.match(out, /"phase": "ship"/);
});
