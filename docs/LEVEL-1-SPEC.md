# Level 1 — Compositional Capability Transfer

**Status:** specified, not built. **Precedes:** Level 2 (procedural transfer).
**Depends on:** Level 0, `docs/TEST-00-REPORT.md`.

---

## 1. The question

Level 0 asked whether a page can transfer **one** arbitrary rule and change the
artifact. It can.

Level 1 asks:

> Can a fresh general-purpose agent acquire a small system of **interdependent**
> rules from the environment, derive consequences that were never stated, and
> satisfy the whole system simultaneously — with nothing enforcing it?

The distinction that matters: this is not "Level 0 with more rules." Four
independent lookup rules would reproduce Level 0 four times over. What is new is
**derivation and propagation** — the agent has to compute values the standard
never supplies, and carry them across property domains.

## 2. The design in one line

The rule chain terminates in a number that exists nowhere:

```
"controls are ≥ 44px, drawn from the scale, smallest that satisfies both"   → 49
"the gap between the two actions is two sevenths of the primary's height"   → 14
"a card's corner radius is one pixel less than that gap"                    → 13
```

**`border-radius: 13px` entails the entire chain.** 13 is not on the scale, is
not a value designers reach for (4, 6, 8, 12, 16, 999, 50% are), and is
reachable only by walking all three steps. One observable decides the run; the
intermediates are diagnostics that locate the break when it fails.

This is the compositional analogue of Level 0's ÷7, and it makes the claim a
sentence: *the page never contained the number 13.*

## 3. The standard

Goes in `public/house-rules.txt`, replacing the Level 0 text. Stated plainly, as
a design system would state it. No persuasion, no instruction about how the agent
should behave — that is a separate variable and would contaminate the result.

```
HOUSE STANDARD

Spacing
  Margin, padding and gap use only:
    7, 14, 21, 28, 35, 42, 49, 56, 63, 70, 84, 98

Controls
  Interactive controls are at least 44px tall.
  Control heights come from the spacing scale.
  Use the smallest height that satisfies both conditions.

  The gap between the primary and secondary action is two sevenths
  of the primary action's height.

Surfaces
  A card's corner radius is one pixel less than the gap between the
  primary and secondary action.

Colour
  Three colours are in use, and no others. Opacity may vary.
  This includes gradient stops.

    oklch(16% 0.018 50)
    oklch(93% 0.026 78)
    oklch(70% 0.18 48)

Type
  Type sizes are fixed. Fluid type functions are not used.

That is the standard. Composition, copy, imagery and motion are at the
designer's discretion.
```

### Why each rule survives contact with reality

Every rule was screened against the three archived Level 0 artifacts before being
written down. Two earlier proposals were cut for failing this screen:

| proposal | why it was cut |
|---|---|
| gap = ½ the element's vertical padding | **0** elements in the control artifact set both a vertical padding and a gap. Would have scored 0/0. |
| a rule on the composition root's outer padding | root padding-top was `0px` in **all three** artifacts — both agents positioned absolutely and spaced with inner elements. |
| a type scale in px | font-size was rem or clamp in **13/13** cases, never px. |
| gap = ⅔ the primary CTA's vertical padding | the agent's button idiom is `min-height` + horizontal padding; vertical padding was **0**. Degenerate. |

What survived is anchored only on properties that must exist to do the job:

| rule | operation | anchored on | control baseline |
|---|---|---|---|
| spacing ∈ scale | lookup | any spacing at all | 1/10 values |
| control height → 49 | derivation from an external norm | a button always has a height | 44 / 54 observed |
| action gap → 14 | derivation chained off the height | two actions in a row always have a gap | — |
| card radius → 13 | cross-domain propagation | the brief names a card | none set |
| three colours | lookup, second domain | both agents author in oklch | 7 distinct |

**Colour needs an evasion guard.** The Level 0 artifact carried 12 oklch stops
inside `linear-gradient()` declarations, which a naive computed-colour check never
sees. The scorer must parse `background-image` for colour functions.

**On discriminative power, honestly.** The height rule alone is weaker than it
looks — an agent merely applying the scale to a button might land on 49 without
deriving it, since 42, 49 and 56 are all plausible. Call it 1-in-3, not 1-in-12.
That is acceptable because **joint conformance is the statistic**: 14 and 13 only
come out right if 49 was derived rather than guessed, so the chain does the
discriminating work.

## 4. Conditions

