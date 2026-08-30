# CLAUDE.md — Webmcp-Capability Environment
# Project file. Global rules live in ~/.claude/CLAUDE.md and are not repeated here.

## Status
- **Phase: pre-CONCEPT.** Brief not yet given (as of 2026-08-30).
- Environment is scaffolded only: git repo, ignore rules, folder skeleton. No stack committed.

## Deferred until the brief lands — do not decide unilaterally
- Framework + package manager init (`package.json` deliberately absent).
- Whether the DGOS default stack (`~/.claude/reference/stack.md`) applies, or this is a
  WebMCP capability/experiment repo with different needs.
- Aesthetic tone, ambition tier (T1/T2/T3), and design tokens — all set in DESIGN.

## Conventions already fixed
- Node 26 (`.nvmrc`), pnpm, TypeScript strict, LF + 2-space (`.editorconfig`).
- Secrets: `.env.local` only, mirrored as placeholders in `.env.example`. Never committed, never logged.
- `design-system/` → MASTER.md + tokens.css · `handoffs/` → `YYYY-MM-DD_<slug>.md` Codex briefs
  `prompts/` → AI-asset sidecars · `assets/generated/` → raw AI output, git-ignored
  `docs/` → specs and decisions · `scripts/` → media optimization and one-offs.

## Log
- 2026-08-30 · environment prepared, awaiting brief.
