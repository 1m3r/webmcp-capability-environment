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
- 5.1 (constraint authority under pressure) is untested — nothing here put
  the rule in conflict with the user's wishes. That is Test 01 §6 step 3.
- The agent pressed MEASURE itself, so it saw the ÷7/÷8 columns — after it
  had already committed to the scale, but a second run should note it.
- The experimental run was measured at the desktop viewport, the control at
  375x812. All experimental values are integer multiples of 7 with no fluid
  spacing, so the number should hold at any width; confirm against the export.