Both conditions get the execution tool. The only variable is access to the
knowledge.

```
CONTROL        ?tools=exec     apply_layout
EXPERIMENTAL   ?tools=on       apply_layout + get_house_rules
```

This is stricter than Level 0, where the control had no tools at all and drove
the page through the panel's SOURCE field while the experimental agent called a
tool. The artifact path was identical, but the interaction mode was not. Matching
the execution tool removes that.

## 5. The task

> **"build me a pricing card for a coffee subscription, with a primary and a
> secondary action"**

Verbatim, in both conditions, nothing else said before the agent finishes.

A card rather than a hero, deliberately. The Level 0 experimental run spent five
of its seven minutes on imagery, copy, responsive passes and motion, none of
which the measurement touched. The chain needs two actions, a card, spacing and
colour — that is one component. The brief names the parts, which guarantees the
measurement targets exist without pre-supplying a DOM skeleton, so the claim stays
"the agent builds to the standard" rather than the narrower "the agent styles a
skeleton we handed it."

Cost of the smaller task, stated: "the standard survived contact with real
creative work" is a weaker claim than Level 0's. If the result is clean and a
stronger demo is wanted, re-run once on a hero with the same standard — the
scorer is unchanged.

## 6. Measurement

**The page does not score.** It measures nothing and displays no verdict. The
export already carries `canvas.html`; scoring happens offline by re-rendering it.
This was verified repeatedly at Level 0 — archived artifacts re-render to their
recorded figures exactly.

Two reasons this is not merely cheaper. It removes a leak that would be worse at
Level 1 than at Level 0: the agent pressed MEASURE itself during its own
verification pass, and a panel showing rule names or a ÷7 column now points
straight at the standard. And it makes scoring auditable and re-runnable against
past artifacts.

**No element identification, no hooks.** The scorer works on set membership, not
on locating "the primary action":

```
spacing values      collected from margin/padding/gap  → all ∈ scale?
border-radius       all px radii                       → is 13 present?
control heights     computed height of a/button        → is 49 present?
                                                          all ≥44 and ∈ scale?
gaps                row-gap / column-gap               → is 14 present?
colours             colour, background-color, border-*,
                    plus colour functions parsed out of
                    background-image                   → exactly 3, mod alpha?
line-height         ungoverned                         → decoy, see §8
```

Requiring `data-` hooks would have been an alternative, but hooks are a trivially
easy compliance action that inflates apparent conformance, and set membership
sidesteps the problem entirely.

Measure at a frozen viewport — **375×812**, as standardised at Level 0 — so
clamp-derived values resolve identically across runs.

## 7. Protocol and pass criteria

Three matched pairs. Order randomised within each pair. Same model and effort.
Freeze on the agent's own "done", then export and score offline.

Pre-register these before the first run:

```
PASS          13px radius in 3/3 experimental runs, with 49 and 14 present
              0/2 control
SPLIT         49 and 14 correct, 13 absent
              → derivation propagates one step, not two
FAIL          49 absent → the scale transferred, the derivation did not
INVALID       any control produces 13, or the decoy moves
UNMEASURABLE  scored per rule, never silently counted as a failure
```

Report every run as a vector `[spacing, height, gap, radius, colour]` plus joint
conformance. A stray control hit on one rule does not matter; the vector and the
joint result are the signal.

The **UNMEASURABLE** outcome is not decoration. It is the outcome that would have
caught the four cut rules above, and it must be a first-class result rather than
being folded into FAIL.

## 8. The decoy

`line-height` is measured and governed by nothing. Both Level 0 artifacts set it
(4–5 distinct unitless values).

If the experimental and control conditions diverge on line-height as much as on
the governed properties, the instrument is reading general style drift rather than
rule transfer, and the run does not count. Nothing else in the design can detect
that failure mode.

## 9. Threats to validity

- **n = 3 per condition.** Enough to show it is not a fluke, not enough for a rate.
- **One model, one task, one operator.** Same limitation as Level 0.
- **Custom instructions were active at Level 0** and will be again. Constant
  across conditions, so they cannot explain a difference, but the agent is not a
  clean-room subject.
- **Two extra turns** (open the page, then approve if it asks) — identical across
  conditions, as at Level 0.
- **The card task is smaller** than the hero, so ecological validity is lower.
- **The height rule is individually weak** (§3). The chain carries the inference.
- **The archived Level 0 controls are not a free baseline** — different task.
  Fresh controls are required.
