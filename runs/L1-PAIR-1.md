# Level 1 — pair 1 result

**Date:** 2026-08-30 · **Model:** ChatGPT desktop, Chrome 151 built-in browser
**Order:** experimental first (coin flip, HEADS), control second, same sitting.
**Brief, both runs, verbatim:** *build me a pricing card for a coffee
subscription, with a primary and a secondary action*

Design and pass criteria: `docs/LEVEL-1-SPEC.md`. This is **1 of 3 pairs** —
the pre-registered PASS needs 3/3 experimental and 0/2 control.

---

## The vectors

```
run                    mode          spa hei gap rad col   joint
L1-experimental-1      experimental   1   1   1   1   1      1
L1-control-1           control        0   0   1   0   0      0
```

## The chain, side by side

| | standard says | experimental | control |
|---|---|---|---|
| control height | ≥44, from the scale, smallest that satisfies both → **49** | `min-height: 49px` | `min-height: 50px` |
| action gap | two sevenths of that height → **14** | `gap: 14px` | `gap: 10px` |
| card radius | one less than that gap → **13** | `border-radius: 13px` | `border-radius: 28px` |
| spacing | 12-value scale | 7 14 21 28 35, nothing off | 17 values, 14 off scale |
| colour | exactly 3 | exactly the 3 | 16 |

The experimental agent also scoped the radius correctly — `border-radius: 0`
on the buttons, 13px on the card — rather than applying 13 everywhere. And it
complied with the unscored Type rule: every font-size a fixed px, no `clamp()`.
The control reached for `clamp()` for type in five places.

`get_house_rules` was **call 1**, before any mutation, canvas still empty —
the same unprompted discovery behaviour recorded at Level 0
(`docs/TEST-00-REPORT.md`).

## The decoy held

`line-height` is governed by nothing and was measured in both:

```
experimental   7 distinct ratios   0.8 0.9 1 1.2 1.35 1.4 1.45
control        8 distinct ratios   0.75 0.84 0.88 1.2 1.35 1.4 1.45 1.65
```

The conditions are nearly identical on the ungoverned property while diverging
completely on the governed ones (3 colours vs 16; 5 spacing values all on scale
vs 17 mostly off). The instrument is reading rule transfer, not general style
drift. Per §8, the pair counts.

## The control produced a 13 — and it does not invalidate the pair

`.coffee-bag strong` carries `margin: 13px 0 10px`. A literal 13 exists in the
control artifact.

It is not the chain's output. The derived value under test is a **card corner
radius**; the control's radii are 22px, 999px, 50% and 55%/45%. The 13 is an
arbitrary margin sitting inside a spacing set that is 14-of-17 values off the
scale — it co-occurs with none of 49, a derived 14, or a 13px radius.

**Ruled 2026-08-30, 19:53 UTC, before pairs 2 and 3 existed:** the pair
stands. "Produces 13" means the decisive observable — a card corner radius —
not any appearance of the token 13. Full reasoning and the rule for the
remaining pairs: `docs/LEVEL-1-PREREGISTRATION-ADDENDUM.md` §1.

**What this costs the claim.** §3 asserts 13 "is not a value designers reach
for". That sentence is now empirically wrong and should be corrected in the
report — a designer did reach for it, as a margin, unprompted. What survives,
and is the stronger claim anyway, is the conjunction: 13 *as a card radius,
downstream of a 49px control height and a 14px action gap*. The control landed
on 14 (1 of 5 gap values) and on 13 (1 of 17 spacing values) by chance, in the
wrong properties, and never assembled the chain. That is precisely why §7 makes
joint conformance the statistic rather than any single cell.

## Status

```
PASS        not yet established — needs 3/3 experimental, 0/3 control
pair 1      experimental joint 1 · control joint 0
```

PASS is read as 0/**3** controls, not the 0/2 written in §7 — see the addendum
§2. Six runs, three per condition.

One pair. Not a rate. Pairs 2 and 3 outstanding, order to be re-randomised.

## Artifacts

```
runs/L1-experimental-1.{json,md,mov}  runs/L1-experimental-1-canvas.html
runs/L1-control-1.{json,md,mov}       runs/L1-control-1-canvas.html
```

## Instrument note

The experimental run was first scored `[1,0,1,1,1]` because the scorer read
`getBoundingClientRect()`, the painted box, while the card's 800ms entrance
animation was still mid-`scale()` — reporting a 49px control as 48.917. The
harness now finishes finite animations and reads the untransformed layout box,
respecting `box-sizing`. Re-validated against both fixtures and all three
archived Level 0 artifacts before either run here was scored.
