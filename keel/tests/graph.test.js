import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PREDICATES, CRITIQUE_CHECKLIST, narrativeRefs } from '../src/checks.js';
import { EMPTY_DOC } from '../src/state.js';

function doc(patch) { return { ...structuredClone(EMPTY_DOC), ...patch }; }

const T = (id, patch = {}) => ({ id, title: 't ' + id, deps: [], acceptance: 'it runs', tracesTo: [], ...patch });

test('plan_acyclic passes on a chain and on a diamond', () => {
  const chain = doc({ tasks: [T('T1'), T('T2', { deps: ['T1'] }), T('T3', { deps: ['T2'] })] });
  assert.equal(PREDICATES.plan_acyclic(chain).ok, true);

  const diamond = doc({ tasks: [T('T1'), T('T2', { deps: ['T1'] }), T('T3', { deps: ['T1'] }), T('T4', { deps: ['T2', 'T3'] })] });
  assert.equal(PREDICATES.plan_acyclic(diamond).ok, true);
});

test('plan_acyclic catches a two-node cycle and names both tasks', () => {
  const d = doc({ tasks: [T('T1', { deps: ['T2'] }), T('T2', { deps: ['T1'] })] });
  const r = PREDICATES.plan_acyclic(d);
  assert.equal(r.ok, false);
  assert.deepEqual(r.offenders.map((o) => o.where).sort(), ['T1', 'T2']);
});

test('plan_acyclic catches a self-dependency', () => {
  const d = doc({ tasks: [T('T1', { deps: ['T1'] })] });
  assert.equal(PREDICATES.plan_acyclic(d).ok, false);
});

test('plan_acyclic catches a longer cycle behind an acyclic prefix', () => {
  const d = doc({ tasks: [T('T1'), T('T2', { deps: ['T1', 'T4'] }), T('T3', { deps: ['T2'] }), T('T4', { deps: ['T3'] })] });
  assert.equal(PREDICATES.plan_acyclic(d).ok, false);
});

test('plan_acceptance rejects an empty or whitespace acceptance check', () => {
  const d = doc({ tasks: [T('T1'), T('T2', { acceptance: '   ' }), T('T3', { acceptance: '' })] });
  const r = PREDICATES.plan_acceptance(d);
  assert.equal(r.ok, false);
  assert.deepEqual(r.offenders.map((o) => o.where), ['T2', 'T3']);
});

test('plan_refs_resolve catches a dependency and a trace pointing at nothing', () => {
  const d = doc({
    questions: [{ id: 'q1', text: 'who?', answer: 'roasters' }],
    tasks: [T('T1', { deps: ['T9'] }), T('T2', { tracesTo: ['d7'] })],
  });
  const r = PREDICATES.plan_refs_resolve(d);
  assert.equal(r.ok, false);
  assert.deepEqual(r.offenders.map((o) => o.detail).sort(), ['depends on T9, which does not exist', 'traces to d7, which does not exist']);
});

test('plan_covers_inputs catches an answer that no task acts on', () => {
  const d = doc({
    questions: [{ id: 'q1', text: 'who?', answer: 'roasters' }, { id: 'q2', text: 'when?', answer: 'october' }],
    decisions: [{ id: 'd1', question: 'stack?', chosen: 'vanilla', locked: true, options: [{ label: 'a' }, { label: 'b' }], rejected: [{ option: 'b', reason: 'heavy' }] }],
    tasks: [T('T1', { tracesTo: ['q1', 'd1'] })],
  });
  const r = PREDICATES.plan_covers_inputs(d);
  assert.equal(r.ok, false);
  assert.deepEqual(r.offenders.map((o) => o.where), ['q2']);
});

test('plan_covers_inputs ignores deferred questions', () => {
  const d = doc({
    questions: [{ id: 'q1', text: 'who?', answer: 'roasters' }, { id: 'q2', text: 'when?', answer: null, deferred: true }],
    tasks: [T('T1', { tracesTo: ['q1'] })],
  });
  assert.equal(PREDICATES.plan_covers_inputs(d).ok, true);
});

test('no_placeholders finds a token in any authored field and says which', () => {
  const d = doc({
    intake: { summary: 'a site, details TBD', knowns: [], unknowns: ['budget'], assumptions: [] },
    tasks: [T('T1', { acceptance: 'TODO' })],
    narrative: { overview: 'we will decide later' },
  });
  const r = PREDICATES.no_placeholders(d);
  assert.equal(r.ok, false);
  const wheres = r.offenders.map((o) => o.where).sort();
  assert.deepEqual(wheres, ['intake.summary', 'narrative.overview', 'tasks.T1.acceptance']);
});

