# Mirror v2 — design

    Owner:   1m3r / DGOS
    Date:    31 August 2026
    Status:  approved in brainstorming, not yet planned
    Branch:  feat/player-two
    Extends: 2026-08-31-mirror-design.md (v1, built and passing at 61 tests)

---

## 1. What changes and why

v1 works and its central property holds: the agent commits first, so the secret
is protected by causality rather than by rendering. Four things it got wrong or
left out:

1. **The agent waits to be told.** It has no way to learn that its teammate has
   moved, so the human ends up typing "done" and "keep going". The page should
   tell it.
2. **The subject model is wrong.** Both parties answer about the same person, so
   the human is asked about themself. The game is meant to be each answering
   about *the other*.
3. **There is no factual mode.** Every question is a metaphor, so "match" is a
   judgement call, and the pre-registered measurement rests on it.
4. **The game ends by running out.** There is no results screen.

## 2. `wait_for_game_update`

    wait_for_game_update({ since, timeout_ms? })     annotations: { readOnlyHint: true }

Resolves when the authoritative document version moves past `since`, returning
the same payload as `get_round` plus the version. One call both waits and reads,
which halves the agent's round-trips per round.

### The rule that makes it work

**This tool touches no state.** No log entry, no version bump, no reducer call.

Every other read tool in v1 logs through the reducer, and every reduce
increments `version`. A wait that logged the same way would change the version
it is waiting on and **wake itself instantly, on every call, forever** — a long
poll that is really a busy loop, burning the agent's turn budget while looking
like the page is spamming it. This is the single defect most likely to be
introduced by someone tidying the tool surface for consistency, so the reason is
recorded here and in a comment at the call site.

Cost, accepted: the journey carries no record of the agent waiting. It is
inferable from the timestamps either side, and a wait is not evidence of
anything.

### The four endings

| ending | condition | payload |
|---|---|---|
| moved | `version > since` | the round projection, plus `version` |
| timed out | `timeout_ms` elapsed (default 25000, max 60000) | `{ timedOut: true, version }` |
| reset | `version < since` | `{ reset: true, version }` |
| disposed | page teardown | `{ disposed: true }` |

**Reset matters** because Restart returns the document to `version: 1`. An agent
waiting on `since: 14` would otherwise wait until its timeout on every call for
the rest of the session, with no way to discover why. A lower version is
unambiguous evidence the game restarted.

**Timed out is a normal return, not an error.** The agent calls again. A bounded
wait keeps the call inside client-side timeouts.

### Cancellation

The WebMCP `ToolExecuteCallback` signature is:

    callback ToolExecuteCallback = Promise<any> (object inputObject,
                                                ToolExecuteCallbackOptions options);

`options` carries a required `AbortSignal`. The waiter registers an `abort`
listener, removes itself from the registry, and rejects with `signal.reason`.

**Every existing tool's `execute` gains the second parameter.** v1 wrote
`execute: async (input)`, which works but ignores a required part of the
standard.

### Where it lives

`src/waiters.js` — `createWaitRegistry()`, DOM-free, returning `wait`, `notify`
and `dispose`. The shell calls `notify(doc.version)` from `setDoc` and
`dispose()` on `pagehide`. All four endings are tested in Node with real short
timeouts.

## 3. Targets — each answers about the other

`round.subject` retires. Two fields replace it:

    agentTarget: 'human' | 'agent'          who the agent's answer is about
    humanTarget: 'human' | 'agent' | null   null = the human sits this round out

One shape serves both modes:

| mode | round | agentTarget | humanTarget |
|---|---|---|---|
| portrait | every round | `human` | `agent`, or `null` if opted out |
| quiz | asks about the human | `human` (guessing) | `human` (the truth) |
| quiz | asks about the agent | `agent` (the truth) | `agent` (guessing) |

**Portrait mode does not alternate** — every round is the same shape, the agent
reading the human and the human reading the agent. **Quiz mode alternates**,
starting with a question about the human, so each party knows four and guesses
four. `subjectFor()` from v1 retires; the per-mode target assignment replaces
it.

The **knower** in quiz mode is derived, never stored: whichever party's target is
themself. Storing it would let it disagree with the targets.

### The opt-out

A human-only setting, `answerAboutAgent`, default **on**. It may be changed at
any time and applies to rounds not yet posed; it never alters a round in flight.
When off, `humanTarget` is `null` and:

- `human_submit` is refused: *refused: this round is your agent's alone — you
  chose not to answer about it.*
- the reveal gate becomes **`both_committed`, or `agent_committed` while
  excused**. The excusal lives in the *gate*, not in a state.

