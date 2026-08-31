/* The gate engine. Pure: a document in, verdicts out. It never writes and never
   imports the store, which is what lets the journey test drive every gate
   without a browser.

   Two rules hold for every predicate in this file:
     1. It never throws. A malformed document returns ok:false with offenders,
        because a gate that crashes on bad input teaches the agent nothing.
     2. Its prose lives in LABELS beside it, and that same prose is what the
        phase guide states. keel/tests/guides.test.js enforces the pairing. */

const arr = (v) => (Array.isArray(v) ? v : []);
const str = (v) => (typeof v === 'string' ? v : '');
const filled = (v) => str(v).trim().length > 0;

const pass = () => ({ ok: true, offenders: [] });
const fail = (offenders) => ({ ok: offenders.length === 0, offenders });

export const LABELS = {
  concept_loaded: 'A concept brief has been loaded into the workspace.',
  intake_recorded: 'The brief has been read back as a summary in your own words.',
  unknowns_named: 'At least one unknown has been admitted rather than assumed away.',
  no_unanswered: 'Every question raised has been answered or deferred by the human.',
  unknowns_resolved: 'Every unknown admitted at intake has been answered or deferred.',
  claims_evidenced: 'Every load-bearing claim carries evidence with a source.',
  decisions_resolved: 'Every decision has been resolved by the human.',
  decisions_have_alternatives: 'Every decision offered at least two options and records why the rejected ones were rejected.',
  plan_acyclic: 'The dependency graph has no cycles.',
  plan_acceptance: 'Every task carries an acceptance check.',
  plan_refs_resolve: 'Every dependency and every trace points at something that exists.',
  plan_covers_inputs: 'Every answered question and every resolved decision is acted on by at least one task.',
  no_placeholders: 'No placeholder text anywhere in the blueprint.',
  critique_coverage: 'Every item on the critique checklist has a verdict.',
  critique_clear: 'No open finding at major or blocking severity.',
  views_in_sync: 'The narrative and the task graph refer to exactly the same set of tasks.',
  questions_asked: 'At least one question has been put to the human.',
  claims_recorded: 'At least one load-bearing claim has been recorded.',
  decisions_made: 'At least one decision has been put to the human.',
  plan_not_empty: 'The plan contains at least one task.',
  narrative_written: 'At least one narrative section has been written.',
};

/* ---- critique checklist ------------------------------------------------
   Fixed for v1. It grows by editing this array — phases are data — not by a
   per-project mechanism that would need designing. */

export const CRITIQUE_CHECKLIST = [
  { id: 'placeholders', label: 'No placeholder, no deferred detail, nothing left to fill in.' },
  { id: 'contradiction', label: 'No two parts of the blueprint contradict each other.' },
  { id: 'ambiguity', label: 'No requirement can be read two ways.' },
  { id: 'scope', label: 'Scope is one coherent piece of work, not several.' },
  { id: 'falsifiable', label: 'Every requirement can be shown done or not done.' },
  { id: 'cold_start', label: 'An executor with no memory of this conversation could begin.' },
];

export const TASK_REF = /\[([A-Z][A-Z0-9]*\d+)\]/g;

export function narrativeRefs(doc) {
  const out = [];
  const narrative = (doc && doc.narrative) || {};
  for (const key of Object.keys(narrative)) {
    const text = str(narrative[key]);
    for (const m of text.matchAll(TASK_REF)) if (!out.includes(m[1])) out.push(m[1]);
  }
  return out;
}

const PLACEHOLDER_TOKENS = ['tbd', 'todo', '???', 'etc.', 'fill in', 'decide later', 'to be decided'];

function authoredFields(doc) {
  const out = [];
  const intake = (doc && doc.intake) || {};
  if (filled(intake.summary)) out.push({ where: 'intake.summary', text: intake.summary });
  for (const q of arr(doc && doc.questions)) if (filled(q.answer)) out.push({ where: 'questions.' + str(q.id) + '.answer', text: q.answer });
  for (const d of arr(doc && doc.decisions)) if (filled(d.rationale)) out.push({ where: 'decisions.' + str(d.id) + '.rationale', text: d.rationale });
  for (const t of arr(doc && doc.tasks)) {
    if (filled(t.title)) out.push({ where: 'tasks.' + str(t.id) + '.title', text: t.title });
    if (filled(t.acceptance)) out.push({ where: 'tasks.' + str(t.id) + '.acceptance', text: t.acceptance });
  }
  const narrative = (doc && doc.narrative) || {};
  for (const key of Object.keys(narrative)) if (filled(narrative[key])) out.push({ where: 'narrative.' + key, text: narrative[key] });
  return out;
}

