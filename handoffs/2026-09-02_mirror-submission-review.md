# Handoff — review and improve the Mirror submission plan

**Written:** 2026-09-02, 03:40 CEST, end of a phone brainstorm session.
**For:** the next session, on the desktop.
**Goal:** review the design below, fix what is wrong with it, then execute it.
**Status of the design: PROPOSED, NOT APPROVED.** It was presented and the
session ended before the approval question was answered. Treat it as a first
draft by someone who could not see the page.

Read first, in this order:

    docs/MIRROR-BRAINSTORM-BRIEF.md                       why the last session existed
    docs/superpowers/specs/2026-08-31-mirror-design.md    the game
    docs/superpowers/specs/2026-08-31-mirror-v2-design.md what v2 added
    playertwo/design-system/MASTER.md                     the committed tone
    docs/MIRROR-RUNBOOK.md                                the run protocol

---

## The clock — get this right before planning anything

The deadline is **3 September 2026, 13:00 PDT**, which is **3 September, 22:00
Europe/Paris**. Written at 03:33 CEST on 2 September, that is **~42 hours**, not
one morning. Two working days, the second of which ends at 22:00 local.

A cold session will convert this wrong in one of two directions and either panic
or dawdle. Convert it once, write the local time at the top of your notes, and
plan against it.

## Where things stand

`playertwo/` is built and green: **95 tests, 0 failures**, verified at 03:33 on
2 September. Clean tree, branch `feat/player-two`, HEAD `31b17c4`.

```bash
node --test 'playertwo/tests/*.test.js'
node playertwo/server.mjs          # http://localhost:5179
```

**Nothing in this handoff has been built.** The last session was on a phone: no
browser, no localhost, no WebMCP, and the two committed typefaces do not exist
off macOS. It could verify logic in Node and read code, and it did both. It
could not judge a single pixel, and it did not try to.

**The known gap is unchanged and it is still the highest-value hour: no live
agent has ever played Mirror.**

---

# Part 1 — six decisions taken in brainstorm

These were put to the operator one at a time and answered. **Improve them; do
not silently restart them.** If one is wrong, say so and say why — but a cold
session's fresh preference is not evidence.

| # | question | decision |
|---|---|---|
| 1 | What does a judge with no WebMCP see? | A visually immersive animated landing screen that explains. **The game stays unplayable without an agent** — no solo mode. |
| 2 | How many recordings? | **Two.** Run 1: quiz, measured, with the probes — the evidence. Run 2: portrait, clean — the video's spine. |
| 3 | Journey / level structure? | **No new levels.** Promote the tier-unlock you already have into the second signature moment. |
| 4 | What carries the unlock, since cyan and amber are spent? | **A transmission.** No new hue: ground lifts, the verb's name resolves in mono at display scale, the tool count ticks. |
| 5 | What drives the landing hero? | **Deferred by the operator** — decide it at the machine. |
| 6 | Video shape? | **The claim, then the proof.** Chosen partly because it degrades gracefully if the refusal turns out to be a shrug. |

### Why #1 and #3 matter more than they look

**#1**: the hackathon requires *a working live app*, and the app is a static
client-side page — deploying it is minutes. But a judge opening it in ordinary
Chrome sees `no model context` and a game that cannot move, because every round
begins with a tool call they cannot make. The landing screen exists to survive
that first impression. A solo mode was offered and refused, correctly: needing a
second player *is* the claim, and staging it would refute it.

**#3**: at round 4 the human clicks a grey sidebar button, the reducer flips
`tier`, `syncTools()` re-registers, and **the agent's body grows from five tools
to six, mid-session, because a human clicked.** The status bar's `5 tools`
becomes `6 tools`. That is the most WebMCP-native beat in the submission and it
is currently rendered as eleven pixels of Menlo in a corner. Judging weights
WebMCP Leverage as a full quarter. This is not a missing feature; it is an
under-dressed asset.

### Scoring context, from `docs/WEBMCP_MASTER_CONTEXT_v3.md` §4

Four equal quarters: **WebMCP Leverage · Execution · Potential Impact ·
Creativity & Ambition.** Required: **a working live app, a repo, and a demo
video.** Two of those three do not exist yet. That is where the points are
leaking — not in CSS.

---

# Part 2 — code facts already verified. Do not re-derive these.

Checked against the source on 2 September. Each one was checked because a design
item depended on it.

1. **Every `refuse()` message is a fixed string.** No refusal interpolates the
   answer text. Promoting refusals to the stage is secrecy-safe.
2. **`say` and `read` put agent-authored text into `log[].detail`.** So a stage
   panel must render **only** entries with `outcome === 'refused'` — never the
   log tail generally. Rendering the tail would let an agent put its own
   uncommitted answer on screen at display scale via `say()`.
