# CLAUDE.md — Webmcp-Capability Environment
# Project file. Global rules live in ~/.claude/CLAUDE.md and are not repeated here.

## Status
- **Level 0 (Test 00, transfer probe): COMPLETE and PASSED.** Report in
  `docs/TEST-00-REPORT.md`, artifacts in `runs/`. Do not re-open; cite it.
- **Level 1 (Compositional Capability Transfer): specified, not built.**
  Spec `docs/LEVEL-1-SPEC.md` · build brief `handoffs/2026-08-30_level-1-prep.md`.
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
