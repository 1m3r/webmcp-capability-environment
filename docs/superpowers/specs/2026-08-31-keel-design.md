# Keel — design

    Owner:   1m3r / DGOS
    Date:    31 August 2026
    Status:  approved in brainstorming, not yet planned
    Branch:  feat/keel
    Context: docs/WEBMCP_MASTER_CONTEXT_v3.md, FROZEN.md

---

## 1. What this is

A web application that turns a rough concept brief into a **blueprint that is
ready to execute** — by a coding agent in a cold session and by a human picking
it up on Monday, from one source of truth rendered two ways.

The user installs nothing. The page hands their existing agent the research,
brainstorming, planning and critique method it needs, **one phase at a time**,
through WebMCP tools. The user confirms every step on a shared visual surface.

**The journey is the governance.** The page does not persuade the agent to
follow a method; it releases the method one room at a time and refuses to open
the next door until the current room's checks pass. Phase-scoped tools are not a
WebMCP limitation being worked around — they are the architecture.

## 2. Why this domain

Against the §7.4 filter, all four clauses hold:

| Clause | Status |
|---|---|
| The method is not in the model | Agents write specs generically and skip the interrogation entirely. The one-question-at-a-time discipline, recorded rejected alternatives, and coverage-based critique are none of them default behaviour. |
| The check is verifiable | Exactly: unanswered-question count, evidence binding, acyclicity of the task graph, acceptance-check presence, placeholder tokens, narrative↔graph reference parity. |
| The state is expensive to carry | The concept file, every answer, every locked decision, every rejected alternative and its reason. A fresh chat cannot reconstruct it. |
| Human judgment is load-bearing | Answering, deciding, cutting scope, accepting a finding, declaring ready. Cheap on a canvas, expensive in chat, and **none of them have a tool**. |

It also demonstrates itself: the demo is blueprinting a real project on camera.

## 3. Architecture

**Vanilla. No build step, no dependencies.** Same discipline as the probe: in
the time available a toolchain is pure downside risk, and it keeps the repo
legible to a judge.

**Phases are data, not code.** One generic spine — state store, hash router,
tool-surface swap, gate engine, event log, two renderers — and each phase is a
config object:

    { id, title, knowledge, tools: [...], checks: [...], nextGate }

Adding a phase is writing a config entry. Cutting a phase under time pressure
removes a config entry and leaves the spine untouched. This is the single move
that makes seven phases affordable.

**State is client-side, versioned, persisted to `localStorage`, exported as
files.** Trade-off stated honestly: no multi-device, which we do not need. What
it buys: the concept file never leaves the machine (a real WebMCP property,
demonstrable in one sentence), the live app deploys as static hosting, and there
is no backend to fail on camera. §9's "durable truth must be server-side" is
about surviving tab death; `localStorage` survives it.

**Routing.** Phases are routes in one document (`#/intake`, `#/interrogate`, …).
On transition the tool surface is re-registered via `provideContext()`. Real
page loads are avoided per §7.3 — they risk losing the tab, the session, and the
agent's thread mid-demo.

**Authority is the absence of a tool.** Ported unchanged from the probe. There
is no tool to answer a question, resolve a decision, cut scope, accept a
finding, or declare ready. Those are UI actions. This property is what stops the
application being a wrapper.

## 4. Tool surface

Three tools registered in every phase:

    get_state()        -> { version, phase, blueprint, openQuestions,
                            decisions, checks }
    get_phase_guide()  -> the knowledge slice for the current phase
    request_advance({ expectedVersion })
                       -> runs the phase checks.
                          fail -> structured violations naming the offenders
                          pass -> queues a transition the HUMAN confirms

`get_state` alone is enough for a cold agent in a fresh chat to orient (§5.2).
`get_phase_guide` is the skill-transfer channel. `request_advance` can never
advance the journey by itself.

Then two to four phase-specific tools, and no more.

## 5. The seven phases

Each gate is what `request_advance()` checks before the human's confirm button
lights up.

**0 · INTAKE**
Knowledge: what a concept brief does and does not establish, and the four things
a blueprint needs that no brief has — constraints, success criteria, non-goals,
admitted unknowns.
Tools: `load_concept()` (reads the dropped file, client-side) ·
`record_intake({ summary, knowns, unknowns, assumptions })`
Gate: concept loaded, summary recorded, unknowns named. An agent's default
failure is leaping to a solution; admitting ignorance is the price of entry.

**1 · INTERROGATE**
Knowledge: one question at a time, multiple choice preferred, purpose /
constraints / success criteria, YAGNI.
Tools: `ask_question({ text, why, options })` · `get_answers()`
Gate: zero unanswered questions, and every intake unknown either answered or
explicitly deferred by the human. There is no tool to answer a question.

