# Handoff — Mirror after the sittings rebuild

**Written:** 3 September 2026, evening, at the end of the Fable design-review
session that produced `docs/MIRROR-DESIGN-REVIEW.md` and then built its
recommendation.
**For:** the next session, cold, on any model.
**State:** `feat/mirror-sittings`, 198 tests passing, clean tree, pushed.
Nothing deployed.

Same convention as every other brief here, and for the same reason: a session
that lives only in a chat window dies with the machine it was typed on.

---

## Launch prompt

Paste this to open the next session.

```
Continue Mirror on the branch feat/mirror-sittings.

READ FIRST, in this order:
  handoffs/2026-09-03_mirror-sittings-handoff.md   this file: state, traps, what is left
  docs/MIRROR-DESIGN-REVIEW.md                     the review that caused the rebuild
  playertwo/README.md                              what the game is now
  playertwo/src/games/mirror/game.js               the reducer, ~470 lines

STATE: 198 tests, zero failures — node --test 'playertwo/tests/*.test.js'
Vanilla ES modules, zero dependencies, no build step. Nothing deployed: the
live page is still served from gh-pages and is the OLD eight-round game.

THE ONE THING TO KNOW BEFORE YOU THINK. This repository's founding result is
that prose carries knowledge but not authority: the same rule delivered as text
held under preference ("12px feels better") and collapsed under insistence
("no, 12px exactly") — 25 of 25 became 0 of 25. A mechanic that works by telling
the agent to behave is a class already measured here and found soft. Mechanics
that live in the shape of the tool surface are the ones that hold.

DO NOT ROUTE AROUND THE LOAD-BEARING CLAIMS in §4 of the handoff. Argue with any
of them explicitly if you think one is wrong. Every cold session on this repo so
far has quietly deleted one on the way to a good idea.

Ask before overturning anything that looks arbitrary. Several things here are
load-bearing with prior experimental results behind them.
```

---

## 1. What happened, in one paragraph

A design review found the game thin and located the cause in the **unit of
play** rather than in the round: Mirror was a session, and a session ends.
The rebuild makes the unit a **sitting** and the document a **portrait** that
accumulates across sittings. Every consequential decision the human makes is
now a decision about *what the agent gets to see*, because that is the one
class of decision that lives in the tool surface rather than in prose. The
review is `docs/MIRROR-DESIGN-REVIEW.md`; the plan it produced is
`docs/superpowers/plans/2026-09-03-mirror-sittings.md`, executed in full.

## 2. The shape now

A **sitting** is one deck, five rounds. The agent commits first, every round.
The human responds. When the last round is judged the human **closes** the
sitting and chooses one of three grants, with no default:

| grant | what the agent carries into the next sitting |
|---|---|
| `open` | every read, response and correction |
| `kept` | only the reads the human marked good |
| `sealed` | nothing — it counts toward level, the agent reads cold again |

Closed sittings go into `doc.history`. **Level** is sittings closed plus one.
**Tier is derived from level, never stored.** One verb arrives per close:

| level | verb | what it does |
|---|---|---|
| 2 | `get_dossier` | granted history only, never the sitting in play |
| 3 | `propose_question` | agent proposes one question; a human click accepts; asked last in the next sitting |
| 4 | `get_portrait_history` | the same channel lengthwise, by question, across opened sittings |

`TOP_TIER = 4`. Beyond it level keeps counting and the body stays the same size.

**Three games, chosen separately, sharing the engine.** `perspective` (the
agent reads the human in words, a `because`, and four images; the human responds
*That's me* or *Not quite* with an optional correction), `both` (each reads the
other), `quiz` (facts, one knows and one guesses, six rounds, pass at 4).

**Images travel inside `submit_answer`.** In perspective the schema marks them
required, and the page loads each one through `ctx.loadImage` before the reducer
sees the call. A url that does not paint is refused by name. There is no second
verb to forget and no broken link can enter the document.

## 3. Where things are

    docs/MIRROR-DESIGN-REVIEW.md                     the review: verdict, core change, removals, traps
    docs/superpowers/plans/2026-09-03-mirror-sittings.md   the executed plan
    playertwo/src/games/mirror/game.js               reducer, sittings, level, proposals, projection
    playertwo/src/games/mirror/questions.js          decks per game, unlocked by level
    playertwo/src/games/mirror/tools.js              the surface, per game and tier; image verification
    playertwo/src/games/mirror/dossier.js            granted history only
    playertwo/src/games/mirror/history.js            tier 4, by question
    playertwo/src/games/mirror/render.js             start, between, round, close, transmission
    playertwo/src/ui/shell.js                        the only DOM module; loadImage lives here
    playertwo/tests/helpers.js                       open / playOut / close / afterOne / four

Storage: `p2.mirror.v2.<game>` per portrait, `p2.mirror.v2.active` naming the
game last played, `p2.mirror.v2.<game>.seen` for the transmission marker. The
old `p2.mirror.v1` key is dead and is not migrated.

## 4. Load-bearing — do not route around these

