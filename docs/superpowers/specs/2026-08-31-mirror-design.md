# Mirror — design

    Owner:   1m3r / DGOS
    Date:    31 August 2026
    Status:  approved in brainstorming, not yet planned
    Branch:  feat/player-two
    Game:    the first game on the Player Two platform
    Context: docs/superpowers/specs/2026-08-31-player-two-design.md

---

## 1. What this is

A game for a human and their agent, played on one screen. Each round poses one
question about a **subject**, and the subject alternates — this round you, next
round your agent.

> What colour is this person? Which Greek god? What are they afraid of?

Both answer independently and in the dark. The reveal puts the two answers side
by side. When they match, your agent understood you. When they do not, the gap
is the entertainment.

It is the first game on the platform because it is the smallest thing that
exercises the whole architecture: tools as the agent's only contact with the
world, a human holding actions no tool can reach, a shared screen, and knowledge
granted by progression.

## 2. The central design decision

**Secrecy rests on causality, not on rendering.**

`FROZEN.md` records the trap: *"A browser-driving agent reads the DOM. Anything
on screen is available to it."* A game whose premise is "answers stay hidden"
is that trap's natural home — the human types into an input, the value lives in
the page, and the agent is reading the page.

Only one player at this table has both the means and the reflex to look. So:

**The agent answers first, every round.** It commits through a tool that locks
the answer, with no verb to edit or retract it. At that moment the human's answer
does not exist. There is nothing to peek at.

**The page then enforces the order.** The human's input is disabled until the
agent has committed. This is a UI gate, not a tool, and it is a testable
predicate: the human may answer only while the round is in `agent_committed`.

The result is a commit–reveal scheme in which the secret is protected by *when*
things happen rather than by where they are drawn. It survives a perfect
observer, which is the standard §3 of the platform spec sets.

## 3. The round

A round is a five-state machine. Every transition is either a tool call by the
agent or a click by the human, and no transition has both.

| state | who moves | how |
|---|---|---|
| `posed` | agent | `submit_answer({ text })` |
| `agent_committed` | human | types and submits — the input is enabled only here |
| `both_committed` | human | **Reveal** |
| `revealed` | human | **Match** or **Miss** |
| `judged` | human | **Next round** |

- `submit_answer` is refused in any state but `posed`, and the refusal names the
  cause: *"refused: you have already committed this round."* Never
  `refused: invalid state`. That was GATE-1's third defect.
- A committed answer is immutable. There is no tool that edits or withdraws one.
- `get_round()` returns the question, the subject, and **whether** each party has
  answered. It returns neither party's text before `revealed`.

**Eight rounds**, four about each subject, drawn from a fixed bank in a recorded
seed order — the same convention as the Level 2 battery.

## 4. The tool surface

**Tier 1**

    get_round()            -> index, question, subject, who has answered, state
    submit_answer({ text }) -> commits, locks, or refuses with a cause
    say({ text })          -> posts to the shared screen's log
    get_field_manual()     -> how to play well at this tier

**Tier 2**, granted after round 4 by the human's click

    get_dossier()          -> the portrait the page has assembled so far

`say()` exists because the human's eyes are on the page, not on the chat
transcript. `get_field_manual()` is the descendant of `get_house_rules` and
`get_phase_guide`; whether the agent calls it unprompted is the measurement this
repository has taken at every level.

### What no tool can do

Reveal a round. Judge a match. Advance to the next round. Answer for the human.
Grant a tier. Reset the game.

Those are page controls. Here the property is load-bearing rather than
ceremonial: **the agent physically cannot end a round it has committed to.**

## 5. The measurement

The dossier unlocks after round 4. Rounds 1–4 are played without it, rounds 5–8
with it.

**Pre-register: does the agent's match rate rise once the page hands it the
dossier?** Same subject, same person, same question bank, one variable.

This is capability transfer measured inside a game, and it is the literal form
of the thing this platform is for — a team that improves by playing because the
environment remembers for them.

Honest limits, stated before the run: n=1, one model, one human, eight rounds.
Rounds 5–8 are also *later*, so familiarity is confounded with the dossier and
cannot be separated at this sample size. The result is a signal, never a finding.
This must be in the run sheet before the run, not after it.

## 6. Architecture

Lives in `playertwo/src/games/mirror/`, on the platform spine described in the
Player Two spec. Vanilla ES modules, zero dependencies, no build step.

    game.js        the round state machine. Pure: state + action -> state
    questions.js   the bank, and the seed order
    dossier.js     builds the portrait from answer history
    manual.js      what each tier hands the agent
    tools.js       the surface, built per tier. No DOM.
    render.js      pure: state -> HTML string

**Renderers are pure functions from state to a string.** This is a design
constraint, not a preference: it is what lets §7's secrecy test run in Node with
no browser.

**Persistence.** `localStorage`, and unlike Warren the state *is* the artifact,
so everything persists — rounds, answers, judgments, the event log. A reload
resumes the game.

**Export.** Three files, matching the `runs/` convention: the JSON state, a
readable `portrait.md` with both columns side by side, and the event journey with
every action tagged by actor. The portrait is a keepsake, which is the point.

## 7. Testing

- `round.test.js` — the state machine. Out-of-order submits refused, commits
  immutable, transitions exhaustive.
- **`secrecy.test.js`** — for every state before `revealed`, neither the payload
  of `get_round()` nor the output of `render()` contains either answer's text.
  Asserted by substring search over the serialised output. This is the premise of
  the game asserted as a test, and it is the analogue of Warren's
  "no level is solvable by one body".
- `tools.test.js` — tier gating: a locked verb is absent from the surface, not
  present and refusing. Refusals name causes. Every action reaches the log with
  its actor.
- `dossier.test.js` — the dossier is built from history and is unreachable at
  tier 1.
- `journey.test.js` — a stub agent plays all eight rounds headlessly, the tier
  unlocking at four.
- `webmcp.test.js` — detection at both entry points, registration, and
  re-registration when the tier unlocks.

## 8. Cut order, if time runs short

1. **Cut nothing.** Eight rounds, the dossier and the export are the claim.
2. Cut the export's `portrait.md`, keeping the JSON. The keepsake is the warmest
   part and the least load-bearing.
3. Cut the subject alternation — every round is about the human. Halves the
   dossier and the question phrasing work.
4. **Never cut** the commit ordering, `secrecy.test.js`, or `journey.test.js`.
   Without the first two there is no game; without the third there is no demo.

## 9. What is not claimed

- Not that the agent cannot read the screen. It can. The design does not depend
  on it choosing not to.
- Not that a matched answer means the agent understands anyone. It means two
  strings were judged alike by one human on one afternoon.
- The dossier result is confounded with round order (§5) and is a signal only.
- Nothing about models other than the one tested.
