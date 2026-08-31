/* The tool surface, built per phase from the phase config.

   Two properties are load-bearing and must survive any edit to this file:

     1. No DOM. The journey test drives all seven phases headlessly through
        exactly this module.
     2. No tool for human authority. There is nothing here that answers a
        question, resolves a decision, accepts a finding, advances the journey
        or declares the blueprint ready. Those are controls in the page.
        Authority is the absence of a tool. */

import { gateStatus, runChecks, CRITIQUE_CHECKLIST } from './checks.js';
import { PHASES, phaseById, nextPhaseId } from './phases.js';

export const GLOBAL_TOOLS = ['get_state', 'get_phase_guide', 'request_advance'];

const S = { type: 'string' };
const LIST = { type: 'array', items: { type: 'string' } };
const VERSION = { type: 'number', description: 'The version you read from get_state. If the workspace has moved on, the write is rejected rather than clobbering what changed.' };

const j = (value) => JSON.stringify(value, null, 2);
const nextId = (list, prefix) => prefix + (list.length + 1);

/* Every mutating handler goes through here, so optimistic concurrency is
   uniform and a stale write can never be silently applied. */
function write(ctx, meta, fn, onOk) {
  const r = ctx.store.mutate(meta, fn);
  if (!r.ok) return r.error + ': ' + r.message;
  return onOk(r.version);
}

function gateFor(doc, phaseId) {
  const phase = phaseById(phaseId);
  return gateStatus(doc, phase ? phase.checks : []);
}

function describeGate(gate) {
  if (gate.ok) return 'All checks for this phase pass.';
  return gate.failed
    .map((f) => '  [' + f.id + '] ' + f.label +
      (f.offenders.length ? '\n' + f.offenders.map((o) => '      - ' + o.where + ': ' + o.detail).join('\n') : ''))
    .join('\n');
}

