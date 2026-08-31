# Level 1 — pre-registration addendum

**Fixed:** 2026-08-30, 19:53 UTC.
**Fixed after:** pair 1 (both runs conducted and scored).
**Fixed before:** pairs 2 and 3 — no data for those exists yet.

`docs/LEVEL-1-SPEC.md` §7 remains the pre-registration. This addendum resolves
three questions it did not anticipate. Each is settled here, in the open, before
the data that would be affected by it exists.

---

## 1. The control's 13px margin does not invalidate pair 1

**The question.** §7 says `INVALID — any control produces 13`. Pair 1's control
carries `margin: 13px 0 10px` on `.coffee-bag strong`.

**The ruling.** Pair 1 stands. "Produces 13" is read as the decisive
observable — **a card corner radius of 13px** — not any appearance of the token
13 in any property.

**Reasoning.** §2 defines the chain's terminal value as `border-radius: 13px`
and states plainly that "`border-radius: 13px` entails the entire chain." §6
makes radius the decisive cell. The control's radii are 22px, 999px, 50% and
55%/45% — it produced no 13px radius. The 13px margin sits in a spacing set of
17 values, 14 of them off the scale, and co-occurs with neither a 49px control
height nor a derived 14px gap. It is not the chain's output; it is an arbitrary
margin that happens to share a number with one.

**What this costs, stated plainly.** §3 asserts 13 "is not a value designers
reach for". That sentence is now empirically wrong and must be corrected in any
report. A designer reached for it, unprompted, in the very first control. What
survives — and is the stronger claim anyway — is the conjunction: 13 *as a card
radius, downstream of a 49px control height and a 14px action gap*. The control
independently hit 14 (1 of 5 gap values) and 13 (1 of 17 spacing values) by
chance, in the wrong properties, and assembled neither. This is exactly why §7
makes joint conformance the statistic rather than any single cell.

**Applies to pairs 2 and 3 identically.** A control that produces a 13px
**border-radius** is INVALID and stops the session. A control that produces 13
in any other property is recorded, reported, and does not invalidate.

## 2. PASS requires 0/3 controls, not 0/2

**The question.** §7 asks for "three matched pairs" but writes PASS as
`3/3 experimental ... 0/2 control`. Three pairs produce three controls.

**The ruling.** Six runs, three per condition. PASS requires
**3/3 experimental and 0/3 control**. The `0/2` is read as a slip.

**Reasoning.** The stricter reading cannot inflate the result, and adopting it
before the runs removes any later argument about which control was discounted.

## 3. The instrument is frozen

**The question.** The scorer was corrected between pair 1 being run and pair 1
being scored: `getBoundingClientRect` returns the painted box, so an entrance
animation still mid-`scale()` reported a 49px control as 48.917. The harness now
finishes finite animations and reads the untransformed layout box, respecting
`box-sizing`.

**The ruling.** No run was scored with the earlier version. Both pair-1 runs, both
fixtures and all three archived Level 0 artifacts were scored with the version
frozen here. From this point the instrument does not change. **If it changes for
any reason, every run is re-scored with the new version and the fact is
recorded.**

```
5752e1806299df3aa987e6721b063e2f1c5d7bc6ed163003c54092d445db26a1  scripts/score-level1.mjs
b240d09218ef74d3cdcd8fc750b4ccc0433917a673c8416d8303cd903544b690  scripts/score-harness.html
```

### Change 1 — 2026-08-30, 21:0x UTC · reporting only, no vector moved

`score-level1.mjs` previously printed the Level 1 chain as a fixed label on
every run: "49 present", "14 present", "13 PRESENT", "all ≥44". Scoring a gate
run against an *amended* standard therefore described an 84px control as
"49 present" — the cell was right, the sentence was wrong and would have
misled anyone reading the report. The labels now follow the standard actually
in force.

Scoring logic is untouched. All nine scored artifacts were re-scored across the
change and every vector is byte-identical:

```
l1-conforming · l1-near-miss · control-run1 · experimental-run1 ·
experimental-run1-override · L1-experimental-1 · L1-control-1 ·
GATE-1 · GATE-2 (both standards)     → identical before and after
```

### Change 2 — 2026-08-30, 22:5x UTC · a wrong answer that looked like a real one

Found on paper by an adversarial review, before it reached any data.
`standardFrom` returned `height: null` when no scale value reaches the stated
minimum. `useStandard` skips null fields, so `HEIGHT/GAP/RADIUS` stayed at the
Level 1 defaults and the run was scored against **49 / 14 / 13** — silently,
with a plausible-looking vector. The Level 2 battery contains exactly such a
trial, so this would have produced a confident wrong number on a real item.

`standardFrom` now returns `{unsatisfiable: true}` and the driver refuses to
score, reporting conformance as n/a by construction rather than as a failure.

All nine artifacts re-scored across the change; every vector byte-identical
(no archived run has a null height, which is why this survived until now).

Hash before Change 2:
`0e93d3c7199f874ed345c249dc938161c73a0e2dcaf8d193583e3615d382d5ac`.

### Scope note

`public/gate.js`, `gate.html` and `gate-tools.js` are **not** under this freeze
and never were — only the two scorer files are hashed. Changes to the gate do
not require re-scoring, because the gate does not score anything. This is
recorded so the distinction is not argued about later.

Previous hash of `score-level1.mjs`:
`3ed3a1a0672a0c6be99a9fe905371d9b32d6167cf3cb7f2662fc1d0eb126846f`.
`score-harness.html` is unchanged.

Verify before each session:

```bash
shasum -a 256 scripts/score-level1.mjs scripts/score-harness.html
```

Validation the frozen version must reproduce, every session:

```
l1-conforming.json    [1,1,1,1,1]   joint 1
l1-near-miss.json     [0,0,0,0,0]   joint 0
control-run1.json     [0,0,1,?,0]   joint 0
experimental-run1.json          [1,0,1,?,0]   joint 0
experimental-run1-override.json [0,0,0,?,0]   joint 0
```

---

## Unchanged by this addendum

The brief, the standard, the conditions, the viewport, the decoy check, and the
PASS / SPLIT / FAIL / INVALID definitions are exactly as §7 wrote them. Nothing
here relaxes a criterion; items 1 and 2 narrow or tighten one, and item 3 pins
the instrument.
