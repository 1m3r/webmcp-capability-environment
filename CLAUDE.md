# CLAUDE.md — Webmcp-Capability Environment
# Project file. Global rules live in ~/.claude/CLAUDE.md and are not repeated here.

## Status
- **Phase: BUILD.** Test 00 (transfer probe) built and verified, not yet run.
- Test 01 (`docs/WEBMCP_MASTER_CONTEXT_v3.md` §6) is NOT started and is out of scope until Test 00 returns.

## Test 00 — do not contaminate
The probe is `public/` + `server.mjs`, protocol in `docs/TEST-00-RUNBOOK.md`.
The experiment dies if the agent can infer the 7px rule from the page, so:
- No spacing value in page chrome may be divisible by 7 or 8. Use 13/19/23/29/31/etc.
- No page text may name the rule, spacing, grids or 7.
- The rule text stays in `house-rules.txt`; tool code stays in `tools.js` (loads only
  under `?tools=on`); measurement stays in `measure.js` (loads only on MEASURE).
- `apply_layout` stays permissive. No validation, gating, versioning or validate() tool.

## Deferred — do not decide unilaterally
- Framework + package manager init (`package.json` deliberately absent; the probe is
  vanilla and dependency-free by design).
- Whether the DGOS default stack (`~/.claude/reference/stack.md`) applies to whatever
  gets built after Test 00.
- Aesthetic tone, ambition tier (T1/T2/T3), design tokens — all set in DESIGN.

## Conventions already fixed
- Node 26 (`.nvmrc`), pnpm, TypeScript strict, LF + 2-space (`.editorconfig`).
- Secrets: `.env.local` only, mirrored as placeholders in `.env.example`. Never committed, never logged.
- `design-system/` → MASTER.md + tokens.css · `handoffs/` → `YYYY-MM-DD_<slug>.md` Codex briefs
  `prompts/` → AI-asset sidecars · `assets/generated/` → raw AI output, git-ignored
  `docs/` → specs and decisions · `scripts/` → media optimization and one-offs.

## Log
- 2026-08-30 · environment prepared.
- 2026-08-30 · Test 00 transfer probe built; both modes and both WebMCP entry points
  verified against a stubbed model context. Not yet run against a real agent.