**2 · RESEARCH**
Knowledge: which claims are load-bearing, what counts as a source, fact versus
preference.
Tools: `mark_claim({ text, loadBearing })` ·
`add_evidence({ claimId, source, note })` · `list_unsupported()`
Gate: no load-bearing claim without evidence. The page never fetches — the agent
uses its own browsing and records. Sources land in a panel the human confirms.

**3 · DECIDE**
Knowledge: two to three approaches with trade-offs, recommendation first with
reasoning, rejected alternatives recorded with their reason.
Tools: `propose_decision({ question, options, recommendation, rationale })` ·
`get_decisions()` · `request_decision_change({ id, reason })`
Gate: every open decision resolved by the human; each carries at least two
options and a recorded rejection reason. Resolution locks the decision into an
invariant — the agent then works within it or files a change request. This is
the probe's ask / approve / deny loop, ported.

**4 · PLAN**
Knowledge: file structure before tasks, task right-sizing, assume zero context,
every task carries its test.
Tools: `add_task({ id, title, deps, acceptance, tracesTo })` · `update_task()` ·
`validate_plan()`
Gate: dependency graph acyclic · every task has a non-empty acceptance check ·
every task traces to an answered question or a locked decision that exists ·
**every answered question and locked decision is traced to by at least one
task** — the anti-silent-narrowing check, and the one that makes the phase worth
having · zero placeholder tokens (`TBD`, `TODO`, `???`, `etc.`) in any authored
text field: intake summary, answers, rationales, acceptance checks, narrative
prose.

**5 · CRITIQUE**
Knowledge: an adversarial checklist — placeholder scan, internal contradiction,
ambiguity, scope, unfalsifiable requirements, plus the traps this repository has
already paid for.
Tools: `file_finding({ severity, target, claim, fix })` ·
`resolve_finding({ id, how })` · `list_findings()`
Severity ladder: `blocking` (the blueprint is wrong or unbuildable) ·
`major` (a cold executor would stop and ask) · `minor` (worth knowing, not worth
blocking).
Gate: **every checklist item has a verdict** — coverage, not count, or the agent
files three trivia and passes — and zero open findings at `major` or
`blocking`. Only the human can accept a finding as won't-fix, which records the
acceptance rather than deleting the finding.

**6 · SHIP**
Knowledge: what a cold executing agent expects to receive, and who reads which
view.
Tools: `write_narrative({ sectionId, prose })` · `check_ready()`
Gate — **the sync invariant**: every task id referenced in the narrative exists
in the graph, and every task in the graph is referenced by the narrative. A real
breakable check rather than one true by construction. Then the human clicks
READY — there is no tool for it — and the app exports `blueprint.md`,
`blueprint.json` and `journey.json`.

**Gates are live, not stamps.** Editing an answer in phase 1 while standing in
phase 5 turns phase 1 red, visibly, and the agent's next `get_state()` sees it.

## 6. The knowledge payload

These skills are written for a Claude Code harness. Verbatim, they instruct the
agent to announce skill invocations, create git worktrees, and save files to
`docs/superpowers/plans/`. A browser agent has none of that. Each phase guide is
therefore a **retargeted adaptation** — method preserved, harness stripped,
repointed at the page's own tools.

**The page becomes the harness.** State instead of files, gates instead of
checklists, the human's click instead of a subagent's review.

| Phase | Source | Licence |
|---|---|---|
| 0 Intake | `superpowers:brainstorming` (context exploration, scope assessment) + original | MIT |
| 1 Interrogate | `superpowers:brainstorming` | MIT |
| 2 Research | **written here**, from this repository's own evidence discipline (`docs/BRIEF-FOR-REVIEW.md`) | house |
| 3 Decide | `superpowers:brainstorming` (approaches, isolation and clarity) + the ADR template | MIT + public |
| 4 Plan | `superpowers:writing-plans` | MIT |
| 5 Critique | `superpowers:requesting-code-review`, `receiving-code-review`, brainstorming's spec self-review | MIT |
| 6 Ship | `superpowers:verification-before-completion`, `executing-plans` | MIT |

superpowers is MIT, © 2025 Jesse Vincent — verified in the plugin cache.
Attribution ships as `THIRD_PARTY.md` carrying each licence, and every phase
guide names its source in the returned text, so the agent is told where the
method came from.

Phase 2 is the honest gap: there is no tested public research skill in the set,
so that guide is ours.

**Not claimed:** phase-sliced delivery resembles context economy, but §8
abandoned that argument as unproven and this design does not resurrect it. The
claim is governance.