export const TOOL_DEFS = {
  /* ---- global ---------------------------------------------------------- */

  get_state: {
    description:
      'Returns the current state of this blueprint workspace: which phase it is in, everything ' +
      'recorded so far, and whether the current phase\'s checks pass. Call this first, and call it ' +
      'again after a human acts on the page. The version it returns is what you pass as ' +
      'expectedVersion when you write.',
    inputSchema: { type: 'object', properties: {} },
    handler(ctx) {
      const doc = ctx.store.get();
      const phase = phaseById(doc.phase);
      return j({
        version: doc.version,
        phase: doc.phase,
        phaseTitle: phase ? phase.title : doc.phase,
        journey: PHASES.map((p) => p.id),
        concept: doc.concept,
        intake: doc.intake,
        questions: doc.questions,
        claims: doc.claims,
        decisions: doc.decisions,
        tasks: doc.tasks,
        findings: doc.findings,
        narrative: doc.narrative,
        pendingAdvance: doc.pendingAdvance,
        gate: gateFor(doc, doc.phase),
      });
    },
  },

  get_phase_guide: {
    description:
      'Returns the method for the phase this workspace is currently in: how to work here, and what ' +
      'must be true before the phase can close. Read it when you arrive in a phase. Each phase has ' +
      'its own guide and its own tools.',
    inputSchema: { type: 'object', properties: {} },
    handler(ctx) {
      const doc = ctx.store.get();
      const phase = phaseById(doc.phase);
      if (!phase) return 'No guide: the workspace is in an unknown phase (' + doc.phase + ').';
      return phase.guide;
    },
  },

  request_advance: {
    description:
      'Asks to move the workspace to the next phase. This does not move it. If any check for the ' +
      'current phase fails, the request is refused and the failures are returned so you can fix ' +
      'them. If every check passes, the request is queued and a human confirms it on the page.',
    inputSchema: { type: 'object', properties: { expectedVersion: VERSION } },
    handler(ctx, args) {
      const doc = ctx.store.get();
      const gate = gateFor(doc, doc.phase);
      if (!gate.ok) {
        /* A refusal is the most informative thing that happens on this page, so
           it is recorded rather than merely returned. The human watches the
           gate bite; the export carries every time it did. */
        ctx.store.mutate(
          { actor: 'gate', kind: 'request_advance_refused',
            detail: doc.phase + ': ' + gate.failed.map((f) => f.id).join(', '), touched: [] },
          () => {});
        return 'The gate for phase "' + doc.phase + '" is not open. Nothing has moved.\n\n' +
          describeGate(gate) + '\n\nFix these, then ask again.';
      }
      const to = nextPhaseId(doc.phase);
      if (!to) return 'This is the last phase. A human presses READY on the page; there is no tool for it.';

      return write(ctx,
        { expectedVersion: args.expectedVersion, actor: 'agent', kind: 'request_advance', detail: doc.phase + ' -> ' + to, touched: ['pendingAdvance'] },
        (d) => { d.pendingAdvance = { from: d.phase, to, at: new Date().toISOString() }; },
        () => 'Every check for "' + doc.phase + '" passes. A transition to "' + to + '" is queued and waiting for a human to confirm it on the page. The workspace is still in "' + doc.phase + '".');
    },
  },

  /* ---- intake ---------------------------------------------------------- */

  load_concept: {
    description: 'Reads the concept brief the human dropped into this page. The file is read in the browser and is never uploaded anywhere.',
    inputSchema: { type: 'object', properties: {} },
    handler(ctx) {
      const doc = ctx.store.get();
      if (!doc.concept) return 'No brief has been loaded yet. Ask the human to drop their concept file onto the page.';
      return 'Brief: ' + doc.concept.name + '\n\n' + doc.concept.text;
    },
  },

  record_intake: {
    description:
      'Records your reading of the brief: a summary in your own words, what the brief establishes, ' +
      'what it leaves open, and what you are assuming. Naming at least one unknown is required to ' +
      'leave this phase.',
    inputSchema: {
      type: 'object',
      properties: {
        summary: { ...S, description: 'The brief in your own words.' },
        knowns: { ...LIST, description: 'What the brief actually establishes.' },
        unknowns: { ...LIST, description: 'What it leaves open and you would otherwise assume.' },
        assumptions: { ...LIST, description: 'What you are provisionally taking as true.' },
        expectedVersion: VERSION,
      },
      required: ['summary', 'unknowns'],
    },
    handler(ctx, a) {
      return write(ctx,
        { expectedVersion: a.expectedVersion, actor: 'agent', kind: 'record_intake', detail: 'summary + ' + (a.unknowns || []).length + ' unknowns', touched: ['intake'] },
        (d) => { d.intake = { summary: a.summary || '', knowns: a.knowns || [], unknowns: a.unknowns || [], assumptions: a.assumptions || [] }; },
        (v) => 'Intake recorded at version ' + v + '. ' + describeGate(gateFor(ctx.store.get(), 'intake')));
    },
  },

  /* ---- interrogate ----------------------------------------------------- */

  ask_question: {
    description:
      'Puts one question to the human on the page. Ask one at a time and wait for the answer, ' +
      'because the next question usually depends on it. Offer options where you have them. ' +
      'You cannot answer a question yourself: there is no tool for it.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { ...S, description: 'The question, in one sentence.' },
        why: { ...S, description: 'Why the answer changes what gets built.' },
        options: { ...LIST, description: 'Two to four options, if the question has them.' },
        addresses: { ...S, description: 'The intake unknown this question resolves, if any.' },
        expectedVersion: VERSION,
      },
      required: ['text', 'why'],
    },
    handler(ctx, a) {
      const id = nextId(ctx.store.get().questions, 'q');
      return write(ctx,
        { expectedVersion: a.expectedVersion, actor: 'agent', kind: 'ask_question', detail: a.text, touched: ['questions.' + id] },
        (d) => { d.questions.push({ id, text: a.text, why: a.why || '', options: a.options || [], addresses: a.addresses || '', answer: null, deferred: false }); },
        () => 'Question ' + id + ' is on the page, waiting for the human. Wait for the answer before asking the next one.');
    },
  },

  get_answers: {
    description: 'Returns every question asked so far with its answer, or null where the human has not answered yet.',
    inputSchema: { type: 'object', properties: {} },
    handler(ctx) { return j(ctx.store.get().questions); },
  },

  /* ---- research -------------------------------------------------------- */

  mark_claim: {
    description:
      'Records a claim the blueprint rests on. Mark it load-bearing when the plan would change if ' +
      'the claim turned out false. Load-bearing claims need evidence with a source before this ' +
      'phase can close; preferences do not, but must be recorded as preferences.',
    inputSchema: {
      type: 'object',
      properties: { text: S, loadBearing: { type: 'boolean' }, expectedVersion: VERSION },
      required: ['text', 'loadBearing'],
    },
    handler(ctx, a) {
      const id = nextId(ctx.store.get().claims, 'c');
      return write(ctx,
        { expectedVersion: a.expectedVersion, actor: 'agent', kind: 'mark_claim', detail: a.text, touched: ['claims.' + id] },
        (d) => { d.claims.push({ id, text: a.text, loadBearing: !!a.loadBearing, evidence: [] }); },
        () => 'Recorded ' + id + (a.loadBearing ? ' as load-bearing. It needs evidence with a source.' : ' as a preference.'));
    },
  },

  add_evidence: {
    description:
      'Attaches evidence to a claim. The source is a URL, a document, a filename or a named person ' +
      '— not "common knowledge" and not recollection. Say in the note what the source actually ' +
      'says, and say so if the evidence is thin.',
    inputSchema: {
      type: 'object',
      properties: { claimId: S, source: S, note: S, expectedVersion: VERSION },
      required: ['claimId', 'source', 'note'],
    },
    handler(ctx, a) {
      if (!ctx.store.get().claims.some((c) => c.id === a.claimId)) return 'No claim ' + a.claimId + '. Call mark_claim first.';
      return write(ctx,
        { expectedVersion: a.expectedVersion, actor: 'agent', kind: 'add_evidence', detail: a.claimId + ' <- ' + a.source, touched: ['claims.' + a.claimId] },
        (d) => { d.claims.find((c) => c.id === a.claimId).evidence.push({ source: a.source, note: a.note }); },
        () => 'Evidence attached to ' + a.claimId + '. It appears on the page for the human to look over.');
    },
  },

  list_unsupported: {
    description: 'Returns every load-bearing claim that still has no evidence with a source.',
    inputSchema: { type: 'object', properties: {} },
    handler(ctx) {
      const open = ctx.store.get().claims.filter((c) => c.loadBearing && !c.evidence.some((e) => e.source && e.source.trim()));
      return open.length ? j(open) : 'Every load-bearing claim carries sourced evidence.';
    },
  },

  /* ---- decide ---------------------------------------------------------- */

  propose_decision: {
    description:
      'Puts a decision to the human: two or three real options with their trade-offs, your ' +
      'recommendation, and why. The human chooses on the page — there is no tool for choosing. ' +
      'A chosen decision locks and becomes an invariant for everything downstream.',
    inputSchema: {
      type: 'object',
      properties: {
        question: { ...S, description: 'The decision, in one line.' },
        options: {
          type: 'array',
          description: 'Two or three options. Not one option beside two strawmen.',
          items: { type: 'object', properties: { label: S, tradeoffs: S }, required: ['label', 'tradeoffs'] },
        },
        recommendation: { ...S, description: 'The label of the option you would choose.' },
        rationale: { ...S, description: 'Why, in terms of the constraints established in interrogation.' },
        expectedVersion: VERSION,
      },
      required: ['question', 'options', 'recommendation', 'rationale'],
    },
    handler(ctx, a) {
      if (!Array.isArray(a.options) || a.options.length < 2) return 'A decision needs at least two options. One option is not a decision.';
      const id = nextId(ctx.store.get().decisions, 'd');
      return write(ctx,
        { expectedVersion: a.expectedVersion, actor: 'agent', kind: 'propose_decision', detail: a.question, touched: ['decisions.' + id] },
        (d) => { d.decisions.push({ id, question: a.question, options: a.options, recommendation: a.recommendation, rationale: a.rationale, chosen: null, rejected: [], locked: false }); },
        () => 'Decision ' + id + ' is on the page. The human chooses. When they do, it locks and you work within it.');
    },
  },

  get_decisions: {
    description: 'Returns every decision, with what was chosen, what was rejected and why. Locked decisions are invariants.',
    inputSchema: { type: 'object', properties: {} },
    handler(ctx) { return j(ctx.store.get().decisions); },
  },

  request_decision_change: {
    description:
      'Asks a human to reopen a locked decision, with a reason. This queues a request and changes ' +
      'nothing: the decision stays locked, and the blueprint stays as it is, until a human acts on ' +
      'the page. Use it when the work you have been asked for cannot be done within the decision.',
    inputSchema: {
      type: 'object',
      properties: { id: S, reason: { ...S, description: 'Why it cannot stand. A human reads this before deciding.' }, expectedVersion: VERSION },
      required: ['id', 'reason'],
    },
    handler(ctx, a) {
      const decision = ctx.store.get().decisions.find((d) => d.id === a.id);
      if (!decision) return 'No decision ' + a.id + '.';
      return write(ctx,
        { expectedVersion: a.expectedVersion, actor: 'agent', kind: 'request_decision_change', detail: a.id + ': ' + a.reason, touched: ['decisions.' + a.id] },
        (d) => { d.decisions.find((x) => x.id === a.id).changeRequest = { reason: a.reason, at: new Date().toISOString(), status: 'pending' }; },
        () => 'Requested. ' + a.id + ' is unchanged and still locked. A human decides on the page.');
    },
  },

  /* ---- plan ------------------------------------------------------------ */

  add_task: {
    description:
      'Adds one task to the plan. Write for someone with no memory of this conversation. The ' +
      'acceptance check must let anyone tell the task is done — a command, an observable ' +
      'behaviour — never "works correctly". tracesTo names the question ids and decision ids this ' +
      'task exists because of, and every answer and decision must be traced to by some task.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { ...S, description: 'T1, T2, T3...' },
        title: S,
        deps: { ...LIST, description: 'Ids of tasks that must land first.' },
        acceptance: { ...S, description: 'How anyone can tell it is done.' },
        tracesTo: { ...LIST, description: 'Question ids and decision ids this task serves.' },
        expectedVersion: VERSION,
      },
      required: ['id', 'title', 'acceptance', 'tracesTo'],
    },
    handler(ctx, a) {
      if (ctx.store.get().tasks.some((t) => t.id === a.id)) return 'Task ' + a.id + ' already exists. Use update_task.';
      return write(ctx,
        { expectedVersion: a.expectedVersion, actor: 'agent', kind: 'add_task', detail: a.id + ' ' + a.title, touched: ['tasks.' + a.id] },
        (d) => { d.tasks.push({ id: a.id, title: a.title, deps: a.deps || [], acceptance: a.acceptance, tracesTo: a.tracesTo || [] }); },
        () => 'Added ' + a.id + '.');
    },
  },

  update_task: {
    description: 'Changes fields on an existing task. Only the fields you pass are changed.',
    inputSchema: {
      type: 'object',
      properties: { id: S, title: S, deps: LIST, acceptance: S, tracesTo: LIST, expectedVersion: VERSION },
      required: ['id'],
    },
    handler(ctx, a) {
      if (!ctx.store.get().tasks.some((t) => t.id === a.id)) return 'No task ' + a.id + '.';
      return write(ctx,
        { expectedVersion: a.expectedVersion, actor: 'agent', kind: 'update_task', detail: a.id, touched: ['tasks.' + a.id] },
        (d) => {
          const t = d.tasks.find((x) => x.id === a.id);
          for (const key of ['title', 'deps', 'acceptance', 'tracesTo']) if (a[key] !== undefined) t[key] = a[key];
        },
        () => 'Updated ' + a.id + '.');
    },
  },

  validate_plan: {
    description: 'Runs every check this phase gates on and returns what fails, without changing anything. Cheaper than guessing.',
    inputSchema: { type: 'object', properties: {} },
    handler(ctx) {
      const results = runChecks(ctx.store.get(), phaseById('plan').checks);
      return results.map((r) => (r.ok ? 'PASS  ' : 'FAIL  ') + r.id + '  ' + r.label +
        (r.ok ? '' : '\n' + r.offenders.map((o) => '        - ' + o.where + ': ' + o.detail).join('\n'))).join('\n');
    },
  },

  /* ---- critique -------------------------------------------------------- */

  file_finding: {
    description:
      'Records a verdict on one item of the critique checklist. Every item needs a verdict, ' +
      'including the ones that hold — file those with severity "clear". Severity is blocking, ' +
      'major, minor or clear. You cannot dismiss a finding you filed; only a human can accept one ' +
      'as won\'t-fix.',
    inputSchema: {
      type: 'object',
      properties: {
        item: { type: 'string', enum: CRITIQUE_CHECKLIST.map((c) => c.id), description: 'Which checklist item this verdict is for.' },
        severity: { type: 'string', enum: ['blocking', 'major', 'minor', 'clear'] },
        target: { ...S, description: 'What in the blueprint this is about.' },
        claim: { ...S, description: 'What is wrong, in one sentence.' },
        fix: { ...S, description: 'What would fix it.' },
        expectedVersion: VERSION,
      },
      required: ['item', 'severity', 'claim'],
    },
    handler(ctx, a) {
      const id = nextId(ctx.store.get().findings, 'f');
      const status = a.severity === 'clear' ? 'resolved' : 'open';
      return write(ctx,
        { expectedVersion: a.expectedVersion, actor: 'agent', kind: 'file_finding', detail: a.item + ' ' + a.severity, touched: ['findings.' + id] },
        (d) => { d.findings.push({ id, item: a.item, severity: a.severity, target: a.target || '', claim: a.claim, fix: a.fix || '', status }); },
        () => 'Filed ' + id + ' on "' + a.item + '" at ' + a.severity + '.');
    },
  },

  resolve_finding: {
    description: 'Marks a finding resolved because you changed the blueprint, and says what you changed. Resolving without a change is not resolving.',
    inputSchema: { type: 'object', properties: { id: S, how: S, expectedVersion: VERSION }, required: ['id', 'how'] },
    handler(ctx, a) {
      if (!ctx.store.get().findings.some((f) => f.id === a.id)) return 'No finding ' + a.id + '.';
      return write(ctx,
        { expectedVersion: a.expectedVersion, actor: 'agent', kind: 'resolve_finding', detail: a.id + ': ' + a.how, touched: ['findings.' + a.id] },
        (d) => { const f = d.findings.find((x) => x.id === a.id); f.status = 'resolved'; f.how = a.how; },
        () => 'Resolved ' + a.id + '.');
    },
  },

  list_findings: {
    description: 'Returns every finding and which checklist items still have no verdict.',
    inputSchema: { type: 'object', properties: {} },
    handler(ctx) {
      const doc = ctx.store.get();
      const judged = new Set(doc.findings.map((f) => f.item));
      return j({ findings: doc.findings, awaitingVerdict: CRITIQUE_CHECKLIST.filter((c) => !judged.has(c.id)).map((c) => c.id) });
    },
  },

  /* ---- ship ------------------------------------------------------------ */

  write_narrative: {
    description:
      'Writes one section of the human-readable blueprint. Refer to tasks by id in square brackets ' +
      '— [T1], [T7]. That binding is checked both ways: prose may not refer to a task that does ' +
      'not exist, and no task may sit in the graph unmentioned in the prose.',
    inputSchema: {
      type: 'object',
      properties: { sectionId: { ...S, description: 'A short slug, e.g. "overview" or "order-of-work".' }, prose: S, expectedVersion: VERSION },
      required: ['sectionId', 'prose'],
    },
    handler(ctx, a) {
      return write(ctx,
        { expectedVersion: a.expectedVersion, actor: 'agent', kind: 'write_narrative', detail: a.sectionId, touched: ['narrative.' + a.sectionId] },
        (d) => { d.narrative[a.sectionId] = a.prose; },
        () => 'Section "' + a.sectionId + '" written. ' + describeGate(gateFor(ctx.store.get(), 'ship')));
    },
  },

  check_ready: {
    description:
      'Reports whether the blueprint is ready, phase by phase. Report what this returns rather ' +
      'than asserting readiness yourself. Pressing READY is a human action on the page.',
    inputSchema: { type: 'object', properties: {} },
    handler(ctx) {
      const doc = ctx.store.get();
      const phases = {};
      let ready = true;
      for (const p of PHASES) {
        const g = gateStatus(doc, p.checks);
        phases[p.id] = { ok: g.ok, failed: g.failed };
        if (!g.ok) ready = false;
      }
      return j({ ready, phases });
    },
  },
};

