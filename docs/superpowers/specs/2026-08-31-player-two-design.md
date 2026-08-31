# Player Two — design

    Owner:   1m3r / DGOS
    Date:    31 August 2026
    Status:  approved in brainstorming, not yet planned
    Branch:  feat/player-two
    Context: docs/WEBMCP_MASTER_CONTEXT_v3.md, FROZEN.md

---

## 1. What this is

A platform of games in which **your agent is the second player**. The page
defines a world, hands the agent a body inside it through WebMCP tool
registration and nothing else, and the two of you play on one screen.

The user installs nothing. The agent arrives with no knowledge of the world and
no way to touch it except the tools the page registers. As the team clears
levels, the page hands the agent new verbs and new method — capability released
by achievement, and released by a human's click.

The platform ships with one game, **Warren**: two avatars, one dungeon.

## 2. Why this domain

Against the §7.4 filter of the master context, all four clauses hold, and the
fourth holds *harder* than in any previous build here:

| Clause | Status |
|---|---|
| The method is not in the model | Two-body coordination protocols — hold-and-pass, the counterweight, hand-off across a gap. A model asked to solve a co-op dungeon does not produce these; it plans for one body and stalls. |
| The check is verifiable | Total. The world knows. Cleared or not cleared is a predicate over tile occupancy, with no judgement in it. |
| The state is expensive to carry | Level state, both bodies' positions, carried items, cleared levels, unlocked tier. A fresh chat reconstructs none of it. |
| Human judgment is load-bearing | The human is not an approver. **The human is a player, and the level cannot be cleared without them.** |

The fourth row is the reason for this project. Every prior build in this
repository made the human an authority who confirms; this one makes the human a
body that is needed. Governance stops being a lecture and becomes a floor plan.

## 3. The central design decision

**The asymmetry is structural, never informational.**

`FROZEN.md` records the trap already paid for: *"A panel that displays derived
values leaks them. A browser-driving agent reads the DOM. Anything on screen is
available to it."* That contamination disqualified the GATE-1 session from the
claim it was built to support.

A fog-of-war game in which the human's advantage is *seeing the map* would repeat
that mistake exactly, and the claim would rest on the agent choosing not to look.

So the agent is not blind. `look()` returns everything the human can see. The
dungeon does reveal itself as it is explored, but **symmetrically** — the agent
is never shown less than the human (§4). No claim rests on hiding anything.

What the agent cannot do is **be in two places**. A gate that stays open only
while weight rests on a plate cannot be passed by one body, and no amount of
screen-reading changes that. The asymmetry survives a perfect observer.

## 4. The world, and why there is no clock

Continuous, no clock, no reflex, no timing. An agent's move lands seconds after
it decides; any puzzle that requires two things to happen at the same *instant*
is unplayable with a partner on tool-call latency.

**Hold state is a pure function of occupancy.** A plate is pressed while a body
or a crate rests on it. A gate is open while its plate is pressed. Nothing is
scheduled, nothing decays, there are no timers and no events — the derived state
is recomputed from positions every time positions change.

This one decision removes the entire class of latency bugs, and it is why the
human can keep moving while the agent thinks. The screen is never frozen waiting
for a tool call.

### Tiles and entities

    floor  wall  gap  gate  plate  rune  door
    bodies: human, agent          entities: crate, key

- Bodies occupy one tile, may not share a tile, may not enter `wall` or a closed
  `gate`.
- `plate` is pressed while occupied by a body or a crate. Each `gate` names the
  plate that opens it.
- `rune` is an exit tile. **A level is cleared while both runes are occupied at
  once** — a hold, not an instant.
- `gap` may not be entered by a body and does not stop a thrown item. It is the
  only tile that separates the party without a mechanism.
- `door` is locked and opens only when the key is turned, which only the human
  can do (§6).
- A body carries at most one item. `throw` sends it in a straight line along
  `dx, dy`: if a body with a free hand stands in the path, that body catches it;
  otherwise it lands on the last `floor` tile it reached before an obstruction.
- **Sight is symmetric.** A tile becomes `seen` once either body has stood
  adjacent to it, and both `look()` and the rendered board show `seen` tiles
  only. Neither party knows more than the other at any moment — this is dungeon
  atmosphere, not an advantage, and §3 is why.

### Levels

Four levels, an arc that teaches by unlocking. Levels are ASCII maps, so the
tests read like the game looks.

Each level is played **with** the verb in its last column: clearing a level lets
the human confirm the descent, and that confirmation is what grants the next
level's verb before it is entered.

| | level | teaches | granted on entering |
|---|---|---|---|
| 1 | The Two Plates | one holds, the other passes, then a second plate reverses it | — |
| 2 | The Counterweight | a crate can hold a plate so no body has to | `push` |
| 3 | The Chasm | the party is split; the key must be handed across a gap | `take`, `throw` |
| 4 | The Vault | all three, and a door only a human hand turns | — |

## 5. The tool surface

Registered per unlock tier. A locked verb is **absent from the surface**, not
present and refusing — the agent should see its own capability grow.

**Tier 1**

    look()                 -> the seen board, both bodies, derived hold state
    move({ dx, dy })       -> one step, or a refusal naming the cause
    say({ text })          -> posts to the shared screen's log
    get_field_manual()     -> the method for the current tier

**Tier 2** adds `push({ dx, dy })` · **Tier 3** adds `take()` and `throw({ dx, dy })`

`say()` exists because the human's eyes are on the page, not on the chat
transcript, while playing. Agent speech belongs on the shared screen.

