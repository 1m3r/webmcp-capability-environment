/* Two readers, one document. The graph is for whoever executes; the narrative
   is for whoever has to hold the whole thing in their head. Neither is the
   source of truth — the document is — but the narrative is authored prose and
   the graph is structure, so they CAN drift, and views_in_sync is what catches
   it. */

const arr = (v) => (Array.isArray(v) ? v : []);

export function topoSort(tasks) {
  const list = arr(tasks);
  const byId = new Map(list.map((t) => [t.id, t]));
  const state = new Map();
  const order = [];
  let cyclic = false;

  const visit = (id) => {
    if (cyclic || state.get(id) === 'done') return;
    if (state.get(id) === 'visiting') { cyclic = true; return; }
    state.set(id, 'visiting');
    for (const dep of arr((byId.get(id) || {}).deps)) if (byId.has(dep)) visit(dep);
    state.set(id, 'done');
    order.push(id);
  };

  for (const t of list) visit(t.id);
  return cyclic ? null : order;
}

export function renderGraph(doc) {
  const tasks = arr(doc && doc.tasks);
  const inputs = {};
  for (const q of arr(doc && doc.questions)) inputs[q.id] = { kind: 'question', text: q.text, answer: q.answer, deferred: !!q.deferred };
  for (const d of arr(doc && doc.decisions)) inputs[d.id] = { kind: 'decision', question: d.question, chosen: d.chosen, rationale: d.rationale };
  return { tasks, order: topoSort(tasks) || [], inputs };
}

export function renderNarrative(doc) {
  const d = doc || {};
  const out = [];
  const intake = d.intake || {};

  out.push('# Blueprint\n');

  if (intake.summary) out.push('## What this is\n\n' + intake.summary + '\n');

  const answered = arr(d.questions).filter((q) => q.answer);
  if (answered.length) {
    out.push('## What was established\n');
    for (const q of answered) out.push('- **' + q.text + '** ' + q.answer);
    out.push('');
  }

  const deferred = arr(d.questions).filter((q) => q.deferred);
  if (deferred.length) {
    out.push('## Deliberately left open\n');
    for (const q of deferred) out.push('- ' + q.text);
    out.push('');
  }

  const decisions = arr(d.decisions).filter((x) => x.chosen);
  if (decisions.length) {
    out.push('## Decisions\n');
    for (const x of decisions) {
      out.push('### ' + x.question + '\n');
      out.push('**' + x.chosen + '** — ' + (x.rationale || '') + '\n');
      const rejected = arr(x.rejected);
      if (rejected.length) {
        out.push('Rejected:\n');
        for (const r of rejected) out.push('- *' + r.option + '* — ' + r.reason);
        out.push('');
      }
    }
  }

  const claims = arr(d.claims).filter((c) => c.loadBearing);
  if (claims.length) {
    out.push('## What this rests on\n');
    for (const c of claims) {
      const sources = arr(c.evidence).map((e) => e.source).filter(Boolean).join(', ');
      out.push('- ' + c.text + (sources ? ' — *' + sources + '*' : ''));
    }
    out.push('');
  }

  for (const key of Object.keys(d.narrative || {})) {
    out.push('## ' + key.replace(/[-_]/g, ' ') + '\n');
    out.push(d.narrative[key] + '\n');
  }

  const order = topoSort(arr(d.tasks));
  if (arr(d.tasks).length) {
    out.push('## The work, in order\n');
    const byId = new Map(arr(d.tasks).map((t) => [t.id, t]));
    for (const id of order || arr(d.tasks).map((t) => t.id)) {
      const t = byId.get(id);
      out.push('### [' + t.id + '] ' + t.title + '\n');
      if (arr(t.deps).length) out.push('After: ' + t.deps.join(', ') + '\n');
      out.push('Done when: ' + t.acceptance + '\n');
    }
    if (!order) out.push('*The dependency graph contains a cycle; this listing is unordered.*\n');
  }

  const open = arr(d.findings).filter((f) => f.status === 'open' || f.status === 'accepted');
  if (open.length) {
    out.push('## Known weaknesses\n');
    for (const f of open) out.push('- **' + f.severity + '** ' + f.claim + (f.status === 'accepted' ? ' *(accepted)*' : ''));
    out.push('');
  }

  return out.join('\n');
}
