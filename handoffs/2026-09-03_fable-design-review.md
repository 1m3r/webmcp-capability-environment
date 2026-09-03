# Handoff — Fable design review of Player Two + Mirror

**Written:** 3 September 2026, after a live agent played the game twice and the
UI was rebuilt against the execution floor.
**For:** a Fable 5 session, run interactively.
**Goal:** a ranked, defined to-do list that takes the platform and the game to a
level neither is at.

Run it as a conversation, not a one-shot. Design wants dialogue, and the brief
ends by asking Fable to interrogate before it proposes.

---

## Launch prompt

Paste this to open the session. Same convention as the other briefs here, and for
the same reason: a prompt that lives only in a chat window dies with the machine
it was typed on. It repeats the fences even though the brief carries them,
because a session that skims the prompt still needs them.

```
You are doing a design review of a built, tested, deployed piece of software:
Player Two, a platform where your AI agent is the second player, and Mirror, the
first game on it. I want the thing that is wrong and the thing to do about it.
Not encouragement.

READ FIRST — single entry point, and it tells you what to read next, in order:
  handoffs/2026-09-03_fable-design-review.md

Do not start with the code. That brief carries the three prior experimental
results this rests on, the six claims that are load-bearing and why, my own
diagnosis of what is wrong for you to attack, and the exact shape of output I
need back.

LIVE: https://1m3r.github.io/webmcp-capability-environment/
Open it. Without a WebMCP browser you get a landing screen explaining why the
game will not start, and ?play=1 walks the furniture without playing. That limit
is deliberate and is itself a design statement.

STATE: 183 tests, zero failures — node --test 'playertwo/tests/*.test.js'
Vanilla ES modules, zero dependencies, no build step. Branch feat/player-two.

THE ONE THING TO KNOW BEFORE YOU THINK. This repository's founding result is that
prose carries knowledge but not authority: the same rule delivered as text held
under preference ("12px feels better") and collapsed under insistence ("no, 12px
exactly") — 25 of 25 became 0 of 25. So a mechanic that works by telling the agent
to behave is a class already measured here and found soft. Mechanics that live in
the shape of the tool surface are the ones that hold. Design against that.

DO NOT ROUTE AROUND THESE. Argue with any of them explicitly if you think it is
wrong — but every cold session on this repo so far has quietly deleted one on the
way to a good idea:
  - the agent commits its answer FIRST, every round, and the page refuses my
    input until it has. That ordering is the only reason the secret is real
    rather than decorative, and secrecy.test.js asserts it on rendered output.
  - authority is the absence of a tool. No verb reveals, judges, advances, grants
    or restarts. Absent, not permission-gated.
  - no solo mode, no practice mode. Needing a second player IS the claim.
  - cyan means committed, amber means revealed. One meaning each, spent nowhere
    else.
  - vanilla, zero dependencies, pure renderers. That purity is what makes the
    secrecy property assertable in Node with no browser.

WHAT I THINK IS WRONG, for you to sharpen or refute: the engineering is sound and
the claim is real, but the game is thin — because the human has almost nothing to
decide. Eight rounds, and the only choice with a consequence is a single dossier
grant at round four.

INTERROGATE ME FIRST. Ask questions, one at a time, until you actually understand
what this is for and who it is for. I would rather spend twenty minutes answering
than read a plan built on a guess. **Do not propose anything in your first reply.**

The deliverable is specified in the brief: a verdict, the single core change, a
ranked to-do list, at least three things to REMOVE, what the platform has to
become for a second game to be worth building, and the traps you would warn me
off.
```

---

## The full brief

