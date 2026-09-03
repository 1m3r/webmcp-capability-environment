# Mirror + Player Two — design review

    Reviewer:  Fable 5.1, interactive session
    Date:      3 September 2026
    Brief:     handoffs/2026-09-03_fable-design-review.md
    Read:      the six files the brief names, the platform spec, the submission
               design, the two 3 September handoffs, the live landing screen
               and ?play=1, questions.js, manual.js, index.html.
    State:     183 tests, 0 failures, re-run this session.

Answers from the interrogation that this review rests on, so a later session
does not have to guess them:

- The promise, in the owner's words after correction: **not "learn about
  yourself" — learn your agent's perspective of you.**
- Portrait is for the agent you use every day, with memory. Quiz works with a
  cold agent. The two are different games and should be separated, not
  switched inside one.
- The satisfaction came **at the end, from the gallery**. The flatness came
  from UI/UX, unnecessary information on screen, broken image links after the
  results, and questions that do not lead to images.
- The agent's answers were personal, not generic. The content works.
- The journey is **accumulation**: sitting four knows what one to three
  produced, held by the page and handed to the agent over WebMCP, unlocked
  level by level.
- Harness: ChatGPT desktop. Images were licensed stock found online; the
  agent needed a nudge to start gathering them; failures showed as broken
  links. No image generation wanted — links or downloads only.
- Backend acceptable if free (Cloudflare), but only after the first tests and
  the submission.
- Warren stays as "coming soon". The focus is Mirror, its modes and levels.
- Nothing here is for tonight's deadline. "If it's not done it's not done."

---

## 1. Verdict — FIX. The loop stays; the unit of play changes.

Your diagnosis is half right, and the wrong half is the half you would have
built on. It is true that the human decides almost nothing. But the flatness
you actually felt came from four things that have nothing to do with
decisions: the payoff arrives only at the end, the payoff breaks, a third of
the questions cannot reach the payoff, and the screen shows the player the
instruments (log, version, tier, tool count) instead of the game. Curing
"nothing to decide" by adding decisions — wagers, picks, points — would put a
strategy layer on top of a reading and make a worse perspective game.

What is thin is not the round. It is the **unit**. Mirror is a session, and a
session ends. The thing you described in the interrogation — a portrait that
deepens across sittings, held by the page, handed to the agent — is not a
feature on top of Mirror. It is Mirror. The eight-round document is the
demonstration; the persistent portrait is the game. And the one consequential
decision you already have, the dossier grant, is exactly the right *kind* of
decision. It is just made once, mid-session, about four rounds. Every
consequential decision the human makes should be a decision about **what the
agent gets to see**, because that is the one class of decision that lives in
the tool surface rather than in prose, and it is the class this repository
has measured and found to hold.

**On the reframe.** Sharpen "see the world through your agent's eyes" to what
you said: *the game where you find out how your agent sees you.* Your
reasoning that "uncontaminated perception makes the ordering more necessary"
is **sound for Both Ways and Quiz, and a rationalisation for the perspective
mode.** In a watch there is no human answer to protect, so the ordering guards
against an influence that cannot occur. The contamination that matters in a
perspective game is different: the agent seeing your reactions mid-sitting and
tuning to please. The ordering does not guard that. The shape of `get_dossier`
does. Keep the ordering as a platform invariant — it costs nothing and two of
the three games need it — but stop citing it as the reason the perspective
mode is honest. The perspective mode is honest because the agent gets no
feedback until the human closes the sitting and grants it.

---

## 2. The core change — the portrait is the save file

Two words. A **sitting** is what you play. A **portrait** is what you keep.
Mirror stops being one document overwritten on Restart and becomes a portrait
that accumulates sittings.

### One sitting

1. The human opens a sitting and picks a **deck** from those unlocked. Five
   rounds, not eight — a guess to test, because each agent turn now carries
   images and is slower.
2. **Agent commits**, first, unchanged in order, changed in shape:

       submit_answer({ text, because, images: [{ url, credit, license }, ×4] })

   Text, a one-line *why*, and four image URLs, in the same call. The page
   loads each image before accepting and **refuses naming the URLs that did
   not load**. No second verb to forget; no broken link can enter the
   document.
3. **Reveal** (human click, unchanged). The read appears as text, its why,
   and its four images at once. The payoff moves from the end of the game to
   every round.
4. **The human responds.** Two controls replace *landed / missed*:
   **That's me** · **Not quite**. *Not quite* opens an optional one-line
   correction. The correction is the human's real move in a perspective game:
   it costs **disclosure** — you tell your agent one true thing about yourself
   — and it is the only currency that sharpens the perspective. It enters the
   portrait verbatim.
