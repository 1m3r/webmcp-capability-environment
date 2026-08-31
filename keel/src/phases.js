/* Phases are data. The spine renders any phase in this array; adding one is a
   config entry, and cutting one under time pressure is a deletion that leaves
   the application untouched. */

import { GUIDES } from './guides.js';

export { GUIDES };

export const PHASES = [
  { id: 'intake', title: 'Intake', guide: GUIDES.intake,
    tools: ['load_concept', 'record_intake'],
    checks: ['concept_loaded', 'intake_recorded', 'unknowns_named'] },

  { id: 'interrogate', title: 'Interrogate', guide: GUIDES.interrogate,
    tools: ['ask_question', 'get_answers'],
    checks: ['questions_asked', 'no_unanswered', 'unknowns_resolved'] },

  { id: 'research', title: 'Research', guide: GUIDES.research,
    tools: ['mark_claim', 'add_evidence', 'list_unsupported'],
    checks: ['claims_recorded', 'claims_evidenced'] },

  { id: 'decide', title: 'Decide', guide: GUIDES.decide,
    tools: ['propose_decision', 'get_decisions', 'request_decision_change'],
    checks: ['decisions_made', 'decisions_resolved', 'decisions_have_alternatives'] },

  { id: 'plan', title: 'Plan', guide: GUIDES.plan,
    tools: ['add_task', 'update_task', 'validate_plan'],
    checks: ['plan_not_empty', 'plan_acyclic', 'plan_acceptance', 'plan_refs_resolve', 'plan_covers_inputs', 'no_placeholders'] },

  { id: 'critique', title: 'Critique', guide: GUIDES.critique,
    tools: ['file_finding', 'resolve_finding', 'list_findings'],
    checks: ['critique_coverage', 'critique_clear'] },

  { id: 'ship', title: 'Ship', guide: GUIDES.ship,
    tools: ['write_narrative', 'check_ready'],
    checks: ['narrative_written', 'views_in_sync'] },
];

export function phaseById(id) { return PHASES.find((p) => p.id === id); }
export function phaseIndex(id) { return PHASES.findIndex((p) => p.id === id); }
export function nextPhaseId(id) {
  const i = phaseIndex(id);
  return i >= 0 && i < PHASES.length - 1 ? PHASES[i + 1].id : null;
}
