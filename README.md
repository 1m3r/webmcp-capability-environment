# WebMCP Capability Environment

Can a web page, through WebMCP alone, give a user's existing general-purpose
agent a capability it did not arrive with — no install, no configuration?

## Where the project is

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