5. **Next** (human click, unchanged).
6. **Sitting close: the grant.** Three buttons, no default, must choose:

   | button | what the agent will carry into the next sitting |
   |---|---|
   | Open it | the whole sitting: reads, responses, corrections |
   | Open the kept reads | only the reads marked *That's me* |
   | Seal it | nothing; the sitting counts toward level but the agent never sees it |

   This is the dossier grant generalised. It is the most consequential
   decision in the game, made once per sitting, at the moment the player
   holds the most information. Seal a sitting and the next one shows you its
   perspective raw again. Open it and you watch the perspective move — or
   double down on a flattering miss you accepted.
7. **Next sitting.** `get_dossier` returns every *granted* sitting and nothing
   from the sitting in play, ever, until it closes.

### What the player decides, when, and what it costs

| decision | when | cost |
|---|---|---|
| Which deck | sitting open | which face of you is on the table |
| That's me / Not quite | every reveal | a kept miss becomes evidence next time |
| The correction | every *Not quite* | disclosure — one true thing, verbatim, permanent |
| Open / kept only / seal | sitting close | contamination vs clarity of the next sitting |
| Accept a proposed question | level 3+ | the agent gets a say in what is asked |

### Levels

Level = sittings closed. Not verdict counts; there is no score in a
perspective game.

| level | unlocks | how |
|---|---|---|
| 1 | five verbs, deck A | arrival |
| 2 | `get_dossier`, deck B | first sitting closed — the transmission, now at a boundary where it belongs |
| 3 | `propose_question`, deck C | the agent may propose one question for the next sitting; the human accepts with a click, the same pattern as `request_rule_change` at Level 3 of the probe |
| 4 | `get_portrait_history` | reads across sittings: what changed between the first read and the latest |

Beyond that: do not invent verbs. Earn them from play.

### Where each mechanic lives

| mechanic | lives in | note |
|---|---|---|
| images with the answer | tool surface | one verb, one payload; the failure "never reached for the second verb" cannot occur |
| image verification | tool boundary | apply → measure → refuse, the Level 3 pattern |
| no feedback mid-sitting | tool surface | `get_dossier` payload shape |
| the grant | human click | re-registers the surface, as today |
| keep / correct | human click | reducer action, no tool |
| whether the agent *fills* the image slots | prose | honest residue; a slot in the call you must make is not a paragraph read once, but it is still a choice |

### Measurement

The pre-registered rounds 1–4 vs 5–8 split moves to **sitting 1 vs sitting
2**, both sealed-then-opened by the human. Cleaner: no mid-session tier flip,
same person, one variable, and the familiarity confound is stated exactly as
before.

### Storage

On device now: `localStorage`, one key per portrait, a new key so old games
die rather than migrate. Backend later — Cloudflare Workers + KV, pair id in
the URL — for one reason only: a share link for the gallery. Not before ten
sittings have been played on device.

---

## 3. The to-do list, ranked by impact

| # | build | why it earns its place | claim touched | cost | risk |
|---|---|---|---|---|---|
| 1 | Sittings, persistent portrait, grant at close (§2) | It is the game. Everything else decorates a session. | 2 (grant stays a click; no new authority verb) | 2–3 days | reducer's `doc` becomes `portrait.sittings[i]`; do it as a new storage key |
| 2 | Images inside `submit_answer`, verified at the boundary | The payoff, per round, and the two live failures (nudge, broken links) both closed structurally | 6 (page loads external images — it already does at render; this moves the load earlier) · 5 (loader injected, renderers stay pure) | 1 day | hotlink-blocked hosts produce refusals — that is the feature. Agents without images: slot optional, read renders text-only |
| 3 | Three games on the start screen: **Perspective**, **Both Ways**, **Quiz**. Delete the checkbox and the excusal | The owner's own finding: two different games, not one with a switch. The excusal already carries the deadlock v2 describes | none | 1 day, mostly deletion | none |
| 4 | Curate decks. Perspective decks must be illustrable — animal, weather, room, hour, body of water, the thing saved from a fire. Verbal questions move to Both Ways | A question that cannot reach the gallery is a round without a payoff | none | ½ day | flattery bias — every deck carries at least one uncomfortable question |
| 5 | Instrument layer: log, version, tier, tool count off by default; `?instrument=on` for runs and judges. The transmission stays as a moment | "Unnecessary information" — those readouts are the experiment's instruments, not the player's game | none | ½ day | the judge wants the tool count; it is one query param away |
| 6 | The portrait screen — the keepsake as a screen, not an export. Every sitting, every kept read, every composition | The gallery is where the satisfaction lives; today it is a results page and three files | none | 2 days + DESIGN gate for the new screens | this is where the tone gets reopened by accident — see §6 |
| 7 | `because` and corrections into the dossier text; TIER_2 manual rewritten around corrections | A correction is worth more than a verdict, and the manual should say so | none | ½ day | none |
| 8 | Level 3–4 verbs | The body growing across weeks is the WebMCP story no one else has | 2 (`propose_question` proposes; a click accepts) | 1–2 days | invented verbs — only after 1–7 have been played |
| 9 | Backend + share link | The gallery wants to be sent to someone | 6, explicitly | 2–3 days | a week and a claim, for a link. Only after ten on-device sittings |
| 10 | The archived-run replay landing | Cut for time on the 2nd; still right. It must read as a recording | 3 (must not become a solo mode) | 1 day | drifting into "try it without an agent" |

