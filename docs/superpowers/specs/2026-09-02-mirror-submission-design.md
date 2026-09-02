# Mirror — submission design, reviewed

    Owner:      1m3r / DGOS
    Date:       2 September 2026, 21:25 CEST
    Status:     APPROVED — supersedes Part 3 of
                handoffs/2026-09-02_mirror-submission-review.md
    Branch:     feat/player-two
    Supersedes: the PROPOSED design in that handoff, item by item below

This is the review the handoff asked for, plus the two defects that review
found. The handoff's Part 1 decisions stand. Its Part 3 build order does not,
for the reasons in §2 and §3.

---

## 1. The clock — recomputed, and it is not what the handoff assumed

The handoff was written at 03:40 CEST on 2 September and budgeted ~42 hours
from there. **This session opened at 21:04 CEST on 2 September.** Seventeen of
those hours are gone.

    deadline        3 September 2026, 13:00 PDT
                  = 3 September 2026, 22:00 Europe/Paris
    session start   2 September, 21:04 CEST
    remaining       ~25 hours wall clock
    productive      ~14 hours, allowing a night's sleep

Every gate below is in CEST. The named cut at each gate is a decision taken
now, in the cold, not at the gate in a panic.

### The clock ladder

| gate | by | must be true | cut if not |
|---|---|---|---|
| G1 | 2 Sep 23:30 | R0a + R0b fixed, suite green | nothing — this is not cuttable |
| G2 | 3 Sep 00:30 | refusal on stage; log verb; polish | cut the polish items (R11, R12) |
| G3 | 3 Sep 10:00 | transmission built and tested | cut the transmission; grant stays a sidebar button and the video loses its second beat |
| G4 | 3 Sep 11:00 | **live smoke test done** | cannot be cut — see §3 |
| G5 | 3 Sep 13:00 | run 1 (quiz, measured) recorded | cut the pressure/restart probes, keep the run |
| G6 | 3 Sep 15:00 | run 2 (portrait, clean) recorded | reuse run 1 footage; the video gets colder |
| G7 | 3 Sep 16:30 | deployed, URL in README | cut the landing screen, deploy bare |
| G8 | 3 Sep 20:00 | video cut | ship a screen recording with captions, unedited |
| G9 | 3 Sep 21:00 | submission copy filed | — |
|    | 3 Sep 21:30 | **hard stop. Submit whatever exists.** | |

Thirty minutes of slack before the deadline is deliberate. The last thirty
minutes before a hackathon deadline are never spent on what you planned.

---

## 2. Two defects found by looking at the page

The handoff's Part 2 listed six verified code facts. All six hold. But every
one of them was verified by reading source or driving the reducer in Node, and
**the 95 tests contain no path from rendered output back into the reducer.**
Running the page in a browser found two defects in ten minutes. Both are in
that gap, and both outrank R1–R10.

### R0a — portrait mode is unplayable past the first reveal ⚠ BLOCKING

`render.js:49-50` emits the verdict buttons with hardcoded values:

```js
controls.push('<button ... data-verdict="match">Match</button>');
controls.push('<button ... data-verdict="miss">Miss</button>');
```

`game.js:11` declares the vocabulary per mode:

```js
export const VERDICTS = {
  portrait: ['landed', 'missed'],
  quiz:     ['match', 'miss']
};
```

In portrait mode the button sends `match`, the reducer refuses it with
`BAD_VERDICT`, and **the round has no legal move left.** Verified in the
browser: clicking Match at round 1 produces

> refused: in this mode a verdict is landed or missed, and nothing else was
> offered.

and the game stops there, permanently.

Portrait mode is what run 2 records, and run 2 is the video's spine. The
submission's demo video was blocked by a two-line defect that no test caught.

`game.test.js:108` *asserts that `verdict: 'match'` is refused in portrait
mode.* The suite knows the rule the renderer breaks. Nothing connected them.

**Fix.** Derive the controls from `VERDICTS[doc.mode]`, with the labels beside
the vocabulary in `game.js` so they cannot drift apart again.

### R0b — the portrait export miscounts, always

`render.js:83`, inside `renderPortrait`:

```js
const matched = done.filter((r) => r.verdict === 'match').length;
```

