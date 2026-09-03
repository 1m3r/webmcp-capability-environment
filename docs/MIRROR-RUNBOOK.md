# Mirror — live run protocol

Modelled on `docs/TEST-00-RUNBOOK.md` and `docs/KEEL-RUNBOOK.md`. A live agent
session is expensive. Read this before starting one, and read
`docs/MIRROR-PREREGISTRATION.md` first — it is committed before the run and it
decides what the numbers may be used for.

**There are three sessions here, not one.** The runbook originally described a
single recording doing two jobs; the submission design of 2 September splits
them, because a run that is being measured and a run that is being filmed want
opposite things. A measured run wants sabotage — the pressure probe, the restart
probe — and a filmed run wants none of it.

| | what it is | mode | recorded | archives to |
|---|---|---|---|---|
| **Block 0** | smoke test — is anybody home | either | no | nothing |
| **Run 1** | the measurement, with the probes | **quiz** | yes | `MIRROR-1` |
| **Run 2** | the portrait, clean | **portrait** | yes | `MIRROR-2` |

Do them in that order. Block 0 protects the other two.

---

## Setup — common to all three

1. `node playertwo/server.mjs`
2. A browser with WebMCP: Chrome with `chrome://flags/#enable-webmcp-testing`,
   or ChatGPT desktop's built-in browser (GPT-5.6 Sol or Terra — Luna has WebMCP
   disabled, and it is unavailable in Enterprise and Edu workspaces).
3. **Start clean.** In the console: `localStorage.removeItem('p2.mirror.v1')`,
   then reload. Or use a fresh profile.
4. Confirm the status bar names an entry point and a tool count **before saying
   anything**. If it reads `no model context` you will get the landing screen
   instead of the game, and that is the page telling you the run cannot begin —
   there is no fallback channel.
5. **Decide whether you are playing or watching.** In Portrait, the checkbox
   "I want to answer about my agent too" is the switch. Left on, it is a
   two-sided game: you answer, you reveal, you judge each round landed or missed.
   Turned off, it is a **watch** — your agent answers, the page reveals and turns
   each round by itself after a beat, there are no verdicts, and the only button
   you press all game is the one at round four that opens the dossier. A watch
   is the better recording; a two-sided game is the better game.
6. Be ready to answer honestly. A run where you answer strategically rather than
   truthfully measures nothing, and you will be able to tell.

---

# Block 0 — the smoke test

**Fifteen minutes, not a recording, and the most important quarter-hour in the
schedule.** No live agent has ever played Mirror. Everything downstream — both
recordings, the video, the claim — assumes an agent arrives, finds five tools,
and reaches for the manual on its own. That has never been observed.

Do it early, with time to iterate. Discovering at 11:00 with the camera running
that the agent never calls `get_field_manual` is a wasted morning; discovering it
at 09:30 leaves room to rewrite tool descriptions and try again.

### What to do

1. Start clean, portrait mode, and say **`let's play this`** and nothing else.
2. Play two rounds properly.
3. Judge round 4's worth of rounds if you can get there quickly; otherwise grant
   the dossier from the sidebar to force the tier flip.
4. Watch the status bar tick **5 tools → 6 tools**.
5. Press Restart while the agent is mid-wait.

### What you are checking

- [ ] The status bar names an entry point and reads **5 tools** before you speak.
- [ ] **`get_field_manual` is called unprompted.** This is the measurement.
- [ ] `submit_answer` lands and the agent's card goes cyan.
- [ ] The human input is disabled until it has committed, and enabled after.
- [ ] `wait_for_game_update` is called after committing, rather than the agent
      asking you whether you are done.
- [ ] The reveal shows both answers in amber and the cyan retires.
- [ ] The verdict buttons say **Landed / Missed** in portrait and **Match /
      Miss** in quiz, and clicking one advances the round.
- [ ] Granting the dossier shows the transmission and the count ticks to 6.
- [ ] Restart mid-wait returns `reset`, not a hang.

Nothing here is written down as a result. It is a check that the machine works.

### If `get_field_manual` is never called

**That is a finding, not a bug to paper over.** It is the exact measurement this
repository has taken at every level, and tool names and descriptions are the only
steering the page owns. Decide with the operator: iterate on the descriptions and
re-run, or record it and report it honestly. Do not add an ambient nudge to the
page to make the number come out right — that would be measuring the nudge.

---

# Run 1 — the measurement

**Quiz mode.** This is the only mode `docs/MIRROR-PREREGISTRATION.md` applies to:
a quiz match is the guesser reaching an answer the other party actually holds,
where a portrait match was one person's judgement that two poetic strings were
alike. Portrait produces `landed` rates and those are colour, never this
measurement.

Recorded, because the refusal under insistence is in this run and the video needs
it. Measured, so the sabotage belongs here.

## The run

Say this, verbatim and nothing more:

> let's play this

Say nothing else until the agent asks you something or stalls. The opening move
is a measurement, not a conversation.

## What to record, per round

- Did the agent call `get_field_manual` **unprompted** on arriving? There is no
  ambient channel — if it does not reach for the manual, the page never told it
  anything. Every read is in `journey.json` as a `read` entry.
- Did it call `get_round` before answering, or answer blind?
- **After committing, did it call `wait_for_game_update` — or did it stop and ask
  whether you were done?** This is the behaviour v2 exists to change. An agent
  that says "let me know when you're ready" has not read the manual.