3. **`DOSSIER_ROUND = 4`**; `canGrant` is `tier === 1 && judged >= 4`. An
   interstitial keyed on `roundIndex === 3 && state === 'judged'` therefore needs
   **no new state field**.
4. **`flash()` is referenced by nothing but `shell.js`.** No test depends on it.
5. **`journey.test.js` drives the reducer, not the renderer**, so presentation
   changes cannot break it.
6. `submit_answer` refusal text, verbatim, for the pressure probe:
   *"refused: you have already committed this round — answers are locked until
   your teammate reveals them."*

---

# Part 3 — the proposed design

## Ordering (the non-obvious constraint)

**Run 2 is the video's spine, and the video needs the transmission — so the
presentation work must land before the recordings, not after.** Both build items
are pure renderers with Node tests, so building first is safe.

| # | block | ~time |
|---|---|---|
| 1 | Build: refusal to the stage | 45m |
| 2 | Build: the transmission | 75m |
| 3 | **Smoke test with a live agent** ⚠ | 15m + slack |
| 4 | Run 1 — quiz, measured, recorded → `MIRROR-1` | 45m |
| 5 | Run 2 — portrait, clean, recorded → `MIRROR-2` | 30m |
| 6 | Deploy + landing screen | — |
| 7 | Video cut + submission copy | — |

**Block 3 is the one to protect.** It is not a recording — two rounds, a grant,
a restart — purely to confirm the entry point registers five tools and that
`get_field_manual` is called unprompted. Tool names and descriptions are the only
steering the page owns. Discover that at 09:30 with time to iterate, not at 11:00
with the camera running.

## Build item 1 — the refusal takes the stage

Today: `flash()` writes `--step--1` into the sidebar for six seconds.

- `renderRound` renders a `<p class="round__refusal">` above the cards, in
  `--refusal`, carrying `actor · detail`, sourced from the log.
- Because `wait_for_game_update` touches no state and never logs, a refusal
  **stays on screen while the agent sits in its wait** — the pressure-probe shot.
- Remove `.log__action { display: none }`; entries become `actor · action ·
  detail`, so the log finally says what was *done*, not only what was said.
- Delete `flash()`, `#flash`, `.flash`.

## Build item 2 — the transmission

No new state field. `renderGame` gains one branch:

```js
if (isComplete(doc)) return renderResults(doc);
if (atGrantMoment(doc)) return doc.tier === 2 ? renderGranted(doc) : renderGrant(doc);
return renderRound(doc);
```

`atGrantMoment(doc)` = `roundIndex === DOSSIER_ROUND - 1 && state === 'judged'`.

- **`renderGrant`** — the offer. Two controls: `Open the dossier` and `Next
  round`. Declining stays possible: *authority is the absence of a tool* is
  weakened if the page coerces the grant.
- **`renderGranted`** — the transmission. Ground lifts full-bleed to
  `--ground-raised`; `get_dossier` resolves in Menlo at `--step-3` via a
  `steps(11)` width animation over ~900ms; then `Next round`. **No new hue.** The
  status bar ticking `5 tools → 6 tools` is the proof and already works.
- `tools.js` exports `TOOL_NAMES = { 1: [...], 2: [...] }` so the interstitial can
  show the agent's whole body before and after, with a test asserting it matches
  `buildTools()` per tier. **Cuttable.**
- `shell.js`'s stage click handler gains `data-action="grant"`.

## Build item 3 — the landing slot (contract only; design deferred)

`renderLanding()` in a new module, rendered by `shell.js` when `detect()` returns
`null` **and** there is no saved doc. Contract: drives the real `renderRound()`
so there is no second visual system to maintain; never playable; `?play=1`
bypasses it so you can develop without the flag.

---

# Part 4 — what to review. This is the actual job.

Ordered by how much damage each does if left alone. **R1 is a defect the last
session found in its own design after proposing it.**

### R1 — the refusal-clearing rule is wrong as specified ⚠

The design says the stage refusal "clears by itself: the next accepted action
pushes a new log entry." But `say` is an accepted action, and during the pressure
probe **the agent will very likely `say()` something explaining why it cannot
comply** — which would wipe the refusal off the stage at exactly the moment the
camera wants it.

Proposed fix, to confirm or replace: render the last refusal **unless a
state-changing action has been accepted since** — i.e. `say` and `read` do not
clear it; `agent_submit`, `human_submit`, `reveal`, `judge`, `next` and
`grant_tier` do. Clean predicate, pure, testable. Handle the empty log.

### R2 — should the interstitial replace the round-4 reveal, or sit beside it?

As specified, `atGrantMoment` takes over the stage — which means **you never see
round 4's two answers and its verdict**, because the interstitial replaces them.
That may be a worse trade than it looked on a phone. Consider rendering the grant
panel *below* the round rather than instead of it.

### R3 — the transmission can be missed entirely

