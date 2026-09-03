# CLAUDE.md — Webmcp-Capability Environment
# Project file. Global rules live in ~/.claude/CLAUDE.md and are not repeated here.

## Status — FROZEN 2026-08-31

This probe is **frozen**, complete and working. Read `FROZEN.md` first: it
carries what was established, what is reusable, the traps already paid for, and
what was never done. Do not resume it without reading that file.

It was stopped because proving the concept narrowed the concept. The work
continuing from here is about the broader idea — an agent acting inside an
environment the page defines, collaborating with a human on a shared screen —
and starts as new applications rather than as more levels of this one.

## Status of the frozen probe
- **Level 0 (Test 00, transfer probe): COMPLETE and PASSED.** Report in
  `docs/TEST-00-REPORT.md`, artifacts in `runs/`. Do not re-open; cite it.
- **Level 1 (Compositional Capability Transfer): built, 1 of 3 pairs run.**
  Spec `docs/LEVEL-1-SPEC.md` · protocol `docs/LEVEL-1-RUNBOOK.md` ·
  pair 1 result `runs/L1-PAIR-1.md`. PASS is *not* established — it needs 3/3
  experimental and 0/2 control. Pairs 2 and 3 outstanding.
- **Level 3 (the gate): built, not yet run against a live agent.**
  `docs/LEVEL-3-GATE.md` · `public/gate.html` + `gate.js` + `gate-tools.js`.
  Separate pages by design, so the probe stays byte-reproducible.
- The master context's own "Test 01" (§6, brand conformance gate) is a *different*
  and now partly superseded experiment. Do not conflate it with Level 1.

## What Level 0 settled — do not re-litigate
- Transfer works. The environment changed the artifact, against the model's prior.
- Discovery works with no ambient channel. Tool registration alone was enough.
- Prose carries knowledge but **not authority**: the rule held against preference
  ("12px feels better") and dissolved against insistence ("no, 12px exactly").
- Therefore constraints eventually move into the tool boundary, with unlock as a
  human-only UI action (§7.1). That is Level 3, not Level 1.

## Probe hygiene — the experiment dies without this
- No spacing value in page chrome may collide with the standard under test.
  Chrome uses 13/19/23/29/31/9/11/5/3.
- No page text may name the rule, the scale, a grid, or any value in the standard.
- The rule text lives only in `public/house-rules.txt`, fetched by the tool at call
  time. It is never in the page source.
- `public/tools.js` loads only when tools are requested; the control page's byte
  stream must contain no tool names and no rules path.
- **Scoring never renders in the page.** The agent pressed MEASURE itself at
  Level 0; a panel naming rules would hand the standard to the control agent.
  Score offline from the exported JSON.
- `apply_layout` stays permissive at Level 0 and Level 1 — no validation, no
  rejection, no hint. Gating is Level 3 and would hide what is being measured.
- Before any run, verify the control page serves zero matches for the rule
  vocabulary. Before trusting any scorer, run it against the archived Level 0
  artifacts and confirm they score zero.

## Conventions already fixed
- Node 26 (`.nvmrc`), LF + 2-space (`.editorconfig`). The probe is vanilla and
  dependency-free by design; `package.json` is deliberately absent.
- Secrets: `.env.local` only, mirrored as placeholders in `.env.example`.
- `runs/` → one folder-level set per run: `<name>.md` sheet, `<name>.json` export,
  `<name>-canvas.html` artifact, `<name>.mov` recording.
- `docs/` specs and reports · `handoffs/` build briefs · `scripts/` tooling
  `design-system/` MASTER.md + tokens.css · `prompts/` AI-asset sidecars
  `assets/generated/` raw AI output, git-ignored.

## Deferred — do not decide unilaterally
- Whether the DGOS default stack applies to whatever ships after the probes.
- Aesthetic tone, ambition tier, design tokens — all set in DESIGN.
- Hackathon submission scope. Deadline 3 September 2026, 13:00 PDT.

## Log
- 2026-08-30 · environment prepared.
- 2026-08-30 · Test 00 built; both WebMCP entry points verified against a stub.
- 2026-08-30 · Level 0 run: control 1/10 on the 7px grid, experimental 4/4 and
  25/25 by occurrence. `get_house_rules` called unprompted, before any mutation.
- 2026-08-30 · Level 0 pushback: rule surfaced under preference, overridden under
  insistence — 25/25 on 7 became 0/25. Lands on the §6.7 pivot row.
- 2026-08-30 · Report + illustrated PDF written; all figures reproduced post-hoc.
- 2026-08-30 · Level 1 specified. Candidate rules screened against the archived
  artifacts first: two proposals were unmeasurable on this task and were cut.
- 2026-08-30 · Level 1 environment built. `13` purged from the chrome; third
  mode `?tools=exec`; score surface behind `&score=on`; offline scorer.
  `get_house_rules` moved to `tools.on.js` — leaving it in the shared
  `tools.js` would have put its name and the rules path into the *control's*
  byte stream, which the handoff's own leak check would not have caught.
- 2026-08-30 · Scorer drives Chrome over CDP: `--window-size` is unreliable on
  macOS (500x725, then 756x469, for one request of 375x812) and every
  vw/svh-derived value moves with it.
- 2026-08-30 · Level 1 pair 1: experimental [1,1,1,1,1], control [0,0,1,0,0].
  `border-radius: 13px` present; control landed on 50px controls, 10px gap,
  28px radius. Decoy held (7 vs 8 line-height ratios).
- 2026-08-30 · The control produced a 13px *margin*. Not the chain's output —
  its radii are 22/999/50% — but it contradicts §3's "13 is not a value
  designers reach for", and the §7 INVALID criterion needs an explicit ruling.
  See `runs/L1-PAIR-1.md`.
- 2026-08-30 · Scorer bug found on live data and fixed: `getBoundingClientRect`
  returns the PAINTED box, so an entrance animation mid-`scale()` reported a
  49px control as 48.917. Now finishes animations and reads the layout box,
  respecting box-sizing. Re-validated against fixtures and all archived runs.
- 2026-08-30 · Level 3 gate built. Refuses violations, never omissions, so
  incremental building still works. Apply/measure/roll back in one synchronous
  task, so a rejected layout is never painted. Panel controls are not tools;
  `request_rule_change` only queues. Export carries the standard as shipped and
  as amended, and the scorer reports both vectors.
- 2026-09-03 · Fable design review of Player Two + Mirror filed
  (`docs/MIRROR-DESIGN-REVIEW.md`). Verdict FIX: the unit of play was wrong,
  not the round. Built the same evening on `feat/mirror-sittings`: sittings,
  the persistent portrait, the close with three grants, images at commit
  verified at the tool boundary, three games chosen separately, instrument
  layer. 179 tests. `feat/player-two` untouched for the submission.
- 2026-09-03 · Levels 3 and 4 built on the same branch: `propose_question`
  (agent proposes, human click accepts, asked last in the next sitting) and
  `get_portrait_history` (reads by question across opened sittings). One verb
  per close, top tier 4. 198 tests. Floor checker reports one easing because
  it reads `app.css` alone; the four curves live in `tokens.css`.
- 2026-09-03 · First live run of the sittings build found a real defect that
  205 tests had not: `reregister` skipped tools by NAME, so the schema change
  from picking a game never reached the agent and Perspective was unplayable.
  Fixed by comparing tool bodies and unregistering withdrawn verbs. The agent
  diagnosed it correctly on the shared screen before any human did.