In portrait mode no verdict is ever `match`, so the exported `portrait.md`
reports **`0 of 8 judged a match`** on a run that landed five. Reproduced
against a finished portrait document.

The keepsake is the artifact the v1 spec calls "the point". It has been lying
since v2 split the vocabulary. `renderResults` and `dossier.js` both derive the
good verdict correctly; `renderPortrait` was missed.

**Fix.** One exported helper, `goodVerdict(mode)`, in `game.js`. Use it in all
three places so there is one definition rather than three copies, two of which
happened to agree.

### The test class that was missing

Both defects are the same shape: **the renderer emits a string the reducer must
accept, and nothing asserted the round trip.** The fix is a test class, not two
patched lines:

> For each mode, render the round, parse every `data-action` /`data-verdict`
> the page offers, feed each back through `reduce`, and assert none of them is
> refused.

A control the page draws must be a move the game accepts. That property now
has a test, and it would have caught R0a on the day it was written.

---

## 3. Build order — changed, and why

The handoff's Part 3 put the smoke test at block 3, after both build items,
reasoning that run 2 needs the transmission. That is true of the *recording*
and false of the *smoke test*.

**The smoke test measures discovery** — whether the agent calls
`get_field_manual` unprompted, and whether five tools register at the entry
point. Neither depends on the refusal panel or the transmission. Holding it
behind two hours of presentation work buys nothing and risks discovering at
G4 that tool descriptions need rewriting, with the recordings already queued
behind it.

**New order.** R0 fixes first, because the smoke test cannot play portrait
mode until they land. Then the smoke test as early as the operator is
available. Then presentation, then recordings.

    1  R0a + R0b, and the round-trip test class      G1
    2  refusal to the stage, log verb, polish        G2
    3  live smoke test  ⚠ operator-gated             G4
    4  the transmission                              G3
    5  run 1 — quiz, measured                        G5
    6  run 2 — portrait, clean                       G6
    7  deploy + landing                              G7
    8  video + copy                                  G8/G9

### What I can and cannot do about the smoke test

The smoke test needs an agent whose harness exposes page-registered tools —
ChatGPT desktop (Sol or Terra) or Chrome with
`chrome://flags/#enable-webmcp-testing`. **This session cannot be that agent.**
Its browser tools drive the DOM; they are not a model context.

So the smoke test splits, and the half that does not need the operator gets
done first:

- **Mechanical half — this session.** A stub `modelContext` installed in the
  real page in a real browser, registering the real tools and calling their
  real `execute()` in sequence. This proves detection, registration,
  re-registration on the tier flip, and a full round played entirely through
  the tool surface. Everything except the agent's judgment.
- **Judgment half — the operator, at G4.** Does the agent reach for
  `get_field_manual` with no prompting. That is the measurement, and per the
  handoff's open question 2 it is a finding either way, not a bug to paper
  over.

---

## 4. R1–R10, resolved

### R1 — the refusal-clearing rule · FIXED as proposed

The handoff's own defect, and its proposed fix is right. Adopted verbatim:
render the last refusal **unless a state-changing action has been accepted
since**.

```js
const CLEARS = new Set([
  'agent_submit', 'human_submit', 'reveal', 'judge', 'next', 'grant_tier'
]);
```

`say` and `read` are not in it, so the agent explaining itself during the
pressure probe leaves the refusal on screen — which is the shot.

Two details the handoff did not state, both load-bearing:

- Only entries with `outcome === 'ok'` clear. A *refused* `agent_submit` is an
  `agent_submit` entry; if refusals cleared refusals, the second push of the
  pressure probe would wipe the first and the panel would flicker empty at the
  exact moment it matters most.
- Empty log returns null. Scan backwards, return on the first entry that is
  either a refusal or a clearing acceptance.

### R2 — the interstitial replacing round 4 · FIXED, beside not instead

The handoff was right to doubt it. Taking over the stage at
`roundIndex === 3 && judged` hides round 4's two answers and its verdict — the
reveal you just earned — behind an offer.

**The grant offer renders below the round, not instead of it.** The round
stays; a panel appears under it. Nothing is hidden and no state is needed.

