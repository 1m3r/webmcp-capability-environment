# Player Two

A platform of games in which **your agent is the second player**. The page
defines a world, hands the agent a body inside it through WebMCP tool
registration and nothing else, and the two of you play on one screen.

You install nothing. The agent arrives knowing none of the rules and with no way
to touch the game except the tools the page registers. As you play, the page
hands it new verbs and new knowledge — capability released by achievement, and
released by your click.

The first game is **Mirror**.

> **Play it:** <!-- LIVE-URL --><https://1m3r.github.io/webmcp-capability-environment/><!-- /LIVE-URL -->
> You need a browser an agent can reach. Without one the page says so and
> explains itself rather than pretending to be playable — there is no solo mode,
> because needing a second player is the whole claim.

## Mirror — the game where you find out how your agent sees you

Mirror is played in **sittings**. A sitting is one deck of five questions.
Your agent answers first, every round; you respond; and when the deck is done
you **close the sitting** and decide what your agent carries out of it. The
sittings accumulate into a **portrait**, and the portrait is what your agent
reads before it answers next time. A sitting ends. The portrait does not.

Three games share the engine and are chosen separately:

**Perspective.** Your agent reads you — *What colour is this person? What
animal? What would they save from a fire?* — and commits each read with its
reasons and four images, in one call. The page loads every image before it
accepts the read, so a broken link is refused rather than discovered later.
You see the read at the centre of its four pictures and respond: **That's me**,
or **Not quite** with a one-line correction in your own words. The correction
is your real move. It costs you a true thing about yourself, and it is the only
currency that sharpens the perspective. Best with the agent you use every day.

**Both ways.** You each read the other, in the dark, and the reveal sets the
two reads side by side. Landed or missed is your call.

**Quiz.** Real questions with real answers, one of you knows and the other
guesses. Works with an agent that knows nothing about you yet. Match 4 of 6 to
pass.

### The close

Every sitting ends on one decision, and it is the most consequential in the
game:

| | what your agent carries into the next sitting |
|---|---|
| **Open it** | every read, your responses, your corrections |
| **Open the kept reads only** | the reads you said were you, and nothing else |
| **Seal it** | nothing — it counts toward your level, but your agent reads you cold again |

Your agent has seen none of your responses until this moment. Nothing from the
sitting in play ever reaches it; that is not a rule it is asked to keep, it is
the shape of the tool that hands it the dossier.

### Levels

Level is the number of sittings you have closed, plus one. Decks unlock by
level. So does your agent's body, one verb per close:

| close | verb | what it lets the agent do |
|---|---|---|
| first | `get_dossier` | read what you opened from closed sittings |
| second | `propose_question` | put one question on the table for the next sitting — you accept or decline it on the screen, and an accepted one is asked last |
| third | `get_portrait_history` | read how its reads of you moved, question by question, across everything you opened |

Each time, the status bar ticks the count up while you watch. Its body grew
because you clicked. There is no fourth verb; after that, level only counts.

## Your agent keeps playing on its own

After it commits, it calls `wait_for_game_update` and the page tells it the
moment you move — including between sittings, while you choose the next deck.
You never have to type "done" or "keep going".

That tool is **the one thing in this codebase that touches no state** — no log
entry, no version bump. Every other read logs through the reducer, and every
reduce bumps the version, so a wait that logged would change the version it is
waiting on and wake itself instantly, forever. It has four endings and all four
are tested: moved, timed out, reset, disposed.

## Secrecy is a matter of order, not of rendering

A browser-driving agent reads the DOM. Anything on screen is available to it.
So "hidden until the reveal" is not a property of where the answer is drawn.

**The agent answers first, every round.** It commits through a tool that locks
the answer, with no verb to edit or retract it. In Both ways and Quiz your
answer does not exist at that moment, so there is nothing to look at, and the
page refuses to let you type until it has committed — a UI gate, and a testable
one.

In Perspective there is no second answer to protect, and the ordering is not
what keeps the game honest. What keeps it honest is that **the agent gets no
feedback until you close the sitting**: `get_dossier` reads granted history and
never the sitting in play. Both properties are asserted in Node by substring
search over the rendered output and the dossier text.

## What only you can do

There is no tool to reveal a round, respond to one, move to the next round,
open a sitting, close one, decide what the agent keeps, or start over. Those
exist as controls in the page and nowhere else.

**Authority is the absence of a tool.** The agent can answer, speak and read.
It cannot decide, and it cannot end a round it has committed to.

## The instruments

The shared log, the level and the document version are the experiment's
instruments, not the player's game. They are off by default and come back with
`?instrument=on`, along with the only control that can delete a portrait. The
tool count stays on screen always, because it is the whole WebMCP claim in two
words.

## Running it

```bash
node playertwo/server.mjs
```

Then <http://localhost:5179> in a browser with WebMCP — Chrome with
`chrome://flags/#enable-webmcp-testing`, or ChatGPT desktop's built-in browser.
Say: *"let's play this."*

State lives in `localStorage`, one portrait per game, and never leaves your
machine. The export is three files you download.

```bash
node --test 'playertwo/tests/*.test.js'
```

No dependencies. `journey.test.js` drives a stub agent through two sittings
headlessly — its body growing at the first close, the dossier carrying what was
opened and nothing from the sitting in play — so the game is proven to close
before any live run.

## How it is built

Vanilla ES modules. No build step, no dependencies, no framework — deliberately,
so nothing about the result is attributable to a toolchain.

    src/webmcp.js            detection, registration, re-registration on unlock
    src/registry.js          games register themselves here
    src/exporter.js          state, portrait, and the actor-tagged journey
    src/waiters.js           the wait registry behind wait_for_game_update
    src/ui/shell.js          the only module that touches the DOM
    src/games/mirror/
      game.js                the reducer: rounds, sittings, the close, the level
      questions.js           the decks, per game, unlocked by level
      dossier.js             what the agent may read: granted history only
      history.js             the same channel lengthwise, by question, at tier 4
      manual.js              what each tier hands the agent
      tools.js               the tool surface, per game and tier
      render.js              state -> HTML, and state -> portrait markdown
      landing.js             what a visitor with no agent sees instead

**Everything that carries a promise is pure.** The reducer, the agent
projection, the renderer and the dossier are all DOM-free functions, which is
what lets `secrecy.test.js` and `dossier.test.js` assert the game's central
claims in Node by substring search. The one thing the page does that Node
cannot — loading an image to see whether it paints — is injected into the tool
surface by the shell, so the tests run with a stub and the page runs with a
real `Image`.

**Every mutation goes through the reducer.** A tool call and a click land in the
same place, so the page and a Node test take an identical path through the state
machine, and neither can bypass the other.

**Refusals reach the log.** A refusal that is only returned is invisible in the
run record, and the run record is the evidence.

Design decisions and the committed tone: `design-system/MASTER.md`. The
design review that produced the sittings: `docs/MIRROR-DESIGN-REVIEW.md`. Specs
and the build plans: `docs/superpowers/`. Run protocol: `docs/MIRROR-RUNBOOK.md`.