---

## 4. What to remove

1. **The `answerAboutAgent` checkbox, `isExcused`, `isWatching`,
   `set_answer_about_agent`, the `EXCUSED` refusal, and the excusal branch in
   the reveal gate.** Replaced by a mode. This is a switch inside one game that
   produced a deadlock, a special case in the reveal, a null verdict, and the
   word `null` painted in amber.
2. **`illustrate_answer` as a separate verb, and illustration of the human's
   answers.** The gallery is the agent's perspective. The human's reads of the
   agent are text, in Both Ways, and that is enough.
3. **The landed/missed counter, "N of 8 landed", and portrait verdicts as a
   score.** Replaced by *That's me / Not quite* with consequence. Quiz keeps
   match/miss and its pass line; that is a different game.
4. **The shared log, the version and tier readouts, and the tool count from
   the player's default screen.** Instrument mode only.
5. **The mid-session grant at round 4, `atGrantMoment`, `DOSSIER_ROUND`, and
   the sidebar "Open the dossier" button.** The grant moves to sitting close,
   where it is one moment with three buttons instead of a moment plus a
   fallback.
6. **Eight rounds.** Five, as a test, with images arriving per round.
7. **Restart as "wipe everything".** It becomes *abandon this sitting*. The
   portrait is never one click from deletion.

---

## 5. The platform

**What must move into the spine** for a second game to be worth building:

- **The ledger.** Per pair (human + agent): sittings closed, verbs granted,
  what the human has released. Game-agnostic. This is what "capability
  released by achievement" means once achievement spans weeks.
- **The grant, generalised.** `grant_tier` becomes *grant(thing)*: one
  human click that re-registers a surface. The transmission is a spine moment,
  not a Mirror moment.
- **The verified-asset gate.** Load before accept, refuse naming the URL.
  Any game that lets the agent hand the page a reference needs it.
- **The instrument layer.** Log, export, tool count, `?instrument=on`.
- **Tiers as data.** A game declares which verbs each level registers; the
  spine does the registering.

A game supplies decks or levels, a reducer, a renderer, a manual.

**Game two.** Warren stays "coming soon", as decided. But say "platform"
honestly on the landing: one game, two listed. Structurally Quiz is already a
second game — cold agent, mutual guessing, real answers — and should be
presented as one rather than as a mode. Warren becomes worth building the day
the ledger exists: when Warren's tier 1 can read "this pair has closed three
sittings of Mirror" and the agent's body in the dungeon is shaped by what the
human granted in the portrait. That is the sentence for the judge: **the
agent's tool list grows across games and across weeks, and every growth is a
human click.**

---

## 6. What I would not do

1. **Decisions for their own sake.** Wagers, streaks, points, picking the next
   question from three. A perspective game with a strategy layer is a worse
   perspective game. The only decisions worth adding are decisions about
   disclosure and grants.
2. **Louder prose.** The next time the agent skips something, move the
   boundary. `yourMove` and the manual have been made as loud as prose gets and
   the gallery still needed a nudge.
3. **A `remember` verb.** The agent must never write to the portrait. The
   human curates; that is the whole asymmetry.
4. **Spending cyan or amber on levels, on *That's me*, or on the gallery.**
   Keep/correct is a human decision; it gets ink, not a colour. A level-up gets
   the transmission's ground lift, which spends neither.
5. **The backend first.** Cloudflare is free; the cost is claim 6 and a week.
   The share link is the only reason, and ten sittings come first.
6. **Any solo mode, including "let a stub agent play so visitors can try it".**
   The replay landing is a recording and must be labelled as one.
7. **Redesigning the tone.** You gave me licence to change all of the design;
   I am declining most of it on purpose. The tone cleared a gate, and what
   failed was the position of the payoff and the information on screen. The
   portrait screen (item 6) is new and gets the DESIGN gate for its own
   layout. If you want a new tone, that is a DESIGN phase with three
   directions diverging on type, palette and grid — not this review.
8. **Claiming the agent understands you.** A kept read is what one person
   accepted on one evening. The export should keep saying so.

---

## Claims touched, explicitly

| claim | status |
|---|---|
| 1 · commit ordering | kept unchanged; its *justification* corrected for the perspective mode (§1) |
| 2 · authority is the absence of a tool | kept; `propose_question` proposes, a click accepts |
| 3 · no solo mode | untouched; trap 6 guards the replay |
| 4 · two colours | untouched; trap 4 |
| 5 · pure renderers | kept; the image loader is injected so Node tests keep no DOM |
| 6 · no network, no key | bent for image verification (already bent at render time); broken for item 9, by decision, later |

## For tonight, if anything

Nothing in code. The submission copy can already state the direction in one
line: *the agent's body grows across sittings, and every growth is a human
click.* That is true of the design and costs nothing to write.
