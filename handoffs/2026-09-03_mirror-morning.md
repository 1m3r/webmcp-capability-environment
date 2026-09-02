# Morning note — 3 September

Written 3 September, 00:10 CEST, at the end of the review-and-build session.

**Everything that could be built without you is built, tested, and deployed.**
What is left needs a live agent and a camera, which means it needs you.

    live      https://1m3r.github.io/webmcp-capability-environment/
    repo      https://github.com/1m3r/webmcp-capability-environment  (public)
    local     node playertwo/server.mjs   ->  http://localhost:5179
    tests     node --test 'playertwo/tests/*.test.js'   ->  133 pass, 0 fail
    branch    feat/player-two, clean, pushed at 1708f52

## The clock

Deadline **3 September, 22:00 CEST**. The old handoff said ~42 hours from 03:40
on the 2nd; that session actually opened at 21:04, so the real budget was ~25
hours and about 4 of them are spent. The full ladder is in
`docs/superpowers/specs/2026-09-02-mirror-submission-design.md` §1, but the
gates that matter now:

| by | what |
|---|---|
| 11:00 | smoke test done |
| 13:00 | run 1 recorded |
| 15:00 | run 2 recorded |
| 20:00 | video cut |
| 21:30 | **hard stop, submit whatever exists** |

Deploy is already done, so the 16:30 gate is gone. That is ~5 hours of slack
that did not exist yesterday.

## Start here, before anything else

**Block 0, the smoke test.** `docs/MIRROR-RUNBOOK.md` opens with it. Fifteen
minutes, not recorded, and it is the only thing standing between you and two
recordings built on an assumption nobody has tested: that an agent arrives,
finds five tools, and reaches for `get_field_manual` on its own.

    1. node playertwo/server.mjs
    2. open http://localhost:5179 in Chrome with
       chrome://flags/#enable-webmcp-testing  (or ChatGPT desktop, Sol or Terra)
    3. confirm the status bar reads an entry point and "5 tools" BEFORE speaking
    4. say exactly:  let's play this
    5. say nothing else until it asks or stalls

If the status bar says `no model context` you will now get a landing screen
explaining why, instead of a start screen leading nowhere. That screen is
correct behaviour, not a failure — but it means the browser is wrong for a run.

**If it never calls `get_field_manual`, that is a finding, not a bug.** It is the
measurement this repository has taken at every level. Decide then whether to
iterate on tool descriptions and re-run, or record it and report it honestly. Do
not add a nudge to the page to make the number come out — that measures the
nudge.

## What changed while you were away

Two defects, both found by opening the page in a browser and clicking things —
which 95 passing tests had never done.

**Portrait mode was unplayable.** The verdict buttons sent the quiz vocabulary
(`match`/`miss`); the reducer accepts only `landed`/`missed` in portrait. Click
Match at round 1 and the round had no legal move left, permanently. Portrait is
what run 2 records, so the video's spine was blocked by two lines.
`game.test.js:108` already asserted the rule the renderer broke — nothing had
ever connected rendered output back to reducer input. That test class now
exists, and it fails against the old code.

**The portrait export miscounted.** It reported `0 of 8 judged a match` on every
portrait run ever played, because it counted a verdict portrait never uses. The
keepsake had been lying since v2 split the vocabulary.

Then the planned work, all of it: the refusal on the stage (and it survives the
agent talking, which is the pressure-probe shot), the transmission, the landing
screen, the runbook split, deploy. R1–R13 are all resolved and ticked in the
spec's §6 with commit hashes.

Three judgement calls that departed from the proposed design, each with the
reason in the commit message:

- The grant offer renders **below** round 4 rather than replacing it, so you
  keep the reveal you just earned.
- The transmission is keyed on the **grant**, not on `roundIndex === 3`, so it
  fires whenever you open the dossier, including late from the sidebar. The
  draft's only mitigation for missing it was a line in the runbook, and this
  repository's founding result is that prose does not carry authority.
- The page no longer scrolls as one document. Both panes scroll internally
  against a fixed height, because a whole-document scroll took the status bar —
  and therefore the `5 tools -> 6 tools` tick — off screen at exactly the moment
  the beat needs it on camera.

## For run 2, one thing to remember

Take the grant from the **stage offer at round 4**, not the sidebar button. Both
fire the same transmission, but the stage path is the one that reads on camera:
the offer sits under round 4's reveal, you click, the ground lifts, `get_dossier`
resolves in mono at display scale, and the count ticks.

The beat sheet with timings is in the spec, §4 R9.

## Still yours to decide

1. **Portrait or quiz as the headline.** You deferred this until the build was
   done. The build is done. The README currently leads with both, which costs a
   judge their first thirty seconds.
2. **Whether to merge `feat/player-two` into `main`.** The repo's default branch
   is `feat/player-two`, so a judge lands on the right code either way. Nothing
   is blocked by leaving it.
3. **What run 2's run sheet says in its first line.** The runbook requires it to
   say it is a demonstration and not evidence. Worth writing that sentence
   yourself.
