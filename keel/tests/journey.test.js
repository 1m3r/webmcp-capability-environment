import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/state.js';
import { buildTools } from '../src/tools.js';
import { PHASES } from '../src/phases.js';
import { gateStatus, CRITIQUE_CHECKLIST } from '../src/checks.js';
import { buildExport } from '../src/exporter.js';

function makeWorkspace() {
  const store = createStore({});
  const ctx = { store };
  const agent = async (name, args = {}) => {
    const phase = store.get().phase;
    const tool = buildTools(phase, ctx).find((t) => t.name === name);
    assert.ok(tool, `no tool "${name}" in phase "${phase}"`);
    return (await tool.execute(args)).content[0].text;
  };
  const human = (kind, fn, touched = []) => store.mutate({ actor: 'human', kind, touched }, fn);
  /* the shell's confirm button, and nothing more than it does */
  const confirm = () => human('confirm_advance', (d) => {
    assert.ok(d.pendingAdvance, 'nothing was queued to confirm');
    d.phase = d.pendingAdvance.to;
    d.pendingAdvance = null;
  }, ['phase']);
  return { store, ctx, agent, human, confirm };
}

test('the journey runs end to end, and every phase boundary needs a human', async () => {
  const { store, agent, human, confirm } = makeWorkspace();

  /* --- 0 intake --- */
  human('load_concept', (d) => { d.concept = { name: 'brief.md', text: 'A subscription site for a coffee roaster.' }; }, ['concept']);
  await agent('load_concept');
  await agent('record_intake', { summary: 'A subscription site for a small coffee roaster.', knowns: ['the audience'], unknowns: ['budget'], assumptions: [] });
  assert.match(await agent('request_advance'), /confirm/i);
  assert.equal(store.get().phase, 'intake', 'the agent must not move the journey');
  confirm();
  assert.equal(store.get().phase, 'interrogate');

  /* --- 1 interrogate --- */
  await agent('ask_question', { text: 'What is the budget?', why: 'it decides the scope', options: ['under 5k', 'over 5k'], addresses: 'budget' });
  assert.match(await agent('request_advance'), /not open/i);
  human('answer', (d) => { d.questions[0].answer = 'under 5k'; }, ['questions.q1']);
  await agent('request_advance');
  confirm();

  /* --- 2 research --- */
  await agent('mark_claim', { text: 'Static hosting is enough for this traffic.', loadBearing: true });
  assert.match(await agent('request_advance'), /not open/i);
  await agent('add_evidence', { claimId: 'c1', source: 'https://example.test/traffic-report', note: 'peak 40 requests a minute' });
  await agent('request_advance');
  confirm();

  /* --- 3 decide --- */
  await agent('propose_decision', {
    question: 'Which stack?',
    options: [{ label: 'vanilla', tradeoffs: 'no build step, more handwritten code' }, { label: 'react', tradeoffs: 'faster components, a build step to maintain' }],
    recommendation: 'vanilla',
    rationale: 'the budget answer rules out maintaining a toolchain',
  });
  assert.match(await agent('request_advance'), /not open/i);
  human('resolve_decision', (d) => {
    const dec = d.decisions[0];
    dec.chosen = 'vanilla';
    dec.locked = true;
    dec.rejected = [{ option: 'react', reason: 'a build step to maintain' }];
  }, ['decisions.d1']);
  await agent('request_advance');
  confirm();

  /* --- 4 plan --- */
  await agent('add_task', { id: 'T1', title: 'Build the subscription form', acceptance: 'a submitted form creates a subscription record', tracesTo: ['q1'] });
  assert.match(await agent('request_advance'), /not open/i, 'd1 is not traced to yet');
  await agent('add_task', { id: 'T2', title: 'Deploy to static hosting', deps: ['T1'], acceptance: 'the site answers on the production URL', tracesTo: ['d1'] });
  await agent('request_advance');
  confirm();

  /* --- 5 critique --- */
  for (const item of CRITIQUE_CHECKLIST) {
    await agent('file_finding', { item: item.id, severity: 'clear', claim: 'holds' });
  }
  await agent('request_advance');
  confirm();

  /* --- 6 ship --- */
  await agent('write_narrative', { sectionId: 'order-of-work', prose: 'Build the form [T1], then deploy it [T2].' });
  const ready = JSON.parse(await agent('check_ready'));
  assert.equal(ready.ready, true, 'every phase should pass by now: ' + JSON.stringify(ready.phases));
  assert.equal(await agent('request_advance'), 'This is the last phase. A human presses READY on the page; there is no tool for it.');

  /* --- the artifact --- */
  const out = buildExport(store.get());
  assert.match(out.md, /Build the form \[T1\]/);
  assert.deepEqual(out.json.order, ['T1', 'T2']);
  assert.ok(out.journey.events.some((e) => e.actor === 'human' && e.kind === 'confirm_advance'));
  assert.equal(out.journey.events.filter((e) => e.kind === 'confirm_advance').length, 6, 'six boundaries, six human confirmations');
});

test('a finding at major severity holds the critique gate shut until a human accepts it', async () => {
  const { store, agent, human } = makeWorkspace();
  store.mutate({ actor: 'test', kind: 'seed', touched: [] }, (d) => { d.phase = 'critique'; });

  for (const item of CRITIQUE_CHECKLIST) {
    await agent('file_finding', { item: item.id, severity: item.id === 'ambiguity' ? 'major' : 'clear', claim: 'x' });
  }
  assert.match(await agent('request_advance'), /not open/i);

  const finding = store.get().findings.find((f) => f.severity === 'major');
  human('accept_finding', (d) => { d.findings.find((f) => f.id === finding.id).status = 'accepted'; }, ['findings.' + finding.id]);
  assert.match(await agent('request_advance'), /confirm/i);
});

test('every phase gate is shut on an empty workspace, so no phase is decorative', () => {
  const doc = createStore({}).get();
  for (const phase of PHASES) {
    assert.equal(gateStatus(doc, phase.checks).ok, false, `phase "${phase.id}" opens on an empty workspace — its checks do not bind`);
  }
});
