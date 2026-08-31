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
};

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