test('no_placeholders passes on clean prose', () => {
  const d = doc({ intake: { summary: 'a subscription site for a coffee roaster', knowns: [], unknowns: ['budget'], assumptions: [] } });
  assert.equal(PREDICATES.no_placeholders(d).ok, true);
});

test('SUBSTANCE: a violation-only gate opens on an empty workspace, so each phase carries a substance check', () => {
  const empty = doc({});
  /* these are the five that would otherwise pass vacuously */
  assert.equal(PREDICATES.questions_asked(empty).ok, false);
  assert.equal(PREDICATES.claims_recorded(empty).ok, false);
  assert.equal(PREDICATES.decisions_made(empty).ok, false);
  assert.equal(PREDICATES.plan_not_empty(empty).ok, false);
  assert.equal(PREDICATES.narrative_written(empty).ok, false);
});

test('a substance check passes as soon as the phase has any real content', () => {
  assert.equal(PREDICATES.questions_asked(doc({ questions: [{ id: 'q1', text: 'who?' }] })).ok, true);
  assert.equal(PREDICATES.claims_recorded(doc({ claims: [{ id: 'c1', text: 't', loadBearing: true, evidence: [] }] })).ok, true);
  assert.equal(PREDICATES.claims_recorded(doc({ claims: [{ id: 'c1', text: 't', loadBearing: false, evidence: [] }] })).ok, false,
    'a preference is not a claim the blueprint rests on');
  assert.equal(PREDICATES.decisions_made(doc({ decisions: [{ id: 'd1', question: 'q', options: [] }] })).ok, true);
  assert.equal(PREDICATES.plan_not_empty(doc({ tasks: [T('T1')] })).ok, true);
  assert.equal(PREDICATES.narrative_written(doc({ narrative: { overview: 'a paragraph' } })).ok, true);
  assert.equal(PREDICATES.narrative_written(doc({ narrative: { overview: '   ' } })).ok, false);
});

test('critique_coverage requires a verdict on every checklist item', () => {
  const partial = doc({ findings: [{ id: 'f1', item: CRITIQUE_CHECKLIST[0].id, severity: 'clear', status: 'resolved' }] });
  const r = PREDICATES.critique_coverage(partial);
  assert.equal(r.ok, false);
  assert.equal(r.offenders.length, CRITIQUE_CHECKLIST.length - 1);

  const full = doc({ findings: CRITIQUE_CHECKLIST.map((c, i) => ({ id: 'f' + i, item: c.id, severity: 'clear', status: 'resolved' })) });
  assert.equal(PREDICATES.critique_coverage(full).ok, true);
});

test('critique_clear blocks on open major and blocking findings only', () => {
  const minor = doc({ findings: [{ id: 'f1', item: 'ambiguity', severity: 'minor', status: 'open' }] });
  assert.equal(PREDICATES.critique_clear(minor).ok, true);

  const major = doc({ findings: [{ id: 'f2', item: 'ambiguity', severity: 'major', status: 'open' }] });
  assert.equal(PREDICATES.critique_clear(major).ok, false);

  const accepted = doc({ findings: [{ id: 'f2', item: 'ambiguity', severity: 'major', status: 'accepted' }] });
  assert.equal(PREDICATES.critique_clear(accepted).ok, true);
});

test('narrativeRefs extracts unique task ids from prose', () => {
  const d = doc({ narrative: { a: 'first [T1] then [T2]', b: 'again [T1]' } });
  assert.deepEqual(narrativeRefs(d).sort(), ['T1', 'T2']);
});

test('views_in_sync fails both ways and says which way', () => {
  const orphanRef = doc({ tasks: [T('T1')], narrative: { a: 'do [T1] and [T9]' } });
  const r1 = PREDICATES.views_in_sync(orphanRef);
  assert.equal(r1.ok, false);
  assert.match(r1.offenders[0].detail, /narrative refers to T9/);

  const unmentioned = doc({ tasks: [T('T1'), T('T2')], narrative: { a: 'do [T1]' } });
  const r2 = PREDICATES.views_in_sync(unmentioned);
  assert.equal(r2.ok, false);
  assert.match(r2.offenders[0].detail, /never mentioned in the narrative/);

  const good = doc({ tasks: [T('T1'), T('T2')], narrative: { a: 'do [T1] then [T2]' } });
  assert.equal(PREDICATES.views_in_sync(good).ok, true);
});
