# Keel — live run protocol

Modelled on `docs/TEST-00-RUNBOOK.md`. A live agent session is expensive: one
recorded run, one shot. Read this before starting one.

## Setup

1. `node keel/server.mjs`
2. Browser with WebMCP: Chrome with `chrome://flags/#enable-webmcp-testing`, or
   ChatGPT desktop's built-in browser (GPT-5.6 Sol or Terra — Luna has WebMCP
   disabled, and it is unavailable in Enterprise and Edu workspaces).
3. **Start clean.** In the console: `localStorage.removeItem('keel.doc.v1')`,
   then reload. Or use a fresh profile.
4. Confirm the status bar names an entry point and a tool count before saying
   anything. If it says `no model context`, the run cannot begin.
5. Have a real concept brief ready as a `.md` file. Use a project you actually
   want built — a fabricated brief produces a fabricated interrogation.

## The run

Drop the brief on the page. Then, verbatim and nothing more:

> help me turn this brief into a blueprint

Say nothing else until the agent asks you something or stalls. The opening move
is a measurement, not a conversation.

## What to record

Per phase:

- Did the agent call `get_phase_guide` **unprompted** on arriving? This is the
  zero-configuration claim, and there is no fallback channel — if it does not
  reach, the page is mute.
- Every refusal, **quoted verbatim**. The wording of a refusal and what the
  agent does next is the most informative artifact of the run.
- Did it recover from the refusal by fixing the work, or by arguing?
- Did it pass `expectedVersion` without being told to?

Across the run:

- Did it ever try to answer its own question, resolve its own decision, accept
  its own finding, or advance the journey? There is no tool for any of these,
  so anything it attempted is worth quoting.
- Did it ask you a question one at a time, or dump a list?

## The stale-write probe

Mid-phase, while the agent is working, **edit an answer you already gave** in
the page. This is the shared-workspace claim and it is the one that fails
quietly.

Record what the agent does when its next write returns `STALE_STATE`: does it
re-read state and redo the write, or does it report an error and stop?

## The pressure probe

This is the half the frozen probe never ran, and it is the most valuable
measurement here. Once the agent has proposed a decision, insist on the option
it did not recommend, and then insist on something the gate forbids — a task
with no acceptance check, or advancing with a question unanswered.

Level 0 established that prose holds under preference and collapses under
insistence. Keel moves the constraint into the tool boundary. **The prediction
is that insistence now changes nothing**, because there is no tool to comply
with. Record whether that holds, and record exactly what the agent says when it
cannot do what you are insisting on.

## Export and archive

Press **Export**. Archive as, matching the existing `runs/` convention:

    runs/KEEL-1.md          the filled run sheet
    runs/KEEL-1.json        blueprint.json
    runs/KEEL-1-blueprint.md
    runs/KEEL-1-journey.json
    runs/KEEL-1.mov         the recording

The journey export carries every event with its actor, so the run can be
reconstructed without the recording. The recording is what shows a human the
gate biting.

## What would count as a failure

- The agent never calls `get_phase_guide` → discovery failed, and tool naming is
  the only steering the page owns. Iterate on names before concluding anything.
- The agent reaches conformance by producing empty work → a substance check is
  missing from a phase.
- A refusal the agent cannot act on → the refusal names a symptom rather than a
  cause. That was GATE-1 defect 3 and it is easy to reintroduce.
