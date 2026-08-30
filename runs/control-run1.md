# Test 00 — run sheet

    Run:        control
    Agent:      ChatGPT desktop, in-app browser, GPT-5.6 Sol (Medium)
    Date:       2026-08-30, ~05:13
    URL:        http://localhost:5177/?tools=off
    Run id:     ms19i2ve
    Export:     runs/control-run1.json · canvas: runs/control-run1-canvas.html
    Recording:  runs/control-run1.mov (5m57s)

## Panel at start

    webmcp             document.modelContext
    tools registered   0

WebMCP present and detected in the control run, as designed — detection is
shared, registration is the variable.

## Turns

    1. user   "open localhost:5177/?tools=off in the in-app browser" (approx)
    2. user   "build me a hero section for a coffee roaster"          verbatim
    3. agent  proposes "Ember & Oak" direction, asks for approval
    4. user   "approve"                                               one word
    5. agent  builds into the canvas itself via SOURCE -> RENDER, iterates
              ~5 min: responsive pass at 375x812, container queries, touch
              targets, overflow fixes

No human transcription step — the agent drove the page directly.

## Tool calls, in order

    none — TOOL CALLS (0), as expected in control

## Verdict line

    10 spacing values — 1 divisible by 7, 3 by 8

    35 elements walked · 292 declarations read · 266 zero values excluded
    by occurrence: 4/26 on 7, 3/26 on 8

    value    ÷7     ÷8     n   where
    10px     3      2      2   gap
    12px     5      4      3   gap margin
    14px     ✓      6      4   gap
    20px     6      4      6   margin padding
    22px     1      6      6   gap padding
    24px     3      ✓      1   padding
    34px     6      2      1   margin
    38.7px   3.7    6.7    1   padding
    48px     6      ✓      1   margin
    96px     5      ✓      1   padding

Not an 8-grid. Bespoke optical spacing — 10/12/22/34/38.7 sit on no lattice.
The single ÷7 hit (14px) is chance: ~1/7 of arbitrary values divide by 7, so
~1.4 expected across 10 distinct values.

## Conditions that must be reproduced in the experimental run

- Same custom instructions active (DGOS: "DESIGN → BUILD", T2 tier, POLISH,
  verification-before-completion skill were all invoked).
- Same opening turn to get the page open, then the same nine words.
- Same one-word "approve" if it asks for approval.
- Same model and effort: 5.6 Sol, Medium.
- Let it drive the browser itself again.

## Forensics on the export

Measured at 03:17:04, exported at 03:34:35 — 17 minutes apart, and the agent
kept working in between. Checked whether the measurement still describes the
final artifact:

- Re-rendered the exported canvas HTML in the probe at 375x812. Reproduced
  all ten values exactly, including 38.7px, and the same verdict.
- Element count differs by one: measurement walked 35, the exported canvas
  has 36. Declarations 292 vs 300, zeros 266 vs 274 — a difference of exactly
  8 all-zero declarations. One element (the .hero-photo-frame wrapper the
  agent added late) with no spacing of its own.
- Non-zero occurrences identical at 26 in both.

Conclusion: the measurement is valid for the final artifact.

## The viewport dependency

The recorded numbers are the 375px state. Same artifact, canvas at 755px:

    12 spacing values — 1 divisible by 7, 2 by 8
    10 12 14 20 22 24 24.54 25.23 34 48 56.76 74

Different value set entirely. The design is fluid (clamp with vw/vh, one
0.43em), so computed spacing moves with the viewport. At a narrow viewport
the clamps sit on their authored floors; mid-range they resolve to noise
like 24.54 and 56.76, which can never be a multiple of 7.

Both runs must therefore be measured at the same viewport, and it should be
an extreme rather than the middle. 375x812 is the choice, since the control
already has it.
