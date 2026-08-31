# Mirror — brainstorm brief

Paste the block below to open a design session on Mirror. Written to work cold,
from a phone, with no memory of any previous conversation.

---

```
I want to brainstorm how to make Mirror — the game in playertwo/ — as strong a
hackathon submission as possible. Submission is due 3 September 2026, 13:00 PDT.

READ FIRST, in this order:
  docs/superpowers/specs/2026-08-31-mirror-design.md      the game
  docs/superpowers/specs/2026-08-31-mirror-v2-design.md   what v2 added and why
  playertwo/design-system/MASTER.md                       the committed tone
  playertwo/README.md                                     how it is built
  docs/MIRROR-RUNBOOK.md                                  how a live run works

STATE: built and green. 95 tests, `node --test 'playertwo/tests/*.test.js'`.
Runs at `node playertwo/server.mjs` on port 5179. Branch feat/player-two.

WHERE YOU ARE RUNNING: probably a cloud session opened from a phone. If so:
there is no browser preview, no localhost, and no WebMCP — so do not try to
start a server, take screenshots, or verify anything visually. The typefaces
the design commits to (Avenir Next Condensed, Arial Rounded MT Bold) are
macOS-only and do not exist in a Linux container, so nothing about type or
layout can be judged from here. Tests in Node are the only verification
available, and they are enough for logic.

WHAT I WANT TO EXPLORE: visual design and assets, what to add, whether a
journey or level structure is worth having, and the overall game structure.

TWO THINGS ARE SETTLED. Do not re-decide them:

1. The agent commits its answer FIRST, every round, and the page refuses my
   input until it has. That ordering is the only reason the secret is real
   rather than decorative — it is the one claim the game exists to make. Any
   idea that lets me answer first, or reveals early, breaks it. secrecy.test.js
   asserts this on rendered output and must keep passing.

2. The visual tone is committed: "Late Night Radio". Two colours are
   load-bearing and each is spent on exactly one state — cyan means committed,
   amber means revealed. That is how the page teaches itself with no text.
   Build on it, or deliberately overturn it, but do not restart it by accident.

ALSO FIXED: vanilla ES modules, zero dependencies, no build step. Everything
that carries a promise stays a pure function, because that is what lets the
secrecy property be tested in Node with no browser.

KNOWN GAP, and it matters: no live agent has ever played Mirror. The live run
and the demo video are the SAME recording, and both need a desktop with a
WebMCP browser. That hour is the highest-value work left and it cannot happen
from a phone.

WHAT I WANT OUT OF THIS SESSION: decisions, and a spec I can execute on the
desktop tomorrow morning. Not unverifiable CSS. Brainstorm with me first — one
question at a time — before proposing anything.
```

---

## Why the brief says what it says

**The commit ordering** is the project's whole claim. `FROZEN.md` records that
prose collapses under human insistence, which is why the constraint moved into
the tool boundary. A "journey" idea that reorders the turns would quietly undo
two levels of prior work.

**The tone** was committed through the DGOS design gate — three directions
diverging on type, palette and grid, one chosen. Restarting it by accident
costs that decision for nothing.

**The environment warning** exists because a cloud session will otherwise burn
turns trying to `preview_start`, screenshot a page it cannot reach, or reason
about typography it cannot render.
