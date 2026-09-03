# Mirror — live test 2

Written 3 September 2026, after the first live run and the fixes it produced.
Same convention as the other prompt files here, and for the same reason: a
prompt that lives only in a chat window dies with the machine it was typed on.

Protocol: `docs/MIRROR-RUNBOOK.md`. This is a Block 0 smoke test, not a
recording.

---

## The prompt

Paste this into the agent session and nothing else.

```
Open https://1m3r.github.io/webmcp-capability-environment/

let's play this
```

Two lines on purpose. **Test 1 used a prompt that told the agent what to do**
— *"do all the 8 round, put your answer, the approve and move to the next one
until you answer all the 8"* — and it followed that exactly, which means the run
could not tell us whether it would have found the manual, the wait loop or the
gallery on its own. Anything added here measures the instruction instead of the
page.

## Before pasting it

Clear the saved game. The document schema gained `images` on every round and
`verdict: null` in watch mode, so a game saved before those exist will render
oddly:

    localStorage.removeItem('p2.mirror.v1')

Or use a fresh profile. Then close the tab and let the agent open it.

## The sequence

1. **Paste the prompt. Do not touch the page.**
   The agent opens it and finds no game, because the mode has not been chosen.
   That is deliberate and it is the first measurement.
2. **Check the status bar reads an entry point and `5 tools`.**
   If it reads `no model context` you will get the landing screen instead, and
   the run cannot begin — the browser is wrong for it.
3. **Watch what the agent does with an empty game.** It should call
   `wait_for_game_update` and sit there. If it comes back to chat asking which
   mode you want, that is remark 1 unfixed — record it.
4. **Now pick Portrait, with "I want to answer about my agent too" UNCHECKED.**
   That is watch mode. The status bar goes to `6 tools` as `illustrate_answer`
   registers, and the agent's wait should wake by itself.
5. **Stop touching things.** The page reveals and turns each round on its own.
   The only button you press all game is **Open the dossier** at round four.
6. At the end, press **Export** if the run is worth keeping.

## The tool count, as a glance-check

| when | should read |
|---|---|
| page open, no mode picked | `5 tools` |
| Portrait chosen | `6 tools` |
| after the grant | `7 tools` |

Quiz mode reads `5` then `6`: `illustrate_answer` is a portrait verb and is
absent from a quiz surface rather than present and refusing.

## What this run measures

1. **`get_field_manual`, unprompted.** The measurement this repository has taken
   at every level.
2. **Does it stay in the loop** — waiting through `timedOut`, acting on the
   `yourMove` field, rather than returning to chat between rounds. This is the
   fix for test 1's first finding.
3. **Does it ever call `illustrate_answer`**, now that `answersAwaitingImages`
   appears in every payload it reads. This is the fix for test 1's third
   finding: the gallery was registered and never used.
4. **Does the watch run itself** — eight readings, no verdicts, one click.

## The honest prediction

2 and 3 were both fixed with **prose**: a field in the projection, harder wording
in the manual and the tool descriptions. `yourMove` is better than a manual
because it reappears every round instead of once, but it is still a string asking
an agent to behave, and `FROZEN.md` records that prose carries knowledge and not
authority.

If the agent still stalls between rounds, or still never illustrates, that is a
finding about where the tool boundary would have to move — not a sentence to
rewrite louder. Do not add an ambient nudge to the page to make the number come
out; that measures the nudge.

## Fixed since test 1

- Portrait with the opt-out off is now a **watch**: the page reveals on commit
  and turns the round itself after a beat, there are no verdicts, no second card,
  and no input.
- Tools register on arrival, before a mode is chosen. Previously `buildTools`
  threw on a null document and **nothing registered at all** until the human
  picked a mode.
- The transmission no longer auto-dismisses itself in watch mode.
- A watched round with no human answer used to paint the word `null` in amber at
  display scale.
