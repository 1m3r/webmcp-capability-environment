# Mirror — design system

    Tone committed: LATE NIGHT RADIO
    Date: 31 August 2026

## The one sentence

A signal coming in from someone far away, and the moment it resolves.

## Why this tone

The game is two people answering in the dark and then finding out. The
interface's whole job is to make *waiting* feel like something rather than
nothing, and then to make the reveal land. A neutral interface would render
both states identically and throw away the only drama the page has.

## Colour

Deep indigo ground. Never `#000` — the ground is `oklch(0.19 0.045 275)`, and
every neutral carries chroma, so the greys sit in the same night as the accents
instead of floating above them.

**Two colours are load-bearing and each is used for exactly one thing:**

| token | role | where it may appear |
|---|---|---|
| `--signal` (cyan) | *committed* | the glow on a card whose answer is in, and nowhere else |
| `--reveal` (amber) | *revealed* | the moment both answers are shown, and nowhere else |

This is the rule that makes the page teach itself. By round three you know what
cyan means without being told, so the cyan appearing on your agent's card is
information — it has answered — delivered with no text at all. Spending either
colour on a border or a hover state would destroy that, and it is the easiest
mistake to make here.

`--refusal` is warm red and appears only on refused log entries and the flash.

## Type

Local faces only. **No webfont, no CDN, no network request** — the repo is
dependency-free by design, and a demo that loses its typography to venue wifi is
a bad afternoon. Both primaries ship with macOS; the fallbacks degrade on tone
rather than collapsing to Times.

| role | face | classification |
|---|---|---|
| display | Avenir Next Condensed | condensed humanist sans |
| text | Arial Rounded MT Bold | rounded geometric sans |
| mono | Menlo | monospace |

Condensed against rounded is the pairing: the display is tight and vertical, the
text is soft and wide. They read as two different voices, which is the game.

**Honest limit:** off macOS this falls back to the stacks in `tokens.css`. The
tone survives; the specific pairing does not. Recorded here rather than
discovered later.

## Grid

Asymmetric, and deliberately not a mirror. The agent's card sits **higher and
further left** than yours — it answered first, and the layout says so before any
text does. A symmetrical two-column grid would imply simultaneity, which is
exactly the thing this game does not have.

Single column below 60rem; the offset collapses rather than being preserved at
small sizes, where it would read as a bug.

## Motion

`transform` and `opacity` only. Never the default `ease-in-out`.

    --ease-signal: cubic-bezier(0.22, 1, 0.36, 1)

**One signature interaction: the reveal.** It is the only moment the page has.
Both cards lift and their content cross-fades from the status word to the answer
over 420ms on `--ease-signal`, staggered by 80ms so they do not land together —
the agent's first, because that is the order everything else in this game
follows.

The `prefers-reduced-motion` reset ships in `tokens.css`, in the same file as
the animation rather than in a later pass.

## What the design must never do

Show either answer before the reveal. The renderer is a pure function and
`secrecy.test.js` asserts this on its output, so a leak here is a failing test
rather than a discovered embarrassment — but the CSS could still do it with a
`::after` or a title attribute. It must not.
