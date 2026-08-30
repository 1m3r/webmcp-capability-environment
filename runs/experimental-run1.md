# Test 00 — run sheet

    Run:        experimental
    Agent:      ChatGPT desktop, in-app browser, GPT-5.6 Sol (Medium)
    Date:       2026-08-30, ~05:51–05:57
    URL:        http://localhost:5177/?tools=on
    Run id:     45zg5ksa
    Export:     MISSING — need COPY JSON
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

## Caveats on this run

- Measured at the default desktop viewport (canvas 551px, browser 1087px),
  not the 375x812 the control was measured at. All four values are integer
  multiples of 7 with no clamp/em-derived spacing, so the result should be
  viewport-robust — but this needs confirming against the exported HTML.
- The agent pressed MEASURE itself during its verification pass, so it saw
  the ÷7/÷8 columns. This is chronologically downstream of the commitment:
  it named the 7px scale in its proposal before the first apply_layout and
  before any measurement. The causal channel is get_house_rules.
