# Mirror — sittings and the persistent portrait: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Mirror from one eight-round document into a portrait that accumulates sittings, with images arriving at commit time, verified at the tool boundary, and the human's consequential decisions all being decisions about what the agent gets to see.

**Architecture:** The reducer keeps its shape (`doc.rounds[doc.roundIndex]` is the sitting in play) and gains `doc.history` (closed sittings, each with its grant) and `doc.level`. Three modes are three games sharing the engine: `perspective` (agent reads the human, images at commit, human responds *That's me / Not quite* with an optional correction), `both` (each reads the other, text), `quiz` (facts, one knows one guesses). `get_dossier` reads only *granted* history and never the sitting in play. Tier is derived from level. Everything stays pure, DOM-free, and asserted in Node.

**Tech Stack:** Vanilla ES modules, zero dependencies, `node --test`. Branch `feat/mirror-sittings` off `feat/player-two`.

Source: `docs/MIRROR-DESIGN-REVIEW.md` §2–§4.

## Global Constraints

- The agent commits first, every round; the human's input is refused until it has. Unchanged.
- No tool reveals, judges, advances, opens a sitting, closes one, grants, or restarts. Absent, not refusing.
- No solo mode. The start screen offers three games and needs an agent for all of them.
- `--signal` (cyan) = committed, `--reveal` (amber) = revealed, nowhere else. New screens spend neither.
- Vanilla ES modules, zero dependencies, no build step. Renderers are pure `state -> string`.
- `wait_for_game_update` touches no state. Do not "tidy" it.
- Refusals name a cause, never a state, and every refusal reaches the log.
- New storage key. Old saved games are not migrated; they die.
- Deploy nothing to Pages from this branch tonight. `feat/player-two` is the submission.

## File structure

| file | responsibility after this plan |
|---|---|
| `src/games/mirror/questions.js` | decks per mode, `decksFor`, `deckById`, `roundPlan(mode, deckId)`, `QUIZ_PASS` |
| `src/games/mirror/game.js` | reducer, `createDoc(now, {mode})`, `inSitting`, `isComplete`, `tierFor`, `justGranted`, `projectForAgent`, verdict vocab, image normalisation |
| `src/games/mirror/tools.js` | six verbs; `submit_answer` carries `because` + `images` in perspective and verifies each image through `ctx.loadImage` before the reducer sees it |
| `src/games/mirror/dossier.js` | `buildDossier(doc)` over granted history only |
| `src/games/mirror/manual.js` | CORE + PERSPECTIVE / BOTH / QUIZ + TIER_2 + NO_MODE |
| `src/games/mirror/render.js` | `renderStart`, `renderBetween` (the portrait screen + deck picker), `renderRound`, `renderClose`, `renderGranted`, `renderGame`, `renderPortrait` (markdown) |
| `src/games/mirror/landing.js` | copy updated to six verbs / sittings |
| `src/games/mirror/index.js` | game descriptor: per-mode storage keys |
| `src/ui/shell.js` | per-mode load/save, `loadImage`, auto-reveal in perspective, click handlers, instrument flag |
| `index.html`, `app.css` | panel without the checkbox; instrument layer; new screens' styles |
| tests | `game`, `sittings`, `perspective`, `images`, `controls`, `journey`, `secrecy`, `tools`, `dossier`, `exporter`, `landing`, `arrival` |

Deleted: `tests/watching.test.js`, `tests/illustrate.test.js`, `tests/grant.test.js` (replaced by `perspective`, `images`, `sittings`).

---

### Task 1: Decks

**Files:** Modify `src/games/mirror/questions.js`. Test `tests/game.test.js` (deck section).

**Produces:**
```js
export const DECKS = { perspective: [...], both: [...], quiz: [...] };
export function decksFor(mode)              // -> deck[]
export function deckById(mode, id)          // -> deck | null
export function deckUnlocked(deck, level)   // -> deck.level <= level
export function roundPlan(mode, deckId)     // -> round seeds [{ questionId, question, agentTarget, humanTarget }]
export const QUIZ_PASS = 4;                 // of 6
```
Deck shape: `{ id, title, level, questions: [{ id, text, target? }] }`. Perspective decks are illustrable (things, places, weather, creatures); verbal questions live in `both`. Every perspective deck carries one uncomfortable question. Quiz questions carry `target: 'human' | 'agent'` and alternate human-first.

- [ ] Write failing tests: `decksFor('perspective')` has ≥3 decks with 5 questions each; `deckUnlocked` respects level; `roundPlan('perspective','first-light')` gives 5 rounds with `agentTarget:'human', humanTarget:null`; `roundPlan('both', …)` gives `human`/`agent`; `roundPlan('quiz','daily')` alternates and both targets equal; unknown deck throws.
- [ ] Implement. Run `node --test tests/game.test.js`.
- [ ] Commit `feat(mirror): decks per mode, five rounds, level-gated`.

### Task 2: The reducer — sittings, level, verdicts, images at commit

**Files:** Modify `src/games/mirror/game.js`. Tests `tests/game.test.js`, `tests/sittings.test.js` (new), `tests/perspective.test.js` (new), `tests/images.test.js` (new).

**Produces:**
```js
export const MODES = ['perspective', 'both', 'quiz'];
export const VERDICTS = { perspective: ['me', 'not'], both: ['landed', 'missed'], quiz: ['match', 'miss'] };
export const VERDICT_LABELS = { me: "That's me", not: 'Not quite', landed: 'Landed', missed: 'Missed', match: 'Match', miss: 'Miss' };
export const GRANTS = ['open', 'kept', 'sealed'];
export function createDoc(now = 0, { mode = 'perspective' } = {})
  // -> { version:1, gameId:'mirror', schema:2, mode, level:1, history:[], deckId:null, rounds:[], roundIndex:0, log:[], startedAt }
export function inSitting(doc)      // rounds.length > 0
export function isComplete(doc)     // inSitting && every judged
export function tierFor(doc)        // level >= 2 ? 2 : 1
export function isPerspective(doc)  // mode === 'perspective'
export function readyToReveal(doc, round)
export function justGranted(doc)    // last log entry is close_sitting/ok and doc.level === 2
export function toolNamesFor(mode, tier)   // CORE_TOOLS (+ get_dossier at tier 2)
export function normaliseImage(raw), COMPOSITION_SIZE = 4
export function reduce(doc, action, now)
```
Actions:

| type | actor | accepts | refuses (code) |
|---|---|---|---|
| `open_sitting {deckId}` | human | between sittings, deck known and unlocked → rounds from `roundPlan`, `deckId` set | `SITTING_OPEN`, `BAD_DECK`, `DECK_LOCKED` |
| `agent_submit {text, because?, images?, rejected?}` | agent | posed; perspective: exactly 4 normalised images and `rejected` empty | `EMPTY_ANSWER`, `ALREADY_COMMITTED`, `NO_SITTING`, `BAD_IMAGES` (names rejected urls / count) |
| `human_submit {text}` | human | agent_committed, not perspective | `NO_SECOND_ANSWER` (perspective), `AGENT_HAS_NOT_ANSWERED`, `ALREADY_COMMITTED`, `EMPTY_ANSWER`, `NO_SITTING` |
| `reveal` | human | both_committed, or agent_committed in perspective | `NOT_BOTH_COMMITTED` |
| `judge {verdict, correction?}` | human | revealed, verdict in mode vocab; correction trimmed and stored | `NOT_REVEALED`, `BAD_VERDICT` |
| `next` | human | judged, not last | `NOT_JUDGED`, `GAME_OVER` ("close the sitting") |
| `close_sitting {grant}` | human | complete, grant in GRANTS → push `{ n, deckId, title, mode, rounds, grant, closedAt }` to history, level+1, rounds=[] | `NOT_FINISHED`, `BAD_GRANT` |
| `abandon_sitting` | human | in sitting → rounds=[], deckId=null | `NO_SITTING` |
| `say`, `read` | agent | as before | |

Round shape: `{ questionId, question, agentTarget, humanTarget, state, agentAnswer, agentBecause, agentImages, humanAnswer, verdict, correction }`.

Projection (`projectForAgent`): between sittings → `{ version, mode, level, sittingsClosed, state:'between_sittings', yourMove }`. In a sitting: as before plus `level`, `sitting: n`, no `answersAwaitingImages`; before the reveal carries neither answer, no `because`, no image url.

- [ ] Write failing tests in the four files (see test list below).
- [ ] Implement; delete `illustrate`, `grant_tier`, `set_answer_about_agent`, `isExcused`, `isWatching`, `canGrant`, `atGrantMoment`, `unillustrated`, `imagesFor`, `DOSSIER_ROUND`.
- [ ] Run `node --test tests/game.test.js tests/sittings.test.js tests/perspective.test.js tests/images.test.js`.
- [ ] Commit `feat(mirror): sittings, level, perspective verdicts, images at commit`.

### Task 3: Tools — six verbs, image verification at the boundary

**Files:** Modify `src/games/mirror/tools.js`. Tests `tests/tools.test.js`, `tests/images.test.js`, `tests/arrival.test.js`.

**Consumes:** `reduce`, `projectForAgent`, `tierFor`, `toolNamesFor`, `normaliseImage`, `COMPOSITION_SIZE`, `buildDossier`, `manualFor`.
**Produces:** `buildTools(ctx)` where `ctx.loadImage?: (url) => Promise<boolean>` (absent → every image passes, so Node tests stay DOM-free).

`submit_answer` schema per mode: perspective `{ text, because, images[4] }` with `required: ['text','images']`; both `{ text, because }`; quiz `{ text }`. Execute: unwrap → normalise images → if 4, `await Promise.all(load)` → `rejected` = urls that failed → `apply({ type:'agent_submit', text, because, images, rejected })`. The reducer refuses and logs.

- [ ] Tests: surface is 5 verbs at tier 1 and 6 at tier 2 for every mode; no forbidden verb; a failing `loadImage` produces a refusal naming the url, logged with actor agent; a passing one commits with 4 images; `get_field_manual` reflects `tierFor`.
- [ ] Implement. Run the three test files.
- [ ] Commit `feat(mirror): images travel with the answer and are verified at the boundary`.

### Task 4: Dossier and manual

**Files:** Modify `src/games/mirror/dossier.js`, `src/games/mirror/manual.js`. Tests `tests/dossier.test.js`.

`buildDossier(doc)`: header, then per closed sitting: sealed → one line, kept → rounds with the good verdict only, open → every round with verdict and correction. Footer: "The sitting in play is not here and will not be until your teammate closes it." Never reads `doc.rounds`.

- [ ] Tests: sealed sitting contributes no answer text; kept sitting carries only `me`/`landed`/`match` rounds; open sitting carries corrections; THE LEAK TEST: the sitting in play never appears, revealed or not; manual tier 1 never says `get_dossier`; perspective manual names `images`, `because`, corrections, and the three grants.
- [ ] Implement. Commit `feat(mirror): dossier reads granted sittings only`.

### Task 5: Renderers

**Files:** Modify `src/games/mirror/render.js`, `src/games/mirror/landing.js`. Tests `tests/secrecy.test.js`, `tests/controls.test.js`, `tests/perspective.test.js`, `tests/landing.test.js`, `tests/exporter.test.js`.

- `renderStart({ entry, tools })`: three `<button data-game="…">`. No checkbox.
- `renderBetween(doc)`: "Level N · M sittings" · history newest first (perspective: compositions with the answer at the centre; both/quiz: rows) with the grant label · deck picker `<button data-action="open_sitting" data-deck="id">` (locked decks rendered `disabled` with "level N") · `<button data-action="export">`.
- `renderRound(doc)`: perspective draws one card; at reveal the card shows the composition, the answer, `because`; controls are the two verdict buttons plus `<input id="correction">` (perspective only); Next after judged. Both/quiz unchanged in shape.
- `renderClose(doc)`: every round, then three `<button data-action="close_sitting" data-grant="open|kept|sealed">` each with one sentence on what the agent will carry.
- `renderGranted(doc)`: unchanged but copy says "your first sitting is closed".
- `renderGame(doc, { transmissionSeen })`: transmission → between → close → round.
- `renderPortrait(doc)`: markdown over history + current.
- Landing: "Five verbs on arrival. A sixth arrives when you close your first sitting."

- [ ] Tests: secrecy for every pre-reveal state in every mode, including no `<img` and no `because` text before the reveal; controls round-trip for all three modes across a whole sitting, the close screen and the between screen (`PAGE_ONLY = export, dismiss, games`); the between screen offers only unlocked decks as enabled controls; the transmission fires after the first close and not the second.
- [ ] Implement. Commit `feat(mirror): the portrait screen, the close, the perspective reveal`.

### Task 6: Journey

**Files:** Rewrite `tests/journey.test.js`.

- [ ] A stub agent plays sitting 1 (5 rounds, images through `submit_answer`), the human closes it `open`, `get_dossier` appears, sitting 2 opens from a level-2 deck, the agent reads the dossier and it contains sitting 1's corrections and none of sitting 2's rounds. A second run closes `sealed` and the dossier carries no answer from it. The quiz journey passes at `QUIZ_PASS`. The restart-while-waiting test stays.
- [ ] Commit `test(mirror): the journey crosses a sitting boundary`.

### Task 7: Shell, page, stylesheet

**Files:** Modify `src/ui/shell.js`, `src/games/mirror/index.js`, `index.html`, `app.css`.

- Storage: `p2.mirror.v2.<mode>` per game and `p2.mirror.active` naming the mode last played. `load()` reads active. `data-game` click loads or creates. Panel gets **Other games** (clears active, `doc = null`), **Abandon sitting** (reducer), **Export**. The checkbox and the grant button go.
- `ctx.loadImage` with an 8 s timeout and `referrerPolicy = 'no-referrer'`, matching the render.
- `settlePerspective()` auto-reveals on commit in perspective (was `settleWatch`). No auto-advance: the human has a move every round now.
- `judge` click reads `#correction`. `open_sitting` and `close_sitting` clicks pass their data attributes.
- `syncTools()` when `tierFor` changes across `setDoc`.
- Instrument: `?instrument=on` sets `body[data-instrument="on"]`; CSS hides `.log`, `#s-tier`, `#s-version` otherwise.
- CSS: `.round--perspective .card` full width with the composition inside; `.response` row (input + two buttons); `.close__grants`; `.portrait__sitting`, `.decks`, `.deck[disabled]`; the instrument rules. No new hue.

- [ ] Run the full suite. Run `node playertwo/server.mjs` and walk `?play=1`: start → three games; perspective → deck picker; the between screen with no history. Screenshot.
- [ ] Commit `feat(mirror): shell for sittings, instrument layer, perspective reveal`.

### Task 8: Docs

- [ ] `playertwo/README.md` rewritten around sittings and the three games; `docs/MIRROR-RUNBOOK.md` gets a note that the measurement moved to sitting 1 vs sitting 2; project `CLAUDE.md` log line.
- [ ] Commit `docs: sittings`.

## Test inventory (names, so the suite reads as the spec)

- **game**: doc shape; deck plan; posed→committed→revealed→judged→next; refusals name causes; `next` on the last round says "close the sitting".
- **sittings**: `open_sitting` refused mid-sitting / bad deck / locked deck; `close_sitting` refused unfinished / bad grant; closing archives rounds with the grant, bumps level, empties rounds; `tierFor` flips at level 2 and stays; `justGranted` true only on the first close; `abandon_sitting` keeps history; projection between sittings names the wait.
- **perspective**: no human input rendered or accepted; reveal from `agent_committed`; verdicts `me`/`not`; correction stored and rendered only after judging; single card; composition inside the card after the reveal and never before.
- **images**: `normaliseImage`; reducer refuses 0–3 and >4, refuses any `rejected` naming the url, accepts 4; both/quiz ignore images; tool verification path with a stub `loadImage` (pass, fail, mixed); refusal logged with actor agent.
- **secrecy**: as today, over three modes, plus `because` and image urls before the reveal, plus the dossier never carrying the sitting in play.
- **controls**: every drawn control is a legal move or a declared page control, across three modes, round → close → between.
- **tools**: five verbs then six; forbidden verbs absent; wait tool untouched (busy-loop test kept).
- **dossier**: sealed / kept / open; leak test; manual per tier and mode.
- **journey**: above.
- **arrival**, **exporter**, **landing**, **webmcp**, **waiters**, **registry**: adapted.
