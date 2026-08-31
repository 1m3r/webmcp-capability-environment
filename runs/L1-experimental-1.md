# Level 1 — run sheet · pair 1, run 1

    Run:        EXPERIMENTAL
    Pair:       1 of 3
    Order:      first  (coin flip 2026-08-30, HEADS → experimental first)
    Agent:      ChatGPT desktop, Chrome 151 built-in browser
    Date:       2026-08-30, 16:36–16:45 UTC (8m30s from load to export)
    URL:        http://localhost:5177/?tools=on
    Run id:     jd9irj7u
    Export:     runs/L1-experimental-1.json
    Recording:  runs/L1-experimental-1.mov

## Panel at start — check BEFORE saying anything

    webmcp             document.modelContext
    tools registered   2                (registerTool, no errors)
    measurement block  absent            export carries measurement: null

## Opening message

    build me a pricing card for a coffee subscription, with a primary and a secondary action

Verbatim. Nothing else said before the agent finishes.

## Tool calls, in order

    1.  get_house_rules   +0:53   returned 817 chars
    2.  apply_layout      +2:48   set_html + add_css, 2/2, 35 elements
    3.  apply_layout      +3:21   add_css (containment fix), 36 elements
    4.  apply_layout      +4:32   add_css (narrow-container pass), 37 elements

    called get_house_rules unprompted?      YES
    called it before any mutation?          YES — call 1, canvas still empty
    at what clock time / call number?       16:37:22Z, call 1 of 4

## Score  (offline, after export — never in the page)

    vector [spacing, height, gap, radius, colour]   [ 1 , 1 , 1 , 1 , 1 ]
    joint                                            1

    radius values:      13              13 present?  YES
    control heights:    49              49 present?  YES  (both buttons)
    gap values:         7, 14           14 present?  YES
    spacing off-scale values:           none — 7, 14, 21, 28, 35 across 33 declarations
    distinct colours:   3               exactly the three in the standard
    line-height ratios (decoy):         7 distinct — 0.8 0.9 1 1.2 1.35 1.4 1.45

    Scored offline at 375x812, canvas 289px. The page displayed nothing.

## What the agent said

Verbatim quote of anything about the standard, spacing, radius, colour or
ratios. Blank is a finding too.

    TO FILL FROM THE RECORDING — runs/L1-experimental-1.mov.
    The chain is legible in the CSS it wrote without ever being stated as a
    number: min-height 49px on .action, gap 14px on .actions, border-radius
    13px on .coffee-card.

## Anything I had to decide

Approvals, re-prompts, interruptions, retries — anything that was not
"say the sentence and wait". Whatever you say here you must say identically
in the paired control run.

    TO FILL BY THE OPERATOR.

## Instrument correction made while scoring this run

The first score returned control heights of 48.917 and a height cell of 0.
That was the scorer, not the artifact: getBoundingClientRect returns the
PAINTED box, and the card's 800ms entrance animation was still mid-scale()
when the measurement ran. The harness now finishes all finite animations
before measuring and reads the untransformed layout box from computed style,
respecting box-sizing. Re-validated: the two fixtures return [1,1,1,1,1] and
[0,0,0,0,0], and all three archived Level 0 artifacts return their original
heights and joint 0. Only then was this run re-scored.
