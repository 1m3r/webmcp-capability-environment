import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GUIDES, PHASES, phaseById, nextPhaseId } from '../src/phases.js';
import { PREDICATES, CRITIQUE_CHECKLIST } from '../src/checks.js';

const markers = (text) => [...text.matchAll(/\[check:([a-z_]+)\]/g)].map((m) => m[1]);

test('there are seven phases, in journey order', () => {
  assert.deepEqual(PHASES.map((p) => p.id), ['intake', 'interrogate', 'research', 'decide', 'plan', 'critique', 'ship']);
});

test('PARITY: every guide marker is a configured check, and every configured check is stated in the guide', () => {
  for (const phase of PHASES) {
    const stated = [...new Set(markers(phase.guide))].sort();
    const enforced = [...phase.checks].sort();
    assert.deepEqual(stated, enforced,
      `phase "${phase.id}": the guide states [${stated}] but the gate enforces [${enforced}]. ` +
      'Prose and enforcement must not diverge.');
  }
});

test('every configured check has a real predicate behind it', () => {
  for (const phase of PHASES) {
    for (const id of phase.checks) {
      assert.ok(PREDICATES[id], `phase "${phase.id}" configures check "${id}", which has no predicate`);
    }
  }
});

test('every predicate is used by exactly one phase', () => {
  const used = PHASES.flatMap((p) => p.checks);
  assert.equal(used.length, new Set(used).size, 'a check is configured on more than one phase');
  for (const id of Object.keys(PREDICATES)) {
    assert.ok(used.includes(id), `predicate "${id}" is never used by any phase — dead enforcement`);
  }
});

test('every guide names where its method came from', () => {
  for (const phase of PHASES) {
    assert.match(phase.guide, /Source:/, `phase "${phase.id}" does not attribute its method`);
  }
});

test('the critique guide enumerates every checklist item, so coverage is achievable', () => {
  const guide = phaseById('critique').guide;
  for (const item of CRITIQUE_CHECKLIST) {
    assert.ok(guide.includes(item.id), `critique guide never names checklist item "${item.id}"`);
  }
});

test('every phase declares at least one tool and no phase declares a tool for human authority', () => {
  const forbidden = ['answer_question', 'resolve_decision', 'approve', 'accept_finding', 'declare_ready', 'cut_scope', 'set_phase'];
  for (const phase of PHASES) {
    assert.ok(phase.tools.length > 0, `phase "${phase.id}" has no tools`);
    for (const tool of phase.tools) {
      assert.ok(!forbidden.includes(tool), `phase "${phase.id}" exposes "${tool}", which is human authority`);
    }
  }
});

test('nextPhaseId walks the journey and stops at the end', () => {
  assert.equal(nextPhaseId('intake'), 'interrogate');
  assert.equal(nextPhaseId('critique'), 'ship');
  assert.equal(nextPhaseId('ship'), null);
});

test('GUIDES and PHASES agree', () => {
  for (const phase of PHASES) assert.equal(phase.guide, GUIDES[phase.id]);
});
