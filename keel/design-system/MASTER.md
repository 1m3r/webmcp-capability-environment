# Keel — design master

**Committed tone: Drydock.**

> A working drawing, not a document about one. The page should feel like the
> surface a thing gets built on — measured, ruled, technical — so that when the
> gate refuses, it reads as a machine reporting a tolerance, not an app being
> unhappy.

Committed 31 August 2026, before any interface code. Two directions were
rejected: **Atelier** (editorial serif, bone and oxblood, one generous column)
because a document that reads like prose undersells that this is an instrument
with enforcement in it; and **Console** (terminal-brutalist, phosphor on
near-black) because it makes the page look like a log rather than a workspace a
human acts in, and the human's judgment is the load-bearing input here.

## Type

Two faces, different classifications, each chosen for the tone.

| Role | Face | Classification | Why |
|---|---|---|---|
| Display | Archivo Narrow | condensed grotesque | Title-block lettering. Narrow set lets phase names sit in a tight rail without shrinking. |
| Text | IBM Plex Mono | monospace | Everything on this page is a value under inspection — ids, versions, check names, offenders. A monospace makes `T1`, `q4`, `v17` read as identifiers rather than words, and columns of check results align without tables. |

Fallbacks ship for both; the page is legible with neither loaded.

## Palette — OKLCH only

Every neutral carries chroma above zero. The dark ground is never `#000`.

| Token | Value | Role |
|---|---|---|
| `--ground` | `oklch(0.22 0.06 265)` | deep indigo, the drawing board |
| `--ground-2` | `oklch(0.27 0.055 265)` | raised panels |
| `--ground-3` | `oklch(0.32 0.05 265)` | cards |
| `--ink` | `oklch(0.93 0.03 85)` | warm paper, primary text |
| `--ink-2` | `oklch(0.72 0.03 85)` | secondary text |
| `--rule` | `oklch(0.42 0.05 265)` | the ruled lines between panels |
| `--accent` | `oklch(0.78 0.13 210)` | draft-line cyan — the agent's marks |
| `--pass` | `oklch(0.76 0.15 155)` | a check that holds |
| `--fail` | `oklch(0.68 0.19 25)` | a check that does not |
| `--pending` | `oklch(0.82 0.14 85)` | queued, awaiting a human |

Cyan is the agent. Amber is anything waiting on the human. That separation is
the whole read of the page: you can tell at a glance who owes the next move.

## Motion

`transform` and `opacity` only. One custom easing, `--ease:
cubic-bezier(0.2, 0.9, 0.3, 1)` — never the browser default. The
`prefers-reduced-motion` reset ships in `tokens.css`, not as an afterthought.

## The signature interaction

**The refusal.** When `request_advance` is refused, the gate panel takes a
single sharp horizontal displacement and the failing checks resolve in — one
motion, under 400ms, no bounce. It is the moment the page stops being a form
and becomes a boundary, and it is the thing worth putting on camera.

Nothing else on the page animates on a loop, pulses, or draws attention to
itself. One moment gets the motion budget.