## 7. Concurrency and error handling

**Optimistic concurrency, enforced.** The probe only instrumented it (§6.3);
here it is a primitive, because the human is answering questions in the UI while
the agent works, so stale writes are certain rather than hypothetical.

    get_state()                          -> { version: 17, ... }
    apply({ expectedVersion: 17, ... })  -> ok, version 18
    human edits an answer                -> version 19
    apply({ expectedVersion: 18, ... })
      -> { error: "STALE_STATE", currentVersion: 19,
           changed: ["answers.q4"],
           message: "The workspace changed since you last read it." }

**Structured refusals that name the cause, not the symptom.** GATE-1 defect 3:
a refusal reading "Palette — rgb(255,255,255)" was true and useless; the real
cause was a wiped stylesheet. Refusals carry `{ error, phase, check, offenders,
guide }` and point at the phase guide clause they enforce.

**Apply → validate → roll back, atomically.** Ported from `applyGated`. A
rejected state is never painted.

**Prose and enforcement cannot diverge.** GATE-1 defect 2: the gate enforced
less than the standard stated, which made "derived correctly" unfalsifiable.
Here every rule asserted in a phase guide has exactly one predicate in the gate
engine, and a test asserts the two sets are equal. A guide clause with no
predicate fails the build.

**The human cannot create an unsatisfiable state.** GATE-1 defect 1: the
operator typed one number and produced a standard no artifact could satisfy, and
the panel said nothing. UI edits are validated against downstream gates and warn
before they land.

**Governance is visible in the page** (§9's resolution of the leverage tension):
an event panel shows every tool call, every refusal, every human confirmation.
The human watches the gate bite rather than reading about it in an API.

## 8. Data model

One versioned document:

    {
      version, phase, concept,
      intake:    { summary, knowns[], unknowns[], assumptions[] },
      questions: [{ id, text, why, options[], answer, deferred }],
      claims:    [{ id, text, loadBearing, evidence[] }],
      decisions: [{ id, question, options[], chosen, rationale,
                    rejected[{ option, reason }], locked }],
      tasks:     [{ id, title, deps[], acceptance, tracesTo }],
      findings:  [{ id, severity, target, claim, fix, status }],
      narrative: { [sectionId]: prose },
      events:    [{ t, actor, kind, detail }]
    }

Both views render from this. The narrative is authored prose, the graph is
structure, and the sync invariant binds them.

`checks` is **not stored** — `get_state()` computes it from this document on
every read, so a gate can never report a stale verdict. `tracesTo` holds a
question id or a decision id; there is no separate requirements collection, and
nothing in the plan may trace to something that does not exist.

## 9. Testing

`node --test` on Node 26. Zero dependencies, consistent with the probe.

- **Gate predicates**, unit tested against fixtures: acyclicity, acceptance
  presence, trace resolution, placeholder scan, question resolution, evidence
  binding, checklist coverage, sync invariant.
- **Guide↔predicate parity**: the test that keeps prose and enforcement equal.
- **Stale-write rejection**, including the `changed` field.
- **A stub agent** driving all seven phases headlessly, end to end — the probe
  proved the value of testing the tool surface against a stub before a live run.
- **A live run** against a real agent in a browser, recorded. That recording is
  the demo.

## 10. Scope

**In:** the spine, seven phases, both renderers, the export, the event panel,
attribution.

**Out:** accounts, multi-device, server persistence, collaboration between two
humans, any LLM call made by the page itself.

**Deferred, not designed:** domain knowledge packs — a web-project profile
pulling in `frontend-design` and `web-design-guidelines`. The obvious v2.

## 11. Risks

- **Seven phases is a lot of surface.** Mitigated by phases-as-data; a phase
  that cannot be finished is deleted from a config array, not from the app.
- **The agent may not reach for `get_phase_guide` unprompted.** Level 0 says it
  will — the probe's agent called `get_house_rules` before touching anything —
  but that was one model on one task. If it fails there is no fallback channel
  (§4), so tool naming carries the steering.
- **Judged as a wrapper.** The defence is the absence of tools for human
  authority, and the gates being visible in the page.
- **Repository placement.** Keel is built in this repository under `keel/`, on
  `feat/keel`, leaving the frozen probe untouched. Rationale: the probe is the
  evidence base the submission cites. Reversible — extraction to its own
  repository is a directory move.

## 12. Open questions for the build

None. The two that were open at the end of brainstorming are now settled in
this document: the severity ladder is defined in §5 phase 5, and the critique
checklist is **fixed for v1**, living in that phase's config object — it grows
by editing config, per §3's phases-as-data, not by a per-project mechanism that
would need designing.