export const PREDICATES = {
  concept_loaded(doc) {
    const c = doc && doc.concept;
    return c && filled(c.text) ? pass() : fail([{ where: 'concept', detail: 'no brief has been loaded' }]);
  },

  intake_recorded(doc) {
    const i = doc && doc.intake;
    if (!i) return fail([{ where: 'intake', detail: 'nothing recorded' }]);
    return filled(i.summary) ? pass() : fail([{ where: 'intake.summary', detail: 'summary is empty' }]);
  },

  unknowns_named(doc) {
    const i = (doc && doc.intake) || {};
    return arr(i.unknowns).filter(filled).length > 0
      ? pass()
      : fail([{ where: 'intake.unknowns', detail: 'no unknown admitted — a brief always leaves something open' }]);
  },

  no_unanswered(doc) {
    return fail(
      arr(doc && doc.questions)
        .filter((q) => !q.deferred && !filled(q.answer))
        .map((q) => ({ where: str(q.id), detail: str(q.text) }))
    );
  },

  unknowns_resolved(doc) {
    const questions = arr(doc && doc.questions);
    const covered = new Set(
      questions.filter((q) => q.deferred || filled(q.answer)).map((q) => str(q.addresses)).filter(Boolean)
    );
    const unknowns = arr(doc && doc.intake && doc.intake.unknowns).filter(filled);
    return fail(
      unknowns.filter((u) => !covered.has(u)).map((u) => ({ where: u, detail: 'admitted at intake, never resolved' }))
    );
  },

  claims_evidenced(doc) {
    return fail(
      arr(doc && doc.claims)
        .filter((c) => c && c.loadBearing)
        .filter((c) => !arr(c.evidence).some((e) => e && filled(e.source)))
        .map((c) => ({ where: str(c.id), detail: str(c.text) || 'load-bearing claim without a sourced evidence entry' }))
    );
  },

  decisions_resolved(doc) {
    return fail(
      arr(doc && doc.decisions)
        .filter((d) => !filled(d && d.chosen))
        .map((d) => ({ where: str(d.id), detail: str(d.question) || 'unresolved' }))
    );
  },

  decisions_have_alternatives(doc) {
    const offenders = [];
    for (const d of arr(doc && doc.decisions)) {
      if (arr(d.options).length < 2) {
        offenders.push({ where: str(d.id), detail: 'fewer than two options were offered' });
        continue;
      }
      const unexplained = arr(d.rejected).filter((r) => !filled(r && r.reason));
      if (!arr(d.rejected).length || unexplained.length) {
        offenders.push({ where: str(d.id), detail: 'a rejected option has no recorded reason' });
      }
    }
    return fail(offenders);
  },

  plan_acyclic(doc) {
    const tasks = arr(doc && doc.tasks);
    const byId = new Map(tasks.map((t) => [str(t.id), t]));
    const state = new Map();          // id -> 'visiting' | 'done'
    const inCycle = new Set();

    const walk = (id, trail) => {
      if (state.get(id) === 'done') return;
      if (state.get(id) === 'visiting') {
        /* everything from the first sighting of id onward is on the cycle */
        for (let i = trail.indexOf(id); i >= 0 && i < trail.length; i++) inCycle.add(trail[i]);
        return;
      }
      state.set(id, 'visiting');
      const task = byId.get(id);
      for (const dep of arr(task && task.deps)) if (byId.has(str(dep))) walk(str(dep), trail.concat([id]));
      state.set(id, 'done');
    };

    for (const t of tasks) walk(str(t.id), []);
    return fail([...inCycle].map((id) => ({ where: id, detail: 'is part of a dependency cycle' })));
  },

  plan_acceptance(doc) {
    return fail(
      arr(doc && doc.tasks)
        .filter((t) => !filled(t && t.acceptance))
        .map((t) => ({ where: str(t.id), detail: 'has no acceptance check, so nobody can tell when it is done' }))
    );
  },

  plan_refs_resolve(doc) {
    const taskIds = new Set(arr(doc && doc.tasks).map((t) => str(t.id)));
    const inputIds = new Set([
      ...arr(doc && doc.questions).map((q) => str(q.id)),
      ...arr(doc && doc.decisions).map((d) => str(d.id)),
    ]);
    const offenders = [];
    for (const t of arr(doc && doc.tasks)) {
      for (const dep of arr(t.deps)) {
        if (!taskIds.has(str(dep))) offenders.push({ where: str(t.id), detail: 'depends on ' + str(dep) + ', which does not exist' });
      }
      for (const ref of arr(t.tracesTo)) {
        if (!inputIds.has(str(ref))) offenders.push({ where: str(t.id), detail: 'traces to ' + str(ref) + ', which does not exist' });
      }
    }
    return fail(offenders);
  },

  plan_covers_inputs(doc) {
    const traced = new Set();
    for (const t of arr(doc && doc.tasks)) for (const ref of arr(t.tracesTo)) traced.add(str(ref));

    const offenders = [];
    for (const q of arr(doc && doc.questions)) {
      if (q.deferred || !filled(q.answer)) continue;
      if (!traced.has(str(q.id))) offenders.push({ where: str(q.id), detail: 'answered, then dropped: no task acts on it' });
    }
    for (const d of arr(doc && doc.decisions)) {
      if (!filled(d.chosen)) continue;
      if (!traced.has(str(d.id))) offenders.push({ where: str(d.id), detail: 'decided, then dropped: no task acts on it' });
    }
    return fail(offenders);
  },

  no_placeholders(doc) {
    const offenders = [];
    for (const field of authoredFields(doc)) {
      const haystack = field.text.toLowerCase();
      const hit = PLACEHOLDER_TOKENS.find((token) => haystack.includes(token));
      if (hit) offenders.push({ where: field.where, detail: 'contains "' + hit + '"' });
    }
    return fail(offenders);
  },

  critique_coverage(doc) {
    const judged = new Set(arr(doc && doc.findings).map((f) => str(f.item)));
    return fail(
      CRITIQUE_CHECKLIST.filter((c) => !judged.has(c.id)).map((c) => ({ where: c.id, detail: 'no verdict recorded: ' + c.label }))
    );
  },

  critique_clear(doc) {
    return fail(
      arr(doc && doc.findings)
        .filter((f) => (f.severity === 'major' || f.severity === 'blocking') && f.status === 'open')
        .map((f) => ({ where: str(f.id), detail: str(f.severity) + ': ' + str(f.claim) }))
    );
  },

  /* ---- substance checks ------------------------------------------------
     Every other predicate here is a VIOLATION check, and a violation check is
     vacuously true on an empty workspace: with no questions there are no
     unanswered ones. Without these five, an agent could sprint the whole
     journey producing nothing and every gate would say yes. Gate on
     violations within a phase; require substance at its boundary. */

  questions_asked(doc) {
    return arr(doc && doc.questions).length > 0
      ? pass()
      : fail([{ where: 'questions', detail: 'no question has been asked — this phase exists to get information out of the human' }]);
  },

  claims_recorded(doc) {
    return arr(doc && doc.claims).some((c) => c && c.loadBearing)
      ? pass()
      : fail([{ where: 'claims', detail: 'no load-bearing claim recorded — every blueprint rests on something that could be wrong' }]);
  },

  decisions_made(doc) {
    return arr(doc && doc.decisions).length > 0
      ? pass()
      : fail([{ where: 'decisions', detail: 'no decision has been put to the human' }]);
  },

  plan_not_empty(doc) {
    return arr(doc && doc.tasks).length > 0
      ? pass()
      : fail([{ where: 'tasks', detail: 'the plan has no tasks' }]);
  },

  narrative_written(doc) {
    const narrative = (doc && doc.narrative) || {};
    return Object.keys(narrative).some((k) => filled(narrative[k]))
      ? pass()
      : fail([{ where: 'narrative', detail: 'nothing has been written for the human reader' }]);
  },

  views_in_sync(doc) {
    const taskIds = arr(doc && doc.tasks).map((t) => str(t.id));
    const refs = narrativeRefs(doc);
    const offenders = [];
    for (const ref of refs) if (!taskIds.includes(ref)) offenders.push({ where: ref, detail: 'the narrative refers to ' + ref + ', which is not in the task graph' });
    for (const id of taskIds) if (!refs.includes(id)) offenders.push({ where: id, detail: id + ' is in the task graph but is never mentioned in the narrative' });
    return fail(offenders);
  },
};

export function runChecks(doc, checkIds) {
  return arr(checkIds).map((id) => {
    const fn = PREDICATES[id];
    if (!fn) return { id, label: 'unknown check', ok: false, offenders: [{ where: id, detail: 'no such predicate' }] };
    const r = fn(doc);
    return { id, label: LABELS[id], ok: r.ok, offenders: r.offenders };
  });
}

export function gateStatus(doc, checkIds) {
  const results = runChecks(doc, checkIds);
  const failed = results.filter((r) => !r.ok).map(({ id, label, offenders }) => ({ id, label, offenders }));
  return { ok: failed.length === 0, failed };
}
