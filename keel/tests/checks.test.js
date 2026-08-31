import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PREDICATES, LABELS, runChecks, gateStatus } from '../src/checks.js';
import { EMPTY_DOC } from '../src/state.js';

function doc(patch) { return { ...structuredClone(EMPTY_DOC), ...patch }; }

test('concept_loaded fails on an empty document and passes once a concept is present', () => {
  assert.equal(PREDICATES.concept_loaded(doc({})).ok, false);
  assert.equal(PREDICATES.concept_loaded(doc({ concept: { name: 'brief.md', text: 'a coffee subscription' } })).ok, true);
});

test('intake_recorded requires a non-empty summary', () => {
  assert.equal(PREDICATES.intake_recorded(doc({ intake: { summary: '   ', knowns: [], unknowns: [], assumptions: [] } })).ok, false);
  assert.equal(PREDICATES.intake_recorded(doc({ intake: { summary: 'a subscription site', knowns: [], unknowns: [], assumptions: [] } })).ok, true);
});

test('unknowns_named requires at least one admitted unknown', () => {
  assert.equal(PREDICATES.unknowns_named(doc({ intake: { summary: 's', knowns: [], unknowns: [], assumptions: [] } })).ok, false);
  assert.equal(PREDICATES.unknowns_named(doc({ intake: { summary: 's', knowns: [], unknowns: ['budget'], assumptions: [] } })).ok, true);
});

test('no_unanswered names every unanswered question as an offender', () => {
  const d = doc({ questions: [
    { id: 'q1', text: 'who is this for?', answer: 'roasters' },
    { id: 'q2', text: 'what is the budget?', answer: null },
    { id: 'q3', text: 'what is the deadline?', answer: '' },
  ] });
  const r = PREDICATES.no_unanswered(d);
  assert.equal(r.ok, false);
  assert.deepEqual(r.offenders.map((o) => o.where), ['q2', 'q3']);
});

test('no_unanswered treats a deferred question as resolved', () => {
  const d = doc({ questions: [{ id: 'q2', text: 'budget?', answer: null, deferred: true }] });
  assert.equal(PREDICATES.no_unanswered(d).ok, true);
});

test('unknowns_resolved requires each intake unknown to be answered or deferred', () => {
  const d = doc({
    intake: { summary: 's', knowns: [], unknowns: ['budget', 'deadline'], assumptions: [] },
    questions: [{ id: 'q1', text: 'budget?', answer: '5k', addresses: 'budget' }],
  });
  const r = PREDICATES.unknowns_resolved(d);
  assert.equal(r.ok, false);
  assert.deepEqual(r.offenders.map((o) => o.where), ['deadline']);
});

test('claims_evidenced only polices load-bearing claims', () => {
  const d = doc({ claims: [
    { id: 'c1', text: 'agents skip interrogation', loadBearing: true, evidence: [] },
    { id: 'c2', text: 'blue is nice', loadBearing: false, evidence: [] },
  ] });
  const r = PREDICATES.claims_evidenced(d);
  assert.equal(r.ok, false);
  assert.deepEqual(r.offenders.map((o) => o.where), ['c1']);
});

test('claims_evidenced requires a source on the evidence, not merely a note', () => {
  const d = doc({ claims: [{ id: 'c1', text: 't', loadBearing: true, evidence: [{ source: '', note: 'I think so' }] }] });
  assert.equal(PREDICATES.claims_evidenced(d).ok, false);
});

test('decisions_resolved requires a human choice on every decision', () => {
  const d = doc({ decisions: [
    { id: 'd1', question: 'stack?', options: [{ label: 'a' }, { label: 'b' }], chosen: 'a', locked: true, rejected: [{ option: 'b', reason: 'heavier' }] },
    { id: 'd2', question: 'host?', options: [{ label: 'x' }, { label: 'y' }], chosen: null, locked: false, rejected: [] },
  ] });
  const r = PREDICATES.decisions_resolved(d);
  assert.equal(r.ok, false);
  assert.deepEqual(r.offenders.map((o) => o.where), ['d2']);
});

test('decisions_have_alternatives requires two options and a reason for each rejection', () => {
  const one = doc({ decisions: [{ id: 'd1', question: 'q', options: [{ label: 'a' }], chosen: 'a', locked: true, rejected: [] }] });
  assert.equal(PREDICATES.decisions_have_alternatives(one).ok, false);

  const unexplained = doc({ decisions: [{ id: 'd1', question: 'q', options: [{ label: 'a' }, { label: 'b' }], chosen: 'a', locked: true, rejected: [{ option: 'b', reason: '' }] }] });
  assert.equal(PREDICATES.decisions_have_alternatives(unexplained).ok, false);

  const good = doc({ decisions: [{ id: 'd1', question: 'q', options: [{ label: 'a' }, { label: 'b' }], chosen: 'a', locked: true, rejected: [{ option: 'b', reason: 'heavier' }] }] });
  assert.equal(PREDICATES.decisions_have_alternatives(good).ok, true);
});

test('every predicate has a label, and no label is orphaned', () => {
  assert.deepEqual(Object.keys(PREDICATES).sort(), Object.keys(LABELS).sort());
});

test('no predicate throws on a malformed document', () => {
  const junk = { version: 1 };
  for (const [id, fn] of Object.entries(PREDICATES)) {
    const r = fn(junk);
    assert.equal(typeof r.ok, 'boolean', `${id} must return a boolean ok`);
    assert.ok(Array.isArray(r.offenders), `${id} must return an offenders array`);
  }
});

test('runChecks returns one verdict per requested id, in order', () => {
  const r = runChecks(doc({}), ['concept_loaded', 'intake_recorded']);
  assert.deepEqual(r.map((c) => c.id), ['concept_loaded', 'intake_recorded']);
  assert.equal(r[0].label, LABELS.concept_loaded);
});

test('gateStatus is closed while any check fails and open when all pass', () => {
  const empty = gateStatus(doc({}), ['concept_loaded']);
  assert.equal(empty.ok, false);
  assert.equal(empty.failed[0].id, 'concept_loaded');

  const loaded = gateStatus(doc({ concept: { name: 'b.md', text: 'x' } }), ['concept_loaded']);
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.failed, []);
});