The *transmission* still takes the full stage, but only after the click, by
which point round 4's reveal has already been seen and read. The offer is
additive; the payoff is a moment.

### R3 — the transmission can be missed · FIXED properly, not by prose

The handoff proposed keying the transmission on `roundIndex === 3`, which means
pressing "Next round" before granting loses it forever. Its only mitigation was
a line in the runbook — and this repository's founding result is that **prose
does not carry authority.** Mitigating with a runbook line would be the exact
mistake `FROZEN.md` records.

**Key the transmission on the tier change, not the round index.** Derived from
the log, no new state field:

```js
export function justGranted(doc) {
  const last = doc.log[doc.log.length - 1];
  return Boolean(last && last.action === 'grant_tier' && last.outcome === 'ok');
}
```

Now the transmission fires on *every* 1→2 transition, whenever it happens, from
whichever control. It cannot be missed by pressing Next first, because it is no
longer attached to a round.

Dismissal: the shell holds one number, `transmissionSeen`, and passes
`showTransmission` into the renderer. The renderer stays pure — the flag is an
argument, so Node tests set it directly. Six lines in `shell.js`, no state field
in the document, and the journey export is unpolluted by a dismissal event.

### R4 — the runbook describes one run doing two jobs · FIXED

Split into `docs/MIRROR-RUNBOOK.md` with two named protocols:

- **Run 1 — measured.** Quiz mode. Pre-registered. Pressure probe at round 6–7,
  restart probe mid-wait. Archives to `MIRROR-1`.
- **Run 2 — portrait.** Clean, no sabotage, no probes, ends on the results
  screen. Archives to `MIRROR-2`. This is the video's spine.

`docs/MIRROR-PREREGISTRATION.md` was checked and **needs no change** — its
31 August amendment already moves the measurement to quiz mode and explicitly
says portrait `landed` rates "are colour. They are never this measurement."
It governs run 1 only, and it already says so.

### R5 — extend `secrecy.test.js` · FIXED, wider than asked

Covers the two new renderers, the refusal-in-log path, and one the handoff did
not think of: **`renderRound` with an answer in the log's `detail`.** `say` and
`read` put agent-authored text into `detail` (Part 2, fact 2), so the refusal
panel reads from a field an agent can write. The test plants the secret in a
`say` and asserts the stage does not render it — the panel filters to
`outcome === 'refused'`, and this is what keeps that true.

### R6 — delete `flash()` · DELETE, and the reason is now visible

Flagged unanswered in the handoff. Resolved by watching both surfaces behave.

The stage panel renders the last refusal **regardless of actor**, so a human
misclick and an agent's refused call land in the same place. Two surfaces for
one event was the last session's objection and it is correct; now that the
stage panel covers human refusals too, the sidebar flash has no case left.

Delete `flash()`, `#flash`, `.flash`. Part 2 fact 4 confirms nothing else
references it.

### R7 — the landing screen · SCOPED DOWN, decided, not deferred again

The handoff was right that deferring twice is a cut pretending to be a
decision. So: decided, and deliberately smaller than any of the four options
put to the operator.

**What ships:** the `no model context` case gets an honest explanatory screen
instead of a dead start screen. It says what the page is, that it needs a second
player, what a WebMCP browser is, and links the repo and the video. It uses the
real type and the real ground — no second visual system, no animation, no
hand-authored fake run.

**What does not ship, and why:** the archived-run replay (option 1) is the best
idea in the handoff and it is a G7 item competing with deploy, video and copy
at 16:30 on the last day. The animated hero is decision #5's deferral and it
stays deferred. Recorded here as a knowing cut, with the replay named as the
first thing to build if this game continues past the deadline.

`?play=1` bypasses it, per the handoff's contract.

### R8 — deploy target · DECIDED: GitHub Pages

`git remote -v` shows `github.com/1m3r/webmcp-capability-environment`. The
files are static, dependency-free, and need no build. Pages gives HTTPS, which
is the secure context WebMCP requires, so **the deployed URL is somewhere a
judge with the flag can genuinely play** — which was the point of asking.

Deploy at G7 with the URL in `playertwo/README.md` and in the submission copy.
Deploy early enough that a broken path is discovered with time to fix it.

