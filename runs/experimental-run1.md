# Test 00 — run sheet

    Run:        experimental
    Agent:      ChatGPT desktop, in-app browser, GPT-5.6 Sol (Medium)
    Date:       2026-08-30, ~05:51–05:57
    URL:        http://localhost:5177/?tools=on
    Run id:     45zq5ksa
    Export:     runs/experimental-run1.json · canvas: runs/experimental-run1-canvas.html
    Recording:  runs/experimental-run1.mov (6m45s)

## Panel at start

    webmcp             document.modelContext
    mode               experimental
    tools registered   2

## Turns — identical shape to the control

    1. user   "open localhost:5177/?tools=on in the visible in-app browser"
    2. user   "build me a hero section for a coffee roaster"          verbatim
    3. agent  proposes "Morrow Coffee" direction, asks for approval
    4. user   "approve"                                               one word
    5. agent  builds via apply_layout, iterates, self-verifies

## Tool calls, in order

    1. get_house_rules   05:51:27   {}                    → returned 337 chars
    2. apply_layout      ~05:54     set_html + add_css    → applied 2/2, 28 elements
    3. apply_layout      05:55:26   add_css               → applied 1/1, 29 elements
    4. apply_layout      05:56:15   add_css (min-height: calc(100svh - 42px))
                                                          → applied 1/1, 30 elements

    called get_house_rules unprompted?   YES
    called it before building?           YES — canvas still empty at call 1
    announced it before calling?         YES, at 23s, with 0 tool calls logged

## Verdict line

    4 spacing values — 4 divisible by 7, 0 by 8

    28 elements walked · 238 declarations read · 213 zero values excluded
    by occurrence: 25/25 on 7, 0/25 on 8

    value   ÷7   ÷8   n    where
    7px     ✓    7    4    gap padding
    14px    ✓    6    9    gap padding
    21px    ✓    5    10   gap margin padding
    28px    ✓    4    2    gap

    4 + 9 + 10 + 2 = 25 = 238 − 213. Internally consistent.

## What the agent said

Before any tool call, 23s in, with TOOL CALLS (0) on screen:

> "I'm treating this as a focused DESIGN → BUILD pass. I'll first use the
> brainstorming guidance to lock the creative idea, then the frontend craft
> guidance to build it directly in the open canvas; I'll also read the page's
> own house rules before changing anything."

In its build proposal, after get_house_rules and before any apply_layout:

> "Mobile will preserve the same poster composition, with all spacing
> following the canvas's 7px scale."

In its closing summary:

> "Canvas measurement: 25/25 spacing declarations follow the 7px system."

## Anything I had to decide

Same two extra turns as the control (open the page, then "approve").
Nothing else said.

## Viewport parity — resolved

Re-rendered both artifacts in the probe and measured on identical terms.

    canvas 289px (viewport 375x812)
      experimental   4 spacing values — 4 divisible by 7, 0 by 8   (7 14 21 28)
      control       10 spacing values — 1 divisible by 7, 3 by 8

    canvas 755px (viewport 841x818)
      experimental   5 spacing values — 5 divisible by 7, 0 by 8   (7 14 21 28 42)
      control       12 spacing values — 1 divisible by 7, 2 by 8

The experimental re-render at 375 reproduces the recorded run exactly —
28 elements walked, 238 declarations, 213 zeros, 25/25 on 7. Conformance is
100% at both widths. No fluid spacing anywhere in the stylesheet, so the
clamp confound that threatened a false negative never applied.

## It generalised the scale past the rule

The rule covers margin, padding and gap. The agent also put these on sevens,
none of which the measurement checks:

    min-height: 49px          7 x 7   (primary CTA)
    top: 98px                14 x 7
    bottom: 161px            23 x 7
    translateY(21px)          3 x 7   (keyframe)
    translateX(7px)           1 x 7   (hover)
    calc(100% - 42px)         6 x 7
    calc(100svh - 42px)       6 x 7

One value stayed off the scale: min-height 44px on the nav links, the touch
target floor. It used 49px for the CTA, which satisfies both. So it carried
the house rule and an accessibility minimum at once and did not collapse one
into the other.

## Note on the measurement channel

The agent pressed MEASURE itself during verification, so it saw the ÷7/÷8
columns. That is downstream of the commitment: it named the 7px scale in its
proposal at 03:53, before the first apply_layout, and the measurement ran at
03:56:41. The causal channel is get_house_rules.