1. **The agent commits first, every round, and the page refuses the human's
   input until it has.** In both-ways and quiz this is what makes the secret
   real: at the moment the agent answers, the human's answer does not exist.
   `secrecy.test.js` asserts it on rendered output, in every mode.
2. **In perspective the ordering is not what keeps the game honest** — there is
   no second answer to protect. What keeps it honest is that **the agent gets
   no feedback until the human closes the sitting**. `get_dossier` and
   `get_portrait_history` read granted history only. Two leak tests hold this.
   Do not "helpfully" surface the current sitting's verdicts to the agent.
3. **Authority is the absence of a tool.** No verb reveals, judges, advances,
   opens a sitting, closes one, grants, or restarts. `propose_question` only
   proposes; a human click accepts. Absent, not permission-gated.
4. **No solo mode, no practice mode.** Needing a second player IS the claim.
   The landing screen explains rather than staging a scripted opponent. This
   has been proposed and refused twice.
5. **Cyan means committed, amber means revealed.** One meaning each, spent
   nowhere else. A kept read is amber because it was revealed and stayed; that
   is the same meaning, not a third one.
6. **Vanilla ES modules, zero dependencies, no build step, pure renderers.**
   State in, string out, no DOM. That purity is what lets the secrecy property
   be asserted in Node with no browser. The one thing the page can do that Node
   cannot — loading an image to see whether it paints — is *injected* as
   `ctx.loadImage`, so tests run with a stub.
7. **`wait_for_game_update` touches no state.** No log entry, no version bump.
   A wait that logged would change the version it is waiting on and wake itself
   instantly, forever. Do not tidy it into consistency with its neighbours.

## 5. What is deliberately NOT done

- **Not deployed.** The live page is `gh-pages` and still serves the old
  eight-round game. The submission branch `feat/player-two` is untouched at
  `a53d5ab`. Merging is the operator's call.
- **No backend, no share link.** Decided: on-device until ten sittings have
  actually been played. A backend breaks the "page holds no key and reaches no
  network" claim, and the only reason to break it is a share link.
- **The archived-run replay landing.** Still right, still unbuilt, and it needs
  a real recorded run to replay. Building it on a fabricated run would be the
  trap the review warns about.
- **No DESIGN gate for the new screens.** They inherit the committed tone
  (LATE NIGHT RADIO) and diverge on stance only. `MASTER.md` records this as an
  honest limit. If the portrait screen is reworked, that is the pass to run,
  with type and palette declared fixed.
- **Warren.** Still "coming soon". The review's §5 says what the spine needs
  before a second game is worth building: the ledger, the generalised grant,
  the verified-asset gate, the instrument layer, tiers as data.

## 6. Traps already paid for

- **A name is not a tool.** `reregister` used to skip any tool whose NAME was
  already registered, which was correct in v1 where schemas never changed. This
  game shapes `submit_answer` from the mode, and tools register on arrival
  before a game is picked — so the first live agent was left holding a
  submit_answer with no image slot, could not commit a read, and said so on the
  shared screen. `reregister` now compares bodies (`signatureOf`), drops and
  re-registers what changed, and unregisters what the game no longer offers.
  The shell tracks tool OBJECTS, and `surfaceKey` watches mode as well as tier,
  because picking a game moves the mode without moving the tier.

- **The floor checker reports one easing** because it reads `app.css` alone and
  the four curves live in `design-system/tokens.css`. The stylesheet meets the
  floor. Do not "fix" this by inlining curves.
- **Port 5179 was occupied** during the build, so `.claude/launch.json` has
  `autoPort: true` on the mirror entry.
- **A helper that lives in a `.test.js` file re-runs that file's tests inside
  every importer.** That is why `tests/helpers.js` exists and is not named
  `.test.js`.
- **The transmission seen-marker must be persisted**, or a reload right after a
  close replays the moment. It lives in `localStorage`, not in the document, so
  the journey export stays unpolluted.
- **A perspective sitting cannot be played by an agent with no image
  retrieval** — the schema requires four. Both ways and quiz work for such an
  agent. This is a deliberate cost, not an oversight.

## 7. The measurement moved

The pre-registration's "rounds 1–4 without the dossier, 5–8 with it" no longer
exists: the dossier opens at the first close. It becomes **sitting 1 versus
sitting 2**, same person, same agent, one variable — whether the human opened
sitting 1. The familiarity confound is unchanged and must still be stated.
`docs/MIRROR-RUNBOOK.md` carries this as an addendum. Run with
`?instrument=on` so the log, level and version are on screen.

## 8. If the next session wants a first move

In the review's ranked order, what is left and buildable:

1. **A live run of a perspective sitting** with a real agent and real images.
   Nothing after this is worth ranking until that has happened once. Everything
   built here is verified by tests and by a stub; no live agent has played it.
2. **The portrait screen's own DESIGN pass** (three directions, type and
   palette fixed).
3. **The replay landing**, once run 1 exists to replay.
4. **The spine extraction** for Warren: ledger, generalised grant, asset gate.