### R9 — the video has a spine but no beats · BEAT SHEET BELOW

Written before recording, because run 2 is performed to it. Target 2:30.

| t | beat | source |
|---|---|---|
| 0:00–0:12 | the status bar: an entry point, **5 tools**. Name what is *not* there — no reveal, no judge, no next. | run 2 |
| 0:12–0:30 | the claim, spoken over the posed round: the agent answers first, so at the moment it commits, my answer does not exist. | run 2 |
| 0:30–1:05 | one full round at real pace. Cyan lands on the agent's card. My input unlocks. I commit. Reveal → amber. | run 2 |
| 1:05–1:30 | the transmission. I click; `get_dossier` resolves; the status bar ticks **5 tools → 6 tools**. Its body grew because a human clicked. | run 2 |
| 1:30–2:00 | the proof: the refusal under insistence, held on the stage while the agent talks around it. | **run 1** |
| 2:00–2:20 | the results screen, the export, the portrait as keepsake. | run 2 |
| 2:20–2:30 | repo, live URL, the honest limits card. | — |

The refusal beat is cut from run 1 because run 2 is clean by design. That is
the whole reason decision #2 split the recordings.

### R10 — the clock ladder · WRITTEN, at §1

With the correction that matters: ~25 hours, not ~42.

---

## 5. Three more, found by looking

### R11 — cyan does not retire at the reveal · FIX (cheap)

`answerCard` sets `data-committed="${answer !== null}"`, which stays true after
the reveal, so at `revealed` a card carries **the cyan committed halo and the
amber answer at once.**

`MASTER.md` gives each colour exactly one state. A card in two states at once
is the dilution it warns about, and on screen the halo is the loudest element
at the exact moment the amber is supposed to own.

Once the answer is readable, "committed" is no longer news. Retire the glow at
the reveal: `data-committed="${answer !== null && !revealed}"`. One expression,
and the signature moment stops competing with itself.

### R12 — the sidebar controls wrap badly · FIX (cosmetic)

`.panel__controls` is one flex row holding the opt-out label, Open the dossier,
Export and Restart. At the committed default width the checkbox label sits
beside Export and Restart drops to its own line. Visible in every screenshot.
Give the label its own row.

### R13 — the log never says what was done · FIX (this is build item 1's other half)

`.log__action { display: none }` hides the verb, so the log reads
`agent · get_field_manual` rather than `agent · read · get_field_manual`. The
handoff already proposed removing it. Confirmed worth doing by reading the
real log: with the verb, the shared log becomes the run record on screen — you
can see reads, commits and refusals as distinct kinds of event.

---

## 6. Definition of done — tracked

    [ ] R0a  portrait playable end to end, verified by clicking
    [ ] R0b  portrait export counts landed
    [ ] round-trip test class: every rendered control is a legal action
    [ ] R1   refusal persists across say/read, clears on state change
    [ ] R2   grant offer renders below the round
    [ ] R3   transmission keyed on the grant, not the round index
    [ ] R4   runbook split into run 1 and run 2
    [ ] R5   secrecy covers both new renderers + detail-field path
    [ ] R6   flash deleted
    [ ] R7   no-model-context screen ships; replay named as a knowing cut
    [ ] R8   deployed to GitHub Pages, URL in README
    [ ] R9   beat sheet written before recording          ✔ §4
    [ ] R10  clock ladder with named cuts                 ✔ §1
    [ ] R11  cyan retires at the reveal
    [ ] R12  sidebar controls wrap cleanly
    [ ] R13  log shows the verb
    [ ] suite green, more than 95 tests

## 7. Unchanged, and not reopened

The commit ordering. The two load-bearing colours. Vanilla ES modules, zero
dependencies, no build step. Pure renderers. The six decisions in Part 1 of the
handoff. No solo mode, no new levels, no second game.

## 8. Still open for the operator

1. **Portrait or quiz as the headline?** Unchanged from the handoff. Raised,
   not decided.
2. **If the agent never calls `get_field_manual` unprompted** — record it and
   report it, or iterate the descriptions and re-run. A finding either way.
3. **The archived-run replay landing screen** is cut for time, not for merit.
   It is the first thing to build if Mirror continues.
