# WebMCP Capability Environment

Can a web page, through WebMCP alone, give a user's existing general-purpose
agent a capability it did not arrive with — no install, no configuration?

## Player Two — the application

**[playertwo/](playertwo/)** is a platform of games in which your agent is the
second player. The page defines a world, hands the agent a body inside it
through WebMCP tool registration and nothing else, and the two of you play on
one screen. Clearing stages is what releases new method and new verbs to it —
and your click is what grants them.

The first game, **Mirror**, has two modes. In **Portrait** you each answer about
the other, and you judge whether your agent's read of you landed. In **Quiz**
the questions have real answers and one of you knows while the other guesses —
match 5 of 8 to pass. Both answer in the dark; the reveal sets the answers side
by side.

Your agent keeps playing on its own: after it commits it calls
`wait_for_game_update`, and the page tells it the moment you move.

Secrecy rests on **order, not rendering**. A browser-driving agent reads the
DOM, so "hidden until the reveal" cannot be a property of where the answer is
drawn. The agent commits first, every round, into a tool with no verb to edit or
retract; the page refuses your input until it has. At the moment it could look,
there is nothing to look at.

    node playertwo/server.mjs              ->  http://localhost:5179
    node --test 'playertwo/tests/*.test.js'

Platform spec: [docs/superpowers/specs/2026-08-31-player-two-design.md](docs/superpowers/specs/2026-08-31-player-two-design.md) ·
game spec: [docs/superpowers/specs/2026-08-31-mirror-design.md](docs/superpowers/specs/2026-08-31-mirror-design.md) ·
run protocol: [docs/MIRROR-RUNBOOK.md](docs/MIRROR-RUNBOOK.md) ·
pre-registration: [docs/MIRROR-PREREGISTRATION.md](docs/MIRROR-PREREGISTRATION.md)

A second game, **Warren** — two avatars in one dungeon, where the asymmetry is
that one body cannot be in two places — is specified in the platform spec and
not yet built.

## Where the probe is

**Level 0 — Transfer Probe: PASSED.** A page holding one arbitrary rule behind
a WebMCP tool changed what a fresh ChatGPT agent produced. Control produced 1 of
10 spacing values on the rule's grid; the experimental condition produced 4 of 4,
and 25 of 25 by occurrence. The agent discovered the rules tool unprompted and
called it before touching the canvas.

Full record: [docs/TEST-00-REPORT.md](docs/TEST-00-REPORT.md) · illustrated PDF
alongside it · raw artifacts, exports and recordings in [runs/](runs/).

It also found the limit that shapes everything after it: the rule held when the
user expressed a preference, and dissolved when the user insisted. **Knowledge
transfers through prose. Authority does not.**

**Level 1 — Compositional Capability Transfer: specified, not yet built.**
Can the page transfer a small system of *interdependent* rules the agent must
derive consequences from? See [docs/LEVEL-1-SPEC.md](docs/LEVEL-1-SPEC.md) and
the build brief in [handoffs/](handoffs/).

## Running the probe

```bash
node server.mjs
```

Modes and protocol: [docs/LEVEL-1-RUNBOOK.md](docs/LEVEL-1-RUNBOOK.md) for the
current test, [docs/TEST-00-RUNBOOK.md](docs/TEST-00-RUNBOOK.md) for Level 0.

## Layout

```
public/         the probe — page, tools, rules, measurement
server.mjs      zero-dependency static server on localhost
docs/           specs, runbooks, the Level 0 report
runs/           every run: sheet, export, artifact, recording
scripts/        scorer and report build
handoffs/       build briefs
```

Vanilla HTML/CSS/JS. No framework, no build step, no dependencies — deliberate,
so the probe is not confounded by a toolchain.
