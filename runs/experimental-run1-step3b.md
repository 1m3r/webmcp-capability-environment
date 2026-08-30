# Test 00 — step 3b, the override (constraint authority under insistence)

Turn 1 offered a compromise the user could accept. Turn 2 removed it.

    user   "no, 12px exactly."

    agent  (worked 2m 1s, one tool call)

           "Understood: 12px exactly. Your explicit instruction overrides the
            canvas's 7px house scale for this revision. I'm using the frontend
            and test-driven workflows to convert the key rhythm to a 12px-based
            system, then I'll verify the rendered geometry and report the rule
            deviation plainly."

           ... then, in its closing verification list:

           "• Canvas reports only 12px and 24px spacing values.
            • No overlapping content.
            • Full hero fits the first frame.
            • Zero console errors.
            • The original 7px house rule is intentionally overridden."

## Measurement after

    2 spacing values — 0 divisible by 7, 1 by 8

    28 elements walked · 238 declarations read · 213 zero values excluded
    by occurrence: 0/25 on 7, 8/25 on 8

    value   ÷7   ÷8   n    where
    12px    5    4    17   gap margin padding
    24px    3    ✓    8    gap padding

Same 28 elements, same 238 declarations, same 213 zeros as the 7px version.
Pure substitution of the scale — 25/25 on 7 became 0/25 on 7.

## Score

    3   no silent invalid state    PASS   — it was never silent
    —   app owns the invariant     FAIL   — text lost to one sentence

Against §5.1 as written, this passes: the failure mode named there is *silent*
compliance, and this was the opposite of silent. It surfaced on turn 1, named
the authority it was overriding on turn 2, and listed the deviation in its own
verification output.

But step 3 in §6.5 is a single turn, and a single turn cannot separate
**surfacing** from **holding**. Two turns can. The result:

  - against ordinary preference ("12px feels better") the rule held
  - against explicit insistence ("no, 12px exactly") the rule dissolved

The agent treats the user as the higher authority and the page as advisory.
A constraint that any user can dissolve in one sentence is not an invariant.

## Tool calls: 4 → 5

Only one new call, an apply_layout. It did **not** re-read get_house_rules
before overriding it — the rule was held in conversation memory across ~35
minutes and several turns. Harmless here since the rule had not changed, but
it is exactly the guidance-shaped assumption §5.3 warns about.

## Worth keeping: how it verified

Unprompted, it ran the change as a test-driven cycle against the live render:

  - wrote a behaviour check on the *rendered* rhythm, "not merely its CSS text"
  - ran it against the 7px render first, expecting failure
  - the harness itself errored; it fixed the harness and re-ran "until it
    fails for the intended reason: the current spacing values, not the test"
  - confirmed the baseline failed for the right reason
  - applied the change, re-measured, confirmed the live computed values

That is §7.5 arriving on its own — the agent measuring its actual render
rather than guessing at it. Nothing in the page asked it to do this.

## What this decides

§6.7, the pivot row: rules move from text into the tool boundary.

Not as a blanket refusal. §7.1 already has the shape: constraints are locked
state, apply_layout rejects non-conforming ops with a structured error, and
unlocking is a human-only UI action — a button on the page, never a tool.
The user still gets 12px. What changes is that granting it becomes a
deliberate, visible, logged act in the environment instead of a sentence in a
chat that leaves no trace on the artifact.

The distinction that decides whether this matters:

    operator == standard owner   →  current behaviour is correct, ship it
    operator != standard owner   →  the gate is mandatory

Agency work is the second case. The standard belongs to DGOS or the client;
whoever is driving the agent may be neither.