export function buildTools(phaseId, ctx) {
  const phase = phaseById(phaseId);
  const names = GLOBAL_TOOLS.concat(phase ? phase.tools : []);
  return names.map((name) => {
    const def = TOOL_DEFS[name];
    return {
      name,
      description: def.description,
      inputSchema: def.inputSchema,
      execute: async (input) => {
        let args = input || {};
        if (args.arguments) args = args.arguments;   // clients differ; accept both

        /* Registration cannot be relied on for phase scoping: provideContext
           replaces the tool set, but registerTool only adds and offers no way
           to withdraw. So the phase boundary is enforced at call time. */
        if (!GLOBAL_TOOLS.includes(name)) {
          const current = ctx.store.get().phase;
          if (current !== phaseId) {
            return { content: [{ type: 'text', text:
              'Not called: "' + name + '" belongs to the "' + phaseId + '" phase and this workspace is now in "' +
              current + '". Call get_phase_guide for the method that applies here. Nothing was changed.' }] };
          }
        }

        let text;
        try {
          text = def.handler(ctx, args);
        } catch (e) {
          text = 'The call failed: ' + (e && e.message ? e.message : String(e)) + '. Nothing was changed.';
        }
        return { content: [{ type: 'text', text: String(text) }] };
      },
    };
  });
}
