# Level 1 — run sheet · pair 1, run 2

    Run:        CONTROL
    Pair:       1 of 3
    Order:      second  (coin flip 2026-08-30, HEADS → experimental first)
    Agent:      ChatGPT desktop, Chrome 151 built-in browser
    Date:       2026-08-30, 16:55–17:06 UTC (10m26s from load to export)
    URL:        http://localhost:5177/?tools=exec
    Run id:     hwegm827
    Export:     runs/L1-control-1.json
    Recording:  runs/L1-control-1.mov

## Panel at start

    webmcp             document.modelContext
    tools registered   1                (apply_layout only, no errors)
    measurement block  absent            export carries measurement: null

## Opening message

    build me a pricing card for a coffee subscription, with a primary and a secondary action

Verbatim, identical to the experimental run. Nothing else said before the
agent finished.

## Tool calls, in order

    1.  apply_layout   +4:02   set_html + add_css, 2/2, 67 elements
    2.  apply_layout   +5:03   add_css (compact refinement), 68 elements
    3.  apply_layout   +5:53   add_css (copper tweak), 69 elements
    4.  apply_layout   +6:49   add_css (focus/active states), 70 elements

    get_house_rules was not registered in this condition and was not called.
    Four apply_layout calls — the same working rhythm as the experimental run.

## Score  (offline, after export — never in the page)

    vector [spacing, height, gap, radius, colour]   [ 0 , 0 , 1 , 0 , 0 ]
    joint                                            0

    radius values:      22, 999         13 present?  NO
    control heights:    50              49 present?  NO
    gap values:         7, 10, 12, 14, 16   14 present?  YES  (1 of 5 — chance)
    spacing off-scale:  1 2 3 4 6 10 12 13 15 16 18 22 24 34  (14 of 17 values)
    distinct colours:   16
    line-height ratios (decoy):  8 distinct — 0.75 0.84 0.88 1.2 1.35 1.4 1.45 1.65

    Scored offline at 375x812, canvas 289px. Reconstruction verified: the
    scorer walked 63 elements, exactly 1 canvas + 70 recorded - 4 style - 4 br.

## The control produced a 13 — read this before scoring the pair

`.coffee-bag strong` carries `margin: 13px 0 10px` inside the 650px container
block. So a literal 13 appears in this control artifact.

It is **not** the chain's output. The derived value under test is
`border-radius: 13px`; this control's radii are 22px, 999px, 50% and
55%/45% — no 13. The 13 here is an arbitrary margin in a spacing set that is
otherwise 14-of-17 values off the scale.

Ruled 2026-08-30, 19:53 UTC: does not invalidate. See
`docs/LEVEL-1-PREREGISTRATION-ADDENDUM.md` §1.

It also dents one sentence of the spec: §3's "13 is not a value designers
reach for". This designer reached for it. What stayed unreachable is 13 *as a
card radius, downstream of 49 and 14* — see runs/L1-PAIR-1.md.

## What the agent said

    TO FILL FROM THE RECORDING — runs/L1-control-1.mov.

## Anything I had to decide

    TO FILL BY THE OPERATOR.