`get_field_manual()` is the direct descendant of `get_house_rules` (Level 0) and
`get_phase_guide` (Keel). It returns the named coordination patterns for the
current tier, and **whether the agent calls it unprompted is the measurement**
this project exists to take.

### Refusals name the cause, never the symptom

    blocked: gate G1 is closed — plate P1 is unpressed

Not `blocked: wall`. GATE-1's third defect was a refusal the agent could not act
on, and `docs/KEEL-RUNBOOK.md` lists reintroducing it as a failure condition.

### No optimistic concurrency, deliberately

Keel enforced `expectedVersion` on every write. Player Two does not, and the
reason is the design rather than laziness: in a co-op world the partner moves
freely and constantly, so every agent write would be stale by construction and
the game would be unplayable.

`move` is therefore **relative** — `dx, dy` from wherever the agent's body
actually is — and always resolves against current state. The world cannot be
corrupted by a stale write because no write carries an absolute position.

## 6. Authority — the absence of a tool

There is **no tool** to:

- move the human's body
- turn the key in the vault door
- descend to the next level, or restart one
- unlock a tier, or reset progress

These exist only as controls in the page. Ported unchanged from the probe and
Keel, and it produces the sentence that best describes the whole platform:

> The page gives the agent new capability, and the human's click is what
> releases it.

On unlock the tool surface is re-registered via `provideContext()`, so **the
agent's tool list visibly grows mid-session**. That is the most vivid WebMCP
moment available anywhere in this repository, and it should be on camera.

## 7. Architecture

`playertwo/`, branched from `probe/frozen-2026-08-31` — **not** from
`feat/keel`, so this project carries no Keel code and Keel is untouched. Own
server, own port, 5179. `public/` and `keel/` are never modified.

Vanilla ES modules. Zero dependencies, no build step, no framework — same
discipline and the same reason: nothing about the result should be attributable
to a toolchain.

    src/world.js     pure rules: tiles, bodies, holds, win. state + action -> state
    src/levels.js    the four levels as ASCII maps
    src/tools.js     the surface, built per tier. No DOM.
    src/manual.js    what each tier hands the agent
    src/progress.js  cleared levels and unlocked tier
    src/webmcp.js    entry-point detection and registration
    src/ui/          the only place that touches the DOM

**Games are data.** The spine — world engine, renderer, tool swap, event log,
progress — renders any game that supplies levels, tiles and verbs. Keel's
"phases are data" is what made seven phases affordable; this is the same move,
and it is what makes "a platform hosting many games" true rather than
aspirational.

Every logic module is an ES module that imports cleanly in Node with no DOM
access at the top level, so the whole engine is unit-tested without a browser.

**Rendering** is a DOM grid, not canvas: it inspects easily, styles with CSS, and
a 20×14 board is 280 nodes.

**Persistence** is `localStorage` — cleared levels, unlocked tier, current level.
Body positions are *not* persisted; a reload restarts the level. Levels are
short, and a state-restore bug on camera costs more than a replayed level.

**Design.** The DGOS design gate applies before any UI is built: one committed
tone, three directions diverging on type AND palette AND grid, OKLCH tokens.

## 8. Testing

- `world.test.js` — movement, blocking, hold state recomputed from occupancy,
  crate pushing, throw arcs, the win predicate.
- `tools.test.js` — a locked verb is absent from the surface; refusals name the
  cause; every action reaches the event log with its actor.
- `levels.test.js` — two assertions per level: a known solution script **clears**
  it, and a bounded search over single-body action sequences finds **no**
  solution. The second is the thesis of the whole project, asserted as a test.
- `journey.test.js` — a stub agent clears all four levels headlessly, with tiers
  unlocking as it goes.
- `webmcp.test.js` — detection at both entry points, registration, and
  re-registration when a tier unlocks.

`journey.test.js` is not optional. The Keel plan states the reason in a sentence
worth not learning twice: *a journey that has never closed end to end is not a
demo, it is a hope.*

## 9. Cut order, if time runs short

1. **Cut nothing.** Levels 1–2 plus the engine and the stub agent are the claim.
2. Cut level 4 (The Vault) — it combines rather than teaches.
3. Cut symmetric sight (§4) — the board simply renders whole. It is atmosphere,
   nothing rests on it, and it is one predicate and one test to remove.
4. Cut level 3 (The Chasm) — it costs two verbs and the item system.
5. **Never cut** level 1, level 2, or `journey.test.js`. Level 2 is the first
   level whose solution the agent cannot reach without being taught, so it is
   where the manual earns its place.

## 10. What is not claimed

- **Not claimed that the agent cannot see the screen.** It can. The design does
  not depend on it not looking.
- Nothing about models other than the one tested, or games other than this one.
- The human may simply tell the agent the solution. This measures **collaboration
  under a tool boundary**, not autonomous puzzle-solving. A run where the human
  narrates every move is a valid session and an invalid measurement, and the run
  protocol must say so.
- One recorded run is n=1, exactly as Level 1 was.

## 11. Known risks

- **Latency makes watching slow.** Mitigated by `say()` and the live log, so the
  screen is doing something while the agent thinks. Not eliminated.
- **The single-body search may be expensive** on level 4. The bound is stated in
  the test and the assertion is "no solution within N moves", never "unsolvable".
- **Mid-session re-registration** may differ across clients. The detection layer
  handles `provideContext` and per-tool `registerTool` separately, as the probe's
  does; a client offering neither is reported in the status bar before a run
  begins.