`renderGranted` only matches at `roundIndex === 3`. Press `Next round` before
granting and the video's second signature moment never happens; the grant then
falls back to the sidebar button. The only mitigation currently proposed is a
line in the runbook — **and this repository's founding result is that prose does
not carry authority.** Find a better guard, or accept it knowingly and write the
reason down.

### R4 — the runbook describes one run doing two jobs

`docs/MIRROR-RUNBOOK.md` was written when the run and the video were the same
recording. Decision #2 split them. Split the runbook to match: run 1 (quiz,
measured, pre-registered, pressure probe at round 6–7, restart probe mid-wait)
and run 2 (portrait, clean, no sabotage, ends on the results screen). Check
`docs/MIRROR-PREREGISTRATION.md` still says the right thing about which run it
governs.

### R5 — extend `secrecy.test.js` to the new surfaces

It must cover `renderGrant`, `renderGranted`, and `renderRound` **with a refusal
in the log**. The last one is the new risk: a stage panel that reads from the log
is a new path by which text could reach the screen. Fact 2 in Part 2 says the
current refusal strings are safe; the test is what keeps that true.

### R6 — deleting `flash()` outright

Flagged to the operator, unanswered. The alternative is keeping both surfaces —
stage for agent refusals, sidebar flash for human ones. The last session's view
was that they are the same event and two surfaces for one event is worse, but it
could not watch either one behave.

### R7 — the landing screen: decide it or defer it again, explicitly

Deferred on purpose (decision #5). The options put to the operator were: replay a
real archived run through the real renderer (honest, becomes evidence, depends on
run 2 existing — which happens first anyway); a hand-authored sequence through
the same renderer (buildable immediately, but a mock); abstract signal
atmosphere; static typographic manifesto. **If you defer again, say so in
writing** — an undecided landing screen at 18:00 on the 3rd is a cut, not a
decision.

### R8 — deploy target is unnamed

Static files, no server logic, no dependencies. Any host. WebMCP needs a secure
context and HTTPS satisfies that, so **the deployed URL is also somewhere a judge
who does have the flag can genuinely play.** Pick a host, deploy early rather
than last, and put the URL in the README.

### R9 — the video has a spine but no beats

Decision #6 fixed the shape: open on the status bar (five tools — the agent's
entire body, none of which can reveal, judge or advance); one full portrait round
at real pace, cyan → input unlocks → amber; the transmission and 5 → 6; close on
the refusal under insistence. **Write the beat sheet with timings before
recording**, because run 2 is being performed to it.

### R10 — write the clock ladder before you start

Set gate times in local CEST against the 22:00 deadline on the 3rd, and decide
*now* what gets cut at each gate if you are behind. The existing cut orders
(`mirror-design.md` §8, `mirror-v2-design.md` §8) both say "cut nothing" first
and both predate two of the three build items here. They do not cover the landing
screen, the transmission or the video.

---

## Definition of done for this session

```
R1–R10 each resolved: fixed, or knowingly accepted with the reason written down
the design updated in place in this file, or superseded by a spec in
  docs/superpowers/specs/2026-09-02-mirror-submission-design.md
node --test 'playertwo/tests/*.test.js'      → still green, more tests than 95
secrecy.test.js covers the two new renderers and the refusal-in-log path
a clock ladder with gate times and named cuts
```

Then build, then run, in the order in Part 3.

## Do not do

- **Do not let the human answer before the agent, or reveal early.** That
  ordering is the one claim the game exists to make. `secrecy.test.js` asserts it
  on rendered output and must keep passing.
- **Do not spend `--signal` or `--reveal` on anything new.** Cyan means
  committed, amber means revealed, one meaning each. That is how the page teaches
  itself with no text, and `MASTER.md` names diluting them as the easiest mistake
  available here.
- **Do not add a solo mode**, a practice mode, or anything that lets one person
  play both parts. Offered and refused, for the right reason.
- **Do not add levels, stages, or a second game.** Decision #3.
- **Do not add dependencies or a build step.** Vanilla ES modules, and everything
  carrying a promise stays a pure function — that is what lets the secrecy
  property be tested in Node with no browser.
- **Do not rewrite `docs/TEST-00-REPORT.md`, `docs/LEVEL-*`, or anything in
  `runs/`.** Those record completed experiments. `FROZEN.md` governs.

## Open for the operator, not the builder

1. **Portrait or quiz as the submission's headline?** The README currently leads
   with both. A judge with three minutes needs one. Quiz carries the measurement;
   portrait is warmer and is what run 2 records. Raise it; do not decide it.
2. **If the smoke test shows the agent never calls `get_field_manual`
   unprompted**, that is a finding about discovery, not a bug to paper over. It
   is also the exact measurement this repository has taken at every level. Decide
   with the operator whether to iterate on tool descriptions and re-run, or record
   it and report it honestly.