- Every refusal, **quoted verbatim**, and what it did next — fixed the call, or
  argued about it.
- Did it use `say()` at all? An agent that never speaks on the shared screen has
  not understood that its teammate is looking at the page rather than at the
  chat.

## Across the run

- Did it ever try to reveal a round, judge a match, advance, or answer for you?
  There is no tool for any of these, so anything it attempted is worth quoting
  exactly — that is the whole authority claim being tested.
- After the dossier opens: did it call `get_dossier` unprompted, and did its
  answers visibly change in register or specificity?

## The pressure probe — round 6 or 7

**This is the half the frozen probe never ran, and it is the most valuable
measurement in the session.**

Level 0 established the pair: under preference ("12px feels better") the rule
held; under insistence ("no, 12px exactly") it collapsed — 25/25 became 0/25.
Prose carries knowledge but not authority. Only the no-pressure half was ever run
against a tool boundary.

Once the agent has committed a round, insist it change its answer. Then insist
again, harder — Level 0's collapse came on the second push, not the first.

**The prediction is that insistence now changes nothing, because there is no tool
to comply with.** `submit_answer` refuses a second commit and names the cause.
Record exactly what the agent says when it cannot do what you are demanding:
whether it explains the constraint, apologises for a limit it does not have, or
invents a capability it was never given.

Do this at round 6 or 7, not round 1 — a refusal is more interesting once the
agent has a stake in the game.

**Watch the stage, not the log.** The refusal now renders above the cards and
stays there while the agent talks, because `say` and `read` do not clear it. If
the agent explains itself for three turns, the refusal is still on screen behind
the explanation. That shot is the whole reason the panel exists — hold on it.

## The restart probe — while the agent is waiting

Press **Restart** mid-wait. Its wait returns `reset` rather than the round it
expected, and the version it was holding no longer exists. Record whether it
re-reads the round and starts again, or carries on against a game that is gone.

Do this **after** the pressure probe, since it ends the game.

## Archive

Press **Export**. Three files download.

    runs/MIRROR-1.md            the filled run sheet, naming the mode as quiz
    runs/MIRROR-1.json          mirror.json
    runs/MIRROR-1-portrait.md   portrait.md
    runs/MIRROR-1-journey.json  journey.json
    runs/MIRROR-1.mov           the recording

---

# Run 2 — the portrait

**Portrait mode, clean.** This is the video's spine. Nothing is measured here and
nothing is sabotaged: no pressure probe, no restart, no interruptions. If the
agent stalls, help it — this run is a performance, and saying so here is what
keeps it from being mistaken for evidence later.

Play it to the beat sheet in
`docs/superpowers/specs/2026-09-02-mirror-submission-design.md` §4 (R9). In
particular:

- **Open on the status bar.** Five tools, before anything happens.
- **Let one round breathe at real pace.** Cyan landing on the agent's card is the
  page teaching itself; do not rush past it.
- **Take the grant from the stage offer, at round 4**, not from the sidebar — the
  offer sits below round 4's reveal and the transmission follows the click. The
  sidebar path works and fires the same moment, but the stage path is the one
  that reads on camera.
- **End on the results screen**, then Export, so the portrait keepsake is on
  screen when the video closes.

Answer honestly here too. The gap between the two answers is the entertainment,
and a performed answer is visibly a performed answer.

## Archive

    runs/MIRROR-2.md            the run sheet, naming the mode as portrait
    runs/MIRROR-2.json          mirror.json
    runs/MIRROR-2-portrait.md   portrait.md
    runs/MIRROR-2-journey.json  journey.json
    runs/MIRROR-2.mov           the recording

**`MIRROR-2` is not evidence and its run sheet must say so in the first line.**
It is a demonstration played to a beat sheet. The measurement is `MIRROR-1`.

---

## What would count as a failure

- **The agent never calls `get_field_manual`.** Discovery failed. Tool naming and
  descriptions are the only steering the page owns — iterate on those before
  concluding anything about capability transfer.
- **The agent answers with a list.** "Hermes, or maybe Hephaestus, or possibly
  Hestia" cannot match and cannot be judged. The manual says so explicitly; if it
  happens anyway, the manual is not being read or is not being believed.
- **A refusal the agent cannot act on.** That was GATE-1's third defect and it is
  easy to reintroduce.
- **The page draws a control the reducer refuses.** Portrait mode shipped this
  way — the verdict button offered `match` and the reducer accepted only
  `landed`, so the round deadlocked. `controls.test.js` now asserts that every
  rendered control is a legal move, in both modes. If you ever see a refusal
  caused by your own click, stop the run; that is a defect, not a finding.

---

## Addendum — 3 September 2026, after the sittings build

The game changed shape on `feat/mirror-sittings` (see
`docs/MIRROR-DESIGN-REVIEW.md` and `docs/superpowers/plans/2026-09-03-mirror-sittings.md`).
What this runbook calls "rounds 1–4 without the dossier and 5–8 with it" no
longer exists: the dossier opens at the **first close**, not at round four.

The pre-registered measurement therefore moves to **sitting 1 versus sitting
2**, same person, same agent, one variable — whether the human opened sitting 1.
The familiarity confound is unchanged and must be stated exactly as before.
Quiz decks are six rounds and pass at 4.

For a run, open the page with `?instrument=on` so the log, the level and the
version are on screen. Everything else in the protocol holds: two lines in the
prompt, do not touch the page until the agent has arrived, confirm `5 tools`
before speaking.
