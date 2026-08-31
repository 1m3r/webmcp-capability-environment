# Player Two

A platform of games in which **your agent is the second player**. The page
defines a world, hands the agent a body inside it through WebMCP tool
registration and nothing else, and the two of you play on one screen.

You install nothing. The agent arrives knowing none of the rules and with no way
to touch the game except the tools the page registers. As the team clears
stages, the page hands it new method and new verbs — capability released by
achievement, and released by your click.

The first game is **Mirror**.

## Mirror, in two modes

**Portrait.** Each round poses one question, and you answer it *about each
other* — your agent reads you, you read your agent. *What colour is this person?
Which Greek god? What are they afraid of?* Nothing has a right answer; you judge
whether your agent's read of you landed. If you would rather only be read than
do the reading, one checkbox sits you out and your agent answers alone.

**Quiz.** Real questions with real answers, and each round one of you knows
while the other guesses. *What is their favourite meal? Their favourite
programming language?* Match 5 of 8 to pass. This is the mode the measurement
runs in, because a match here is the guesser reaching an answer the other person
actually holds.

Both of you answer independently and in the dark, and the reveal sets the two
answers side by side.

## Your agent keeps playing on its own

After it commits, it calls `wait_for_game_update` and the page tells it the
moment you move. You never have to type "done" or "keep going".

That tool is **the one thing in this codebase that touches no state** — no log
entry, no version bump. Every other read logs through the reducer, and every
reduce bumps the version, so a wait that logged would change the version it is
waiting on and wake itself instantly, forever. It has four endings and all four
are tested: moved, timed out, reset, disposed.

## Secrecy is a matter of order, not of rendering

A browser-driving agent reads the DOM. Anything on screen is available to it —
that is recorded in `FROZEN.md` as a trap already paid for, and it disqualified
an earlier session from the claim it was built to support.

So "hidden until the reveal" is not a property of where the answer is drawn.

**The agent answers first, every round.** It commits through a tool that locks
the answer, with no verb to edit or retract it. At that moment your answer does
not exist yet, so there is nothing to look at. The page then refuses to let you
type until it has committed — a UI gate, and a testable one.

The secret is protected by *when* things happen. It survives a perfect observer.

## What only you can do

There is no tool to reveal a round, judge a match, advance to the next round,
open the dossier, answer on your behalf, or restart the game. Those exist as
controls in the page and nowhere else.

**Authority is the absence of a tool.** The agent can answer, speak and read. It
cannot decide, and it cannot end a round it has committed to.

## Running it

```bash
node playertwo/server.mjs
```

Then <http://localhost:5179> in a browser with WebMCP — Chrome with
`chrome://flags/#enable-webmcp-testing`, or ChatGPT desktop's built-in browser.
Say: *"let's play this."*

State lives in `localStorage` and never leaves your machine. The export is three
files you download.

```bash
node --test 'playertwo/tests/*.test.js'
```

95 tests, no dependencies. `journey.test.js` drives a stub agent through all
eight rounds headlessly — including a self-driving agent that waits for its
teammate between rounds — so the game is proven to close before any live run.

## How it is built

Vanilla ES modules. No build step, no dependencies, no framework — deliberately,
so nothing about the result is attributable to a toolchain.

    src/webmcp.js            detection, registration, re-registration on unlock
    src/registry.js          games register themselves here
    src/exporter.js          state, portrait, and the actor-tagged journey
    src/ui/shell.js          the only module that touches the DOM
    src/games/mirror/
      game.js                the round state machine and the event log
      questions.js           the bank and the recorded seed order
      dossier.js             the portrait assembled from revealed rounds
      manual.js              what each tier hands the agent
      tools.js               the tool surface, built per tier
      render.js              state -> HTML, and state -> portrait markdown

**Everything that carries a promise is pure.** The reducer, the agent
projection, the renderer and the dossier are all DOM-free functions, which is
what lets `secrecy.test.js` assert the game's central claim in Node by substring
search over the rendered output. If `render.js` ever reaches for `document`,
that promise stops being testable.

**Every mutation goes through the reducer.** A tool call and a click land in the
same place, so the page and a Node test take an identical path through the state
machine, and neither can bypass the other.

**Refusals reach the log.** A refusal that is only returned is invisible in the
run record, and the run record is the evidence.

Design decisions and the committed tone: `design-system/MASTER.md`.
Specs and the build plan: `docs/superpowers/`. Run protocol:
`docs/MIRROR-RUNBOOK.md`. What the numbers may be used for:
`docs/MIRROR-PREREGISTRATION.md`.
