# Mirror — the answer gallery

    Owner:   1m3r / DGOS
    Date:    3 September 2026, 00:30 CEST
    Status:  SPECIFIED, NOT BUILT — build after run 2, per the operator's
             priority call of 3 September 00:20
    Branch:  feat/player-two
    Mode:    portrait only
    Extends: docs/superpowers/specs/2026-09-02-mirror-submission-design.md

---

## 1. What it is

Every committed answer gets **four retrieved images** that match it. At the end,
the results screen becomes a gallery: each answer sits at the **exact centre of a
2×2 composition of its own four images**, straddling the seam where all four
meet.

Eight rounds, two answers each — **16 compositions, 64 images.**

A miss becomes the point rather than a line of text: your answer and your
agent's answer, one after the other, in two visibly different worlds.

**Retrieved, not generated.** The images are found on the open web by subagents
the playing agent dispatches. Nothing is synthesised.

## 2. Why this belongs in this project

The page cannot do this. It is static, offline, dependency-free, and holds no
API key — every one of those is a deliberate constraint recorded in
`README.md` and `MASTER.md`, and none of them is being traded away here.

The agent can do it.

So **the page defines a slot and refuses to fill it.** `illustrate_answer` takes
four image references for one answer. How the agent finds them — subagents in
parallel, a search tool, its own harness — is entirely the agent's business, and
the page neither knows nor asks.

This is the platform thesis running in the opposite direction from the dossier.
The dossier is the environment granting capability to the agent. The gallery is
**the environment describing a capability it does not have, and the agent
supplying it.** That is a stronger WebMCP argument than the unlock, and it costs
the page nothing but a tool definition.

## 3. The tool

    illustrate_answer({ round, whose, images })

| field | | |
|---|---|---|
| `round` | 1–8 | which round the answer belongs to |
| `whose` | `'agent'` \| `'human'` | which of the two answers is being illustrated |
| `images` | exactly 4 | `{ url, credit, license, source }` each |

Returns a confirmation naming how many answers are still unillustrated, so an
agent working through them knows when it is done without being told.

### Refusals, each naming its cause

- **round not yet revealed** — *"refused: that round has not been revealed, so
  its answers are still secret. Illustrate it after the reveal."*
- **not exactly four images** — the composition is a 2×2 and a partial one is
  not a composition.
- **already illustrated** — immutable, like a committed answer. Same reason: a
  thing that can be revised is a thing the record cannot be trusted about.
- **mode is not portrait** — quiz answers are facts, and the gallery is for
  reads, not for right answers.
- **round out of range**, **unknown `whose`**.

No refusal on image dimensions. Asking for similar sizes belongs in the manual;
refusing on a property the agent cannot reliably measure before fetching would
be a refusal it cannot act on, which was GATE-1's third defect.

## 4. Secrecy — it enforces itself, and then the page enforces it anyway

**The agent cannot illustrate the human's answer before the reveal, because it
does not know the human's answer.** The constraint is structural rather than
imposed. That is the same shape as the game's central claim, which is a good
sign it belongs.

For its *own* answer the agent could fetch early, so the page refuses attachment
until the round is revealed regardless — otherwise four pictures of the agent's
answer would appear beside a card still reading `committed`, and pre-empt the
reveal for the human.

`secrecy.test.js` extends: for every state before the reveal, no image URL,
credit or source string appears in the rendered output or the agent projection.
Image URLs are agent-authored strings reaching the DOM, so they are exactly the
class of thing the refusal panel's own test already guards against.

## 5. The composition

The visual crux is that the answer is **on the intersection**, not above it.

    ┌─────────┬─────────┐
    │         │         │
    │    ╔════╧════╗    │
    ├────╢ the text ╟────┤
    │    ╚════╤════╝    │
    │         │         │
    └─────────┴─────────┘

- 2×2 grid, square cells, `object-fit: cover` so four differently-shaped images
  still read as one block. This is what "similar size" needs in practice; the
  manual asks for roughly square images and the CSS absorbs the rest.
- The answer is absolutely positioned at 50%/50%, in `--font-display`, over a
  scrim tuned for legibility against unknown photography.
- The label (`your agent, about you` / `you, about your agent`) sits above the
  composition in mono, as it does today.
- Credits sit under the composition at `--step--1` in `--ink-dim`.

**Spends neither accent.** Cyan means committed, amber means revealed; a
photograph means neither. The verdict keeps its existing amber mark, which is the
only accent on the screen.

**Reduced motion**: no entrance stagger beyond the existing `land` keyframe.

## 6. Licensing — a default, not a detail

The output is meant to be shareable. Four arbitrary web images composed into a
shareable card is redistribution of other people's work.

So `get_field_manual` at portrait tier points the agent at sources whose licences
permit it — **Openverse, Wikimedia Commons, Unsplash, Pexels** — and asks for the
credit and licence with each image. Both render under the composition, and both
travel into the export.

This is a manual instruction, not a tool-enforced rule, and the distinction is
the one this repository has measured at every level: prose carries knowledge, not
authority. If a run shows the agent ignoring it, that is a finding worth
recording, not a reason to pretend the rule held.

## 7. Degradation is the feature's most important property

**An agent with no image capability makes no `illustrate_answer` calls, and the
results screen renders exactly as it does today.**

Nothing is broken, nothing is missing, no empty frames appear. A composition
renders only where four images exist; a round without them falls back to the
current text row. The two can sit in the same list.

This is not politeness. The gallery is being added days — hours — before a
deadline, on top of a submission that is currently complete. A feature that can
fail silently is acceptable; one that can break the demo is not.

## 8. Export and sharing

- `mirror.json` carries the images on each round, so a gallery reconstructs from
  the export alone.
- `portrait.md` gains the image URLs and credits as markdown links under each
  answer, so the keepsake survives outside the page.
- A share view renders one composition standalone, at a fixed aspect, for
  posting. Credits included, not optional.

## 9. Build order, and the cut line

Built **after run 2**, from run 2's exported JSON — the tool accepts attachments
to a finished game, so a completed run can be illustrated afterwards and filmed
as the video's closing shot.

    1  the tool: schema, refusals, immutability, tests      ~40m
    2  the composition CSS, against fixture URLs            ~40m
    3  the gallery on the results screen + fallback         ~30m
    4  the manual's portrait section: sources and licences  ~15m
    5  export carries images and credits                    ~20m
    --- cut line: everything below is optional ---
    6  the share view

**Cut whole if the 20:00 video gate is at risk.** The submission is complete
without this, and shipping a half-drawn gallery would cost more than not shipping
one.

## 10. What is not claimed

- Not that the images are a good read of the answer. They are what a subagent
  found for a string.
- Not that four images mean anything about the match. The verdict is still the
  human's, entered at the reveal, before any image existed.
- The gallery is decoration on a measurement, and the measurement is run 1, in
  quiz mode, where there is no gallery at all.