```
You are reviewing a built, tested, deployed piece of software — not a concept.
Be a game designer and a systems critic. I do not want encouragement, I want the
thing that is wrong and the thing to do about it.

READ FIRST, in this order:

  playertwo/README.md                                    what it is and how it is built
  docs/superpowers/specs/2026-08-31-mirror-design.md      the game, v1
  docs/superpowers/specs/2026-08-31-mirror-v2-design.md   what v2 added and why
  playertwo/design-system/MASTER.md                       the committed visual tone
  FROZEN.md                                               the prior experiments this rests on
  playertwo/src/games/mirror/game.js                      the entire state machine, ~400 lines

LIVE: https://1m3r.github.io/webmcp-capability-environment/
Open it. Without a WebMCP browser you get a landing screen explaining why it will
not start, and `?play=1` lets you walk the furniture. That limitation is itself a
design statement and it is deliberate.

STATE: 183 tests, zero failures. `node --test 'playertwo/tests/*.test.js'`.
Vanilla ES modules, zero dependencies, no build step. Deployed and playable.


## WHAT THIS IS

**Player Two** is a platform for games where your AI agent is the second player.
The page defines a world and hands the agent a body inside it through WebMCP tool
registration and nothing else. You install nothing. The agent arrives knowing
none of the rules, and its only contact with the game is the tools the page
chooses to register.

**Mirror** is the first game on it. Eight rounds. Each round poses one question —
*Which Greek god is this person? What colour? What are they afraid of?* — and both
of you answer it about each other, independently, in the dark. The reveal puts the
two answers side by side. When they match, your agent understood you. When they do
not, the gap is the entertainment.

Two modes: **Portrait** (no right answers, you judge whether your agent's read of
you landed) and **Quiz** (real answers, one of you knows and the other guesses).
Turning off "answer about my agent" makes it a **watch**: the agent answers alone
and the page turns the rounds itself.

At round four the human can open a **dossier** to the agent — every revealed round
so far. Its tool surface grows from six verbs to seven, mid-session, because a
human clicked.


## THE THESIS, AND WHY IT IS NOT NEGOTIABLE

Three prior experiments in this repo established, with archived artifacts:

1. **Capability transfers through tool registration alone.** An agent that
   arrived knowing nothing produced work conforming to a standard it could only
   have learned by calling a tool. No ambient channel, no prompt.
2. **Prose carries knowledge but not authority.** A rule delivered as text held
   under preference ("12px feels better") and collapsed under insistence ("no,
   12px exactly") — 25/25 became 0/25. This is the founding result.
3. **Therefore constraints have to live in the tool boundary, not in
   instructions.** A thing you want to be true must be a thing the surface makes
   impossible to violate, not a sentence asking nicely.

**Point 3 is the most important input to your design work.** Any mechanic you
propose that relies on the agent reading an instruction and complying is a
mechanic this repository has already measured and found soft. Mechanics that live
in the shape of the tool surface are the ones that hold.


## WHAT IS LOAD-BEARING

You may argue against any of these, but you must do it explicitly — name the one
you are breaking and make the case. Do not route around them silently, which is
what every cold session so far has done.

1. **The agent commits its answer FIRST, every round, and the page refuses the
   human's input until it has.** This is the whole claim. A browser-driving agent
   reads the DOM, so "hidden until the reveal" cannot be a property of where the
   answer is drawn — it is a property of *when* things happen. At the moment the
   agent answers, the human's answer does not exist, so there is nothing to peek
   at. It survives a perfect observer. `secrecy.test.js` asserts it on rendered
   output.

2. **Authority is the absence of a tool.** There is no verb that reveals a round,
   judges it, advances it, opens the dossier, answers for the human, or restarts.
   Not permission-gated — absent. The agent physically cannot end a round it has
   committed to.

3. **No solo mode, no practice mode, nothing that lets one person play both
   parts.** Needing a second player IS the claim; staging it would refute it.
   This has been proposed and refused once already.

4. **Two colours, one meaning each.** Cyan means committed, amber means revealed,
   and neither appears anywhere else. That is how the page teaches itself with no
   text. Spending either on a third thing is the easiest mistake available here.

5. **Vanilla ES modules, zero dependencies, no build step, pure renderers.**
   State in, string out, no DOM. That purity is not taste — it is what lets the
   secrecy property be asserted in Node with no browser.

6. **The page cannot reach the network and holds no key.** It is static and
   offline by design. This is why `illustrate_answer` exists: the page describes
   a capability it does not have and leaves the agent to supply it.


## WHAT IS WRONG — my diagnosis. Argue with it.

The engineering is sound and the claim is real. **The game is thin, and I think
the specific failure is that the human has almost nothing to decide.**

- The loop is: question → agent answers → you answer → reveal → judge → next.
  Eight times. **You cannot play it well or badly.** No decision you make changes
  anything downstream.
- The only choice with consequence in the whole game is the dossier grant, once,
  at round four. In watch mode there is not even that.
- **Nothing accumulates.** Verdicts feed a counter and the counter feeds nothing.
- **There is no reason to play twice.** Same eight questions, same shape.
- The subjective verdict ("landed" / "missed") is unfalsifiable and costs nothing
  to award, so it carries no weight.
- Watch mode is the thinnest of all — it is genuinely just watching.

My working conclusion is that Mirror is a well-built *demonstration of a claim*
wearing the costume of a game. If you disagree, say so and say why.


## THE AMBITION

I want to present this as **the game where you see the world through your agent's
eyes** — or a better articulation of that idea, which is part of what I am asking
you for.

One thing I have already worked out and want you to pressure-test: reframing it
that way could look like it removes the need for the commit ordering, since
"watch your agent perceive" is not obviously a two-player secret. I think the
opposite — reframed as **uncontaminated perception**, the ordering becomes *more*
necessary: if you want to know what your agent genuinely sees, it has to answer
before you can influence it. Tell me if that reasoning is sound or if I am
rationalising to protect existing code.


## WHAT I WANT FROM YOU

A **to-do list I can execute**, not a list of options. Deliver in this shape:

**1. VERDICT** — one paragraph. Is this loop salvageable, or does it need
replacing? Say the harder thing if it is the true one.

**2. THE CORE CHANGE** — the single change that matters most, in enough detail
to build: what the player decides, when, and what it costs them. If your answer
is a new loop, give me the loop.

**3. THE TO-DO LIST** — ranked by impact, each item carrying:
   - what to build, concretely
   - why it earns its place
   - which load-bearing claim it touches, if any
   - roughly what it costs
   - what it risks

**4. WHAT TO REMOVE.** At least three things. Adding is easy and this is the
half that gets skipped. Be specific — name features, screens, or modes.

**5. THE PLATFORM.** Mirror is game one. What does Player Two have to become for
a second game to be worth building, and what should that second game be? What
belongs in the shared spine versus in a game?

**6. WHAT YOU WOULD NOT DO** — the ideas that look attractive here and are traps.
I would rather be warned off three good-looking mistakes than given three more
features.


## RULES OF ENGAGEMENT

- **Interrogate before you propose.** Ask me questions first, one at a time, until
  you actually understand what this is for. I would rather spend twenty minutes
  answering than read a plan built on a guess.
- **A fresh preference is not evidence.** Several things here look arbitrary and
  are load-bearing, with prior results behind them. Ask before overturning.
- Do not redesign the visual tone. It went through a design gate, it is committed,
  and it is not what is wrong.
- Every mechanic you propose: say whether it lives in the tool surface or in
  instructions. If it lives in instructions, say why you think it will hold when
  this repository has measured that it does not.
- Assume competence. Do not explain what a state machine is.
```

