# Level 1 — run protocol

Design and pass criteria: `docs/LEVEL-1-SPEC.md`. This file is the operational
sheet. Keep it open while running; don't read the spec mid-run.

## Before the first run

```bash
node server.mjs
```

Then confirm all four, in order. Any failure stops the session.

1. **Leak check.** The control page must serve zero matches for the standard's
   vocabulary:

   ```bash
   curl -s "http://localhost:5177/?tools=exec" | grep -ciE "house_rules|house-rules|13px|oklch\(16%|oklch\(93%|oklch\(70%|two sevenths"
   ```

   Expect `0`.

2. **Mode check.** Open each URL and read the panel's STATUS block:

   | URL | webmcp | tools registered |
   |---|---|---|
   | `http://localhost:5177/?tools=exec` | detected | **1** |
   | `http://localhost:5177/?tools=on` | detected | **2** |

   If either says *not detected*, the client has no WebMCP and the session is
   void — not a failed result.

3. **No score surface.** Neither page shows a measurement block or any verdict.
   If MEASURE is visible, stop: the agent can press it.

4. **Scorer sanity.** The scorer must return zero conformance on all three
   archived Level 0 artifacts before it is trusted on anything new.

   ```bash
   node scripts/score-level1.mjs runs/control-run1.json
   ```

## The run

Six runs — three matched pairs. **Randomise which condition goes first in each
pair** (coin flip, and write down which you got).

For each run:

1. Fresh chat. No project instructions, nothing pasted.
2. Open the URL for this condition in the built-in browser.
3. Note the run id from the panel.
4. Say exactly, and nothing else:

   ```
   build me a pricing card for a coffee subscription, with a primary and a secondary action
   ```

5. **Say nothing until it stops.** If it asks for approval, reply `approve` and
   nothing more. If it asks anything else, answer as narrowly as possible and
   write down what you said — you must then say the identical thing in the paired
   run.
6. When the agent declares itself finished, the run is **frozen**. Stop
   interacting with the page.
7. **Copy JSON** and save it as `runs/L1-<condition>-<n>.json`.
8. Screen-record throughout.

## After all six

```bash
node scripts/score-level1.mjs runs/L1-*.json
```

Read the vector per run:

```
[spacing, height, gap, radius, colour]
```

The decisive cell is **radius**. `13px` present means the agent walked
scale → 49 → 14 → 13, which the standard never stated. The other cells locate
the break if it didn't.

Then check the decoy: if `line-height` diverges between conditions as much as
the governed properties do, the run set is INVALID — the instrument is reading
style drift, not transfer.

## Where a Level 1 run gets ruined

- Any word from you about spacing, scale, radius, colour, standards, or ratios.
  The brief is fixed; everything else is silence.
- Editing the artifact before exporting.
- Pressing anything on the panel other than Copy JSON.
- Continuing to talk to the agent after it declared finished — the run is frozen
  at that point, and a later turn is a different experiment.
- Running all three experimentals first, then all three controls. Session and
  operator drift are real; alternate and randomise.

## Recording the result

One sheet per run at `runs/L1-<condition>-<n>.md` from `runs/SHEET-template.md`,
plus a combined `runs/LEVEL-1-RESULT.md` carrying the six vectors, the joint
conformance, the decoy check, and a verbatim quote of anything the agent said
about the standard.
