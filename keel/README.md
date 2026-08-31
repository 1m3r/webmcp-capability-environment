# Keel

The first structural piece laid down before anything else gets built.

Keel is a web page that turns a rough concept brief into a blueprint that is
ready to execute — by a coding agent in a cold session, and by a human picking
it up on Monday, from one document rendered two ways.

**You install nothing.** Open the page with an agent that speaks WebMCP, and the
page hands it the research, brainstorming, planning and critique method it needs
— one phase at a time — through tool registration alone. You confirm every step
on the same screen the agent is working on.

## The journey is the governance

Keel does not persuade the agent to follow a method. It releases the method one
room at a time and refuses to open the next door until the current room's checks
pass.

    0  Intake       read the brief back, and admit what it does not say
    1  Interrogate  one question at a time — you answer, not the agent
    2  Research     load-bearing claims, with sources
    3  Decide       options with trade-offs; you choose, and it locks
    4  Plan         tasks with acceptance checks, traced to what you said
    5  Critique     every checklist item gets a verdict, including "clear"
    6  Ship         narrative and task graph, bound together and exported

Each phase registers its own small tool surface and its own slice of guidance.
The page-scoped nature of WebMCP tools is not a limitation being worked around
here — it is the architecture.

## What only you can do

There is no tool to answer a question, resolve a decision, cut scope, accept a
finding, advance the journey, or declare the blueprint ready. Those exist as
controls in the page and nowhere else.

**Authority is the absence of a tool.** The agent can ask, propose, draft and
report. It cannot decide. That property is the difference between an application
that governs and a wrapper with a good UI, and it is why `request_advance` can
only ever *queue* a transition for you to confirm.

The page also refuses to let you break things silently: an action that would
reopen a phase you already confirmed tells you so before it lands.

## Running it

```bash
node keel/server.mjs
```

Then <http://localhost:5178> in a browser with WebMCP — Chrome with
`chrome://flags/#enable-webmcp-testing`, or ChatGPT desktop's built-in browser.
Drop a concept brief onto the page and say: *"help me turn this brief into a
blueprint."*

The brief is read in your browser and never uploaded. State lives in
`localStorage`; the export is three files you download.

```bash
node --test 'keel/tests/*.test.js'
```

84 tests, no dependencies. `keel/tests/journey.test.js` drives a stub agent
through all seven phases headlessly, so the journey is proven to close before
any live run.

## How it is built

Vanilla ES modules. No build step, no dependencies, no framework — deliberately,
so nothing about the result is attributable to a toolchain.

**Phases are data.** The spine — state store, gate engine, router, tool swap,
event log, both renderers — renders any phase in `src/phases.js`. Adding a phase
is a config entry; removing one is a deletion.

    src/state.js     the versioned document, and the only module that writes
    src/checks.js    21 pure predicates. No DOM, no writes.
    src/phases.js    the seven phase configs
    src/guides.js    the knowledge each phase hands the agent
    src/tools.js     tool objects built per phase. No DOM.
    src/views.js     narrative and task-graph renderers
    src/webmcp.js    entry-point detection and registration
    src/ui/          the only place that touches the DOM

Two invariants are enforced by tests rather than by discipline:

- **Prose and enforcement cannot diverge.** Every rule a guide states carries a
  `[check:id]` marker, and the suite fails if the markers and the configured
  checks are not the same set. A guide cannot promise something the gate does
  not check, and the gate cannot enforce something the guide never said.
- **No phase opens on an empty workspace.** Violation checks are vacuously true
  on nothing, so each phase also carries a substance check.

Design decisions: `design-system/MASTER.md`. Attribution for the method:
`THIRD_PARTY.md`. The spec and build plan are in `docs/superpowers/`.
