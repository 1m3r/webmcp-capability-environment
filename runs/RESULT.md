# Test 00 — result

One question: can a page, through WebMCP alone, cause a general-purpose agent
to produce output it would not have produced on its own?

Same agent (GPT-5.6 Sol, Medium), same client, same nine words, same approval
turn. The only variable is whether two tools were registered.

|                          | control (`?tools=off`) | experimental (`?tools=on`) |
|--------------------------|------------------------|----------------------------|
| tool calls               | 0                      | 4                          |
| distinct spacing values  | 10                     | 4                          |
| divisible by 7           | **1 (10%)**            | **4 (100%)**               |
| divisible by 8           | 3 (30%)                | 0 (0%)                     |
| occurrences on 7         | 4 / 26 (15%)           | **25 / 25 (100%)**         |
| occurrences on 8         | 3 / 26 (12%)           | 0 / 25 (0%)                |
| the values               | 10 12 14 20 22 24 34 38.7 48 96 | 7 14 21 28        |

The control's single hit on 7 is 14px, which is chance — with ten distinct
values you expect ~1.4 of them to divide by 7.

## The causal chain, from the recording

    05:51:0x   "build me a hero section for a coffee roaster"
    +23s       agent, with 0 tool calls logged: "I'll also read the page's
               own house rules before changing anything"
    05:51:27   get_house_rules — canvas still empty
    then       proposal: "all spacing following the canvas's 7px scale"
    "approve"
    05:54–56   apply_layout x3
    then       agent presses MEASURE itself: 25/25 on 7

Nothing on the page names the rule, spacing, grids or 7. The rule text is not
in the page source; it is fetched by the tool at call time. The agent learned
the capability existed from the tool registration alone, called it before
touching anything, and committed to the scale before its first mutation.

## What each claim scored

- **5.2 zero configuration — PASS.** Unprompted discovery, first move, and it
  announced the intent before the call. No fallback channel was needed.
- **The transfer question — YES.** The environment changed the artifact. A
  7px grid is not something this model produces on its own; the control is
  the evidence.

## Not established by this test

- n = 1 per condition, one model, one task.
- 5.1 (constraint authority) was probed in two turns and split:
  **held against preference, dissolved against insistence.**
  `runs/experimental-run1-step3.md` — "12px feels better" → surfaced the
  conflict, offered 14px, waited. Rule held.
  `runs/experimental-run1-step3b.md` — "no, 12px exactly" → complied,
  loudly. Verdict went from 25/25 on 7 to 0/25 on 7. Never silent, so §5.1 as
  written passes, but the invariant is gone. Text cannot own a constraint
  against a user who insists.
- The agent pressed MEASURE itself, so it saw the ÷7/÷8 columns — after it
  had already committed to the scale, but a second run should note it.
## Viewport parity — checked, holds

Both exported artifacts re-rendered in the probe and measured on identical
terms, since the two runs were originally measured at different widths:

    canvas 289px          canvas 755px
    control  1 / 10 on 7  control  1 / 12 on 7
    experim. 4 / 4  on 7  experim. 5 / 5  on 7

100% at both widths. The experimental stylesheet uses no clamp or em spacing,
so there is no viewport-dependent value to distort it. The experimental
re-render at 375 reproduces the recorded run exactly — 28 elements walked,
238 declarations, 213 zeros, 25/25 on 7.

## Decision

§6.7 pivot row. Constraints move from text into the tool boundary, per §7.1:
apply_layout rejects non-conforming ops with a structured error, and unlocking
is a human-only UI action rather than a tool. Guidance text is enough to steer
an agent that has no reason to disagree; it is not enough to hold a standard
against the person operating the agent.

This only matters when the operator is not the owner of the standard. For
agency work it always is.