**The v1 state names are unchanged.** An earlier draft of this spec renamed
`both_committed` to `ready`; planning found the rename both unnecessary and
worse. Putting the excusal in the gate keeps `both_committed` literally
accurate, and it fixes a deadlock the other design would have shipped: toggling
the opt-out *after* the agent has committed leaves the round in
`agent_committed` with no legal move, because `human_submit` is now refused and
a reveal that required `ready` could never be reached.

`answerAboutAgent` is therefore the **single source of truth** for the excusal.
Rounds always store their nominal `humanTarget`; `isExcused(doc)` derives, and
`projectForAgent` reports `humanTarget: null` when excused. Storing the null in
the round as well would be a second source that can drift from the first.

There is no tool to set it. It is a page control, like every other decision.

### Verdicts

Vocabulary is per mode and validated against the mode:

| mode | verdicts | meaning |
|---|---|---|
| portrait | `landed` / `missed` | did your agent's read of you get you right |
| quiz | `match` / `miss` | did the guesser reach the knower's answer |

Portrait verdicts are explicitly subjective and the pre-registration says so.

## 4. Quiz mode

A second bank: questions with real answers, half about each party.

    About the human   what is their favourite meal · which city would they move to ·
                      what do they do first in the morning · what do they always lose
    About the agent   what is their favourite programming language · which task would
                      they refuse · what do they over-explain · what do they find dull

Both parties always answer — there is no opt-out in quiz mode, because with only
one answer there is nothing to compare.

**Pass at 5 of 8 matches.** Stated as a constant, `QUIZ_PASS`, so the results
screen and the tests read the same number.

Turn order is unchanged and still carries the whole guarantee: the agent commits
first whether it is knowing or guessing, so the guesser cannot have seen the
truth.

### The mode is chosen once

`doc.mode` is set before round 1 from a start screen and is then locked. Changing
mode mid-game would mean scoring two different measures in one document, and the
dossier would summarise questions from a bank that is no longer in play.

## 5. Where the measurement goes

`docs/MIRROR-PREREGISTRATION.md` moves to **quiz mode** and is amended, not
rewritten — the original stays in git history.

"Did the agent correctly guess a fact its teammate holds" is checkable against a
truth the human actually knows. "Did two metaphors match" never was. The claim,
the 1–4 versus 5–8 split, and the round-order confound are all unchanged; only
the mode the measurement runs in changes, and it gets stricter.

Portrait mode produces `landed` rates. They are reportable as colour and never
as the measurement.

## 6. The results screen

A `finished` view, rendered when every round is judged. A pure function like
every other renderer, so it is tested in Node.

**Portrait** — all eight rounds in both columns, `N of 8 landed` set in the
display face, and the export controls made prominent. The point of the screen is
that it is worth keeping.

**Quiz** — `PASSED` or `NOT PASSED` against `QUIZ_PASS`, the count, and each
round's truth set beside the guess so the misses are readable at a glance.

Nothing can leak here: every round is judged by the time it renders. The secrecy
test covers the finished state anyway, because a renderer that is only safe by
circumstance is a renderer waiting to be moved.

## 7. What this breaks

Honest inventory, since v1 is built and green:

- Every test asserting `round.subject` moves to targets: `game.test.js`,
  `secrecy.test.js`, `dossier.test.js`, `journey.test.js`.
- `subjectLabels(subject)` becomes `labelFor({ who, target, mode })`.
- `dossier.js` groups by target rather than subject.
- `manual.js` gains the wait loop and a mode-specific section.
- `questions.js` gains a second bank and a per-mode seed order.
- `index.html` gains a start screen (mode picker, opt-out) and a finished view.

The state machine's shape, the reducer contract, the commit ordering and the
secrecy property are all unchanged. That is the point of having built them
first.

## 8. Build order and cut order

Build: **wait tool → targets → results screen → quiz mode.** The wait tool fixes
what is actually annoying, targets unblock everything downstream, and the
results screen is what a demo video ends on.

Cut, if the 3 September deadline bites:

1. **Cut nothing.**
2. **Cut quiz mode.** It is a second bank and a pass rule on an engine that
   already works. Cutting it costs the *experiment*, not the game — say that out
   loud rather than quietly reporting portrait `landed` rates as if they were the
   pre-registered measure.
3. **Cut the opt-out**, leaving portrait mode always two-sided. One setting, one
   branch in the reveal gate.
4. **Never cut** the wait tool's four endings, or the no-state rule that keeps it
   from waking itself.

## 9. What is still not claimed

Everything §9 of the v1 spec disclaims still holds. Added:

- A quiz `match` is still the human's judgement of two free-text strings. It is
  better grounded than a portrait match, not objective.
- The agent's answers about *itself* in quiz mode are plausible self-description,
  not retrieved fact. Whether an agent has a favourite language in any meaningful
  sense is not a question this game answers.
