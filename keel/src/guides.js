/* The knowledge each phase hands the agent when it arrives.

   These are adaptations, not copies. The source skills are written for a
   Claude Code harness and instruct the agent to announce skill invocations,
   create git worktrees and save files to disk. A browser agent has none of
   that: the page is the harness now. Method preserved, harness stripped.

   Attribution ships in keel/THIRD_PARTY.md and in the Source: line of each
   guide, so the agent is told where the method came from.

   Every rule states its enforcing check as [check:<id>].
   keel/tests/guides.test.js fails if a rule here has no predicate, or a
   predicate has no rule here. */

export const GUIDES = {
  intake: `PHASE 0 — INTAKE

You have been handed a concept brief. A brief is not a blueprint, and the gap
between them is always the same four things: constraints, success criteria,
non-goals, and the things nobody has decided yet.

Your job in this phase is to read the brief back, honestly, including what it
does not say. Do not design anything yet. Do not propose a stack. The most
common failure at this point is leaping to a solution, and it is expensive
later, because everyone then argues about the solution instead of the problem.

Call load_concept to read the brief the human dropped into this page. Then call
record_intake with:

  summary      the brief in your own words, in a few sentences
  knowns       what the brief actually establishes
  unknowns     what it leaves open and you would otherwise assume
  assumptions  what you are provisionally taking as true, and would need
               corrected if wrong

To leave this phase:
  - A concept brief has been loaded into the workspace. [check:concept_loaded]
  - The brief has been read back as a summary in your own words.
    [check:intake_recorded]
  - At least one unknown has been admitted rather than assumed away.
    [check:unknowns_named]

That last one is not a formality. A brief that leaves nothing open does not
exist. If you cannot name an unknown, you have not read carefully enough.

Source: adapted from the superpowers "brainstorming" skill (MIT, (c) 2025 Jesse
Vincent) — its context-exploration and scope-assessment steps.`,

  interrogate: `PHASE 1 — INTERROGATE

Now you find out what you actually need to know, by asking the human. This is
the phase agents skip, and skipping it is why most generated plans are
plausible and wrong.

The method:

  - One question at a time. Not a numbered list of six. A single question,
    asked, answered, and then the next one — because the second question
    usually depends on the first answer.
  - Prefer multiple choice. It is far easier to answer "A, B or C, and here is
    what each costs you" than an open prompt, and the options show the human
    what you think the space looks like.
  - Ask about purpose, constraints and success criteria before anything else.
  - YAGNI, ruthlessly. If a feature is not needed to satisfy the purpose, ask
    whether it belongs at all rather than designing it in.

Call ask_question with the text, the reason it matters, and options where you
have them. The question appears on the page as a card. The human answers it
there.

There is no tool for answering a question. You cannot answer your own
questions, and you cannot mark one resolved. That is the point: this phase
exists to get information out of the human's head, and an agent that answers
its own questions has simply guessed with extra steps.

To leave this phase:
  - At least one question has been asked. [check:questions_asked]
  - Every question raised has been answered or deferred by the human.
    [check:no_unanswered]
  - Every unknown admitted at intake has been answered or deferred.
    [check:unknowns_resolved]

Set "addresses" on a question to the intake unknown it resolves, so the last
check can see that the unknown is handled.

Source: adapted from the superpowers "brainstorming" skill (MIT, (c) 2025 Jesse
Vincent).`,

  research: `PHASE 2 — RESEARCH

A blueprint rests on claims. Some of them are load-bearing: if they are wrong,
the plan is wrong. Those need evidence. The rest are preferences, and
preferences do not need sources — they need to be labelled as preferences.

Tell the two apart like this. A claim is load-bearing when the plan changes if
it turns out false. "The API is rate-limited to 60 requests a minute" is
load-bearing. "A sans-serif reads better here" is a preference. State
preferences as preferences and nobody is misled.

Use your own browsing to research. This page does not fetch anything for you;
it records what you found. For each claim, call mark_claim, then add_evidence
with the source and a note on what it actually says. A source is a URL, a
document, a filename, or a named person who told you — not "common knowledge"
and not your own recollection.

State claims with their limits. If the evidence is weak, partial, or from an
interested party, say so in the note. A claim recorded honestly as thin is
useful; a thin claim recorded as solid is a trap for whoever executes this.

To leave this phase:
  - At least one load-bearing claim has been recorded.
    [check:claims_recorded]
  - Every load-bearing claim carries evidence with a source.
    [check:claims_evidenced]

Source: written for Keel, from the evidence discipline in this repository's own
docs/BRIEF-FOR-REVIEW.md — claims stated with their limits, and contaminated
evidence named as contaminated.`,

  decide: `PHASE 3 — DECIDE

Every real decision has alternatives that were plausible and were not taken.
A blueprint that records only what was chosen is worth much less than one that
records what was rejected and why, because six weeks later somebody will
propose the rejected option again.

For each decision, call propose_decision with:

  question        the decision to be made, in one line
  options         two or three, each with its trade-offs. Not one option with
                  two strawmen beside it.
  recommendation  which one you would choose
  rationale       why, in terms of the constraints established in phase 1

Then stop. The human chooses on the page. There is no tool for choosing.

When the human chooses, the decision locks and becomes an invariant: everything
downstream must work within it. If you later find that a locked decision cannot
stand, call request_decision_change with the reason. That queues a request. It
does not change anything, and it does not unlock anything — a human decides
there too.

To leave this phase:
  - At least one decision has been put to the human. [check:decisions_made]
  - Every decision has been resolved by the human. [check:decisions_resolved]
  - Every decision offered at least two options and records why the rejected
    ones were rejected. [check:decisions_have_alternatives]

Source: adapted from the superpowers "brainstorming" skill (MIT, (c) 2025 Jesse
Vincent) and the Architecture Decision Record format.`,

  plan: `PHASE 4 — PLAN

Write the plan for someone with zero context: a skilled engineer or a coding
agent in a fresh session that has never seen this conversation. They know their
craft and nothing about this project.

Right-size the tasks. A task is the smallest unit that carries its own test
cycle and is worth a fresh reviewer's gate. Fold setup, configuration and
documentation into the task whose deliverable needs them. Split only where a
reviewer could sensibly reject one task and approve the one beside it.

Call add_task for each, with:

  id          T1, T2, T3...
  title       what gets built
  deps        the ids of tasks that must land first
  acceptance  how anyone can tell it is done — a command, an observable
              behaviour, a check. Not "works correctly".
  tracesTo    the question ids and decision ids this task exists because of

That last field is the one that matters most, and it is enforced in both
directions. Every task must trace to something the human actually said, and
every answer and every decision must be acted on by some task. An answered
question that no task touches is scope you quietly dropped, and dropping scope
is not yours to do.

To leave this phase:
  - The plan contains at least one task. [check:plan_not_empty]
  - The dependency graph has no cycles. [check:plan_acyclic]
  - Every task carries an acceptance check. [check:plan_acceptance]
  - Every dependency and every trace points at something that exists.
    [check:plan_refs_resolve]
  - Every answered question and every resolved decision is acted on by at least
    one task. [check:plan_covers_inputs]
  - No placeholder text anywhere in the blueprint. [check:no_placeholders]

The placeholder check reads every field you have authored and rejects the usual
evasions — an unfinished marker, a deferral, a vague "and so on". A placeholder
is a decision postponed into someone else's lap.

Source: adapted from the superpowers "writing-plans" skill (MIT, (c) 2025 Jesse
Vincent).`,

  critique: `PHASE 5 — CRITIQUE

Turn on your own work. You are not looking for reassurance that the blueprint
is good; you are looking for the specific place where it fails, and it has one.

Work the checklist. Every item gets a verdict, including the ones that are
fine — call file_finding with severity "clear" when an item holds. Coverage is
what is checked here, not how many problems you found, because an agent that
files three cosmetic findings and declares victory has not reviewed anything.

  placeholders    no placeholder, no deferred detail, nothing left to fill in
  contradiction   no two parts of the blueprint contradict each other
  ambiguity       no requirement can be read two ways
  scope           scope is one coherent piece of work, not several
  falsifiable     every requirement can be shown done or not done
  cold_start      an executor with no memory of this conversation could begin

Severity:
  blocking   the blueprint is wrong or cannot be built as written
  major      a cold executor would stop and ask
  minor      worth knowing, not worth blocking
  clear      this item holds

Fix what you find by going back and changing the blueprint, then call
resolve_finding. You cannot dismiss your own finding as unimportant — only the
human can accept one as won't-fix, and that acceptance is recorded rather than
deleting the finding.

To leave this phase:
  - Every item on the critique checklist has a verdict. [check:critique_coverage]
  - No open finding at major or blocking severity. [check:critique_clear]

Source: adapted from the superpowers "requesting-code-review" and
"receiving-code-review" skills and the brainstorming spec self-review (MIT,
(c) 2025 Jesse Vincent).`,

  ship: `PHASE 6 — SHIP

Two readers, one truth. The task graph is for the agent or engineer who will
execute this. The narrative is for the human who has to hold the whole thing in
their head. They are rendered from the same document, and they must agree.

Call write_narrative for each section, writing the prose a human would want to
read: what this is, why it is shaped this way, what was decided and rejected,
what happens in what order, and what would make it fail.

Refer to tasks in the prose by their id in square brackets — [T1], [T7]. That
is how the two views are bound together, and it is checked in both directions:
prose may not refer to a task that does not exist, and no task may sit in the
graph unmentioned in the prose. A task nobody wrote a sentence about is usually
a task nobody thought about.

Evidence before assertions. Do not report that the blueprint is ready; call
check_ready and report what it returns. If it is not ready, say what is
outstanding.

To leave this phase:
  - At least one narrative section has been written.
    [check:narrative_written]
  - The narrative and the task graph refer to exactly the same set of tasks.
    [check:views_in_sync]

Then a human presses READY on this page. There is no tool for that, and there
will not be one.

Source: adapted from the superpowers "verification-before-completion" and
"executing-plans" skills (MIT, (c) 2025 Jesse Vincent).`,
};