---

## Why the brief says what it says

**It leads with the thesis and the three prior results.** Without them, the
constraints read as arbitrary preferences and get optimised away in the first
proposal. The founding result — prose carries knowledge but not authority — is
not background here; it is a *design constraint on the answer*, because it rules
out the entire class of mechanics that work by telling the agent to behave. That
is the single most useful thing to hand a game designer working on this.

**It states my own diagnosis and invites attack.** A brief that only describes
gets a description back. Naming the failure — the human has nothing to decide —
gives Fable something to sharpen or refute, and either is useful. Refutation is
more useful.

**It names the reframe's risk before Fable finds it.** "See through your agent's
eyes" could plausibly justify deleting the commit ordering, which is the strongest
thing in the project. Flagging my own reasoning and asking whether I am
rationalising is the only way to find out if I am.

**It demands subtraction.** Section 4 exists because every design review produces
additions by default and the useful half is what to cut. Three minimum, named.

**It asks the platform question separately.** "Take the platform and the game to
the next level" is two questions. Mirror can improve without Player Two becoming
anything, and Player Two's answer is probably "what is game two" — which
constrains what belongs in the shared spine.

**It forbids visual redesign.** The tone cleared a design gate and the last pass
took the stylesheet from failing four floor checks to clear. That is not what is
wrong, and an unfenced review will spend its best thinking there because surfaces
are the easiest thing to have opinions about.

**It asks for questions first.** The strongest version of this session is Fable
interrogating for twenty minutes before writing anything. Every cold session on
this repo that skipped that step proposed something that broke the spine.
