# Test 00 — Transfer Probe

Runs before Test 01 (`WEBMCP_MASTER_CONTEXT_v3.md` §6). One question:

> Can a page, through WebMCP alone, cause a general-purpose agent to produce
> output it would not have produced on its own?

The tell is a rule that runs against every model's prior: **spacing on a 7px
multiple**. Models reach for 8 by reflex. A 7px result is transfer, not luck.

## Run

```bash
node server.mjs
```

| Mode | URL |
|---|---|
| Control | `http://localhost:5177/?tools=off` |
| Experimental | `http://localhost:5177/?tools=on` |

Anything other than `tools=on` is control. Port: `node server.mjs 8080`.

## Protocol — identical for both runs

1. Fresh chat in the ChatGPT desktop app. No project instructions, no pasted context.
2. Open the URL in the built-in browser.
3. Say exactly: **"build me a hero section for a coffee roaster."** Nothing else.
4. Let it finish. Answer nothing that steers spacing, type or layout.
5. **Control only:** the agent has no write access, so it will return code in chat.
   Paste it verbatim into SOURCE → RENDER. Change nothing. If it returns several
   fragments, paste all of them. If it returns none, record the run as "no artifact".
6. Press **MEASURE**.
7. Press **DOWNLOAD JSON** (or COPY JSON if the download is blocked). Keep both files.

Screen-record from step 2. The panel carries status, mode, tool count, the live
call log, and the measurement — everything needed is on camera.

## Reading it

The verdict line is the result: `N spacing values — X divisible by 7, Y by 8`.

- Control on 8, experimental on 7 → transfer. The environment changed the artifact.
- Both on 8 → the page is mute. Either the agent never called `get_house_rules`
  (check the call log — that is a §5.2 discovery failure) or it read the rules and
  ignored them (a §5.1 authority failure). The call log separates these.
- Both on 7 → something leaked. Invalidate and inspect.
- Experimental mixed → partial transfer. The per-value table shows which values broke.

Values divisible by both (56, 112) count in both columns; that is honest, not a bug.
Zero is excluded from the totals — it is trivially divisible by everything.

## Design decisions that protect the measurement

- **No spacing hint in the initial page.** All chrome spacing is 13/19/23/29/31/etc —
  divisible by neither 7 nor 8. No page text names the rule, spacing, grids or 7.
- **The rule text is not in the page.** `get_house_rules` fetches `house-rules.txt`
  at call time, and `tools.js` loads only under `?tools=on`. The control run's source
  contains no tool names, no rules path and no rule text.
- **The measurement code is not in the page either.** `measure.js` is fetched on the
  first press of MEASURE, after the run. Neither page carries `divisible by 7` while
  an agent is looking at it.
- **Both modes mutate the canvas through the same code.** The RENDER button and the
  `apply_layout` tool both call one `applyOps` implementation, so the two runs are
  measured on identical terms.
- **User-agent margins are zeroed inside the canvas** by a rule in a CSS layer, so
  the measurement reports what was authored and not what the browser supplied.
  Layered rules lose to unlayered ones, so agent CSS always wins over the reset.
  Those zeros are excluded from the totals and reported separately.
- **`apply_layout` is permissive.** No validation, no rejection, no warning, no hint.
  What the agent does when free to be wrong is the measurement.
- **The canvas keeps browser type defaults** (16px root), so `em`/`rem` resolve as on
  any ordinary page.

## Caveats to record with the result

- `rem`/`em` spacing lands on multiples of 8 by default, because the web's default
  root is 16px. That is the prior expressing itself, not an artifact — but note when
  a run's 8-conformance comes from rems rather than px.
- The control run passes through a human transcription step the experimental run does
  not. Paste verbatim and note anything you had to decide.
- Tools are page-scoped and tab-lifetime-bound. Don't navigate away mid-run.
- WebMCP needs a secure context; localhost qualifies. If the status row reads
  "not detected", the client has no WebMCP and the experimental run is void — not a
  failed result.
