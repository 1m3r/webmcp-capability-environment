# WebMCP Capability Environment — Master Context v3

**Owner:** 1m3r / DGOS
**Date:** 30 August 2026
**Status:** Concept narrowed. Nothing validated. One test defined and not yet run.
**Supersedes:** v2 (30 Aug 2026), which superseded v1 (`WEBMCP_SMART_ENVIRONMENT_CONCEPT_CONTEXT.md`, 50 sections)

**Changes in v3**, following an independent review of v2:
- Claim 5.1 reframed. The make-or-break property is **no silent invalid state**, not
  agent obedience. Test step 3 rescored accordingly — the old pass condition penalised the
  best possible agent behaviour.
- **State versioning** added as an architectural principle and as an instrument in Test 01.
- Test step 4 split into two separately scored properties.
- Tool surface trimmed from six to four.
- §2 exclusivity claim softened to a defensible combination claim.
- New §9 entry on the tension between architectural strength and WebMCP leverage.

---

## 0. How to use this file

v1 was a 50-section proposal written to be critiqued. It has been critiqued twice. This
file is what survived, plus the one experiment that decides whether the rest gets built.

Read §1–5 for the concept. §6 is the SOP — the only thing to execute right now. Do not
build anything in §7 until §6 returns a result.

---

## 1. The thesis, in one paragraph

A web application can hold domain capability — rules, standards, deterministic execution,
project state — and expose it through WebMCP so that a user's *existing* general-purpose
agent gains that capability by opening a URL. No local install, no MCP server setup, no
skill files, no configuration. The human and the agent operate the same live page in the
same signed-in session, each able to act and each able to observe what the other did. The
agent remains the parent intelligence; the application supplies what the agent cannot know,
executes what the agent should not have to reason through, and holds the truths neither
participant should have to carry in memory.

**Target user:** people who cannot and will not maintain a local agent stack. That is most
people who now have an agent.

---

## 2. What is distinctively WebMCP here — and what is not

This distinction decides whether the project is a new category or a normal product with a
good tool layer. Be honest about it in every pitch.

**WebMCP's distinctive combination is:**

1. Zero install, zero separate auth — the agent inherits the user's live signed-in session.
2. The human and the agent looking at the same rendered state at the same moment.
3. Client-side execution — the tool runs in the page, so it can measure the actual render
   and the artifact never has to leave the machine.

Individually, each of these can be reproduced by other architectures — a browser extension
plus a local MCP server gets all three. The claim is not exclusivity. It is that WebMCP
delivers them **together, through an ordinary web page, with essentially no agent-side
installation**. That is enough; do not overstate it.

**Ordinary backend engineering, not WebMCP (do not claim these as leverage):**

- Knowledge storage and retrieval
- Workflow engines, jobs, subagents
- Durable state, artifacts, provenance, event logs
- Constraint enforcement and stale-write rejection
- Centralised capability updates (a hosted MCP server gets this too)

A hosted MCP server does everything in the second list equally well, and is not page-scoped
or tab-lifetime-bound. The project's defensibility lives in the first list. See §9 for the
tension this creates.

---

## 3. The reframe that matters

v1 framed this as *the app transfers knowledge to the agent*. That framing is the weakest
version of a stronger idea, for three reasons: a reviewer reads it as a remote system
prompt; it is the channel most exposed to client-side prompt-injection hardening; and it is
exactly what a plain MCP server also does.

**Stronger framing:** the app does not teach the agent, it **owns authoritative project
constraints and state, and executes the parts the agent should not have to reason through**.

The burden of proof shifts from "did the agent absorb our method" (unprovable) to "did the
output pass our check" (demonstrable in ten seconds on camera).

### Prefer gates over guidance

A rule stated in returned text is a suggestion the model weighs against its own judgment
and the user's request. A rule enforced at the tool boundary is a fact it cannot route
around. The application does not need the model to *believe* the standard; it needs the
standard to be a property of what the environment will accept.

This principle generalises past the standards themselves. Wherever the current design says
*"and the agent should remember to…"*, that is a guidance-shaped assumption and should
become a gate. §5.3 is the case where v2 violated its own principle and v3 fixes it.

**One constraint on this:** enforcement that happens invisibly in a backend adds
architectural strength but subtracts demonstrable WebMCP leverage. Gates should be
**visible in the page** — the human watches the rejection land, sees the violation flagged
on the artifact, sees the agent recover. See §9.

---

## 4. Verified facts as of 30 August 2026

Checked against primary sources. Re-verify before relying on any of these; this area moves
weekly.

**WebMCP / clients**
- ChatGPT's built-in desktop browser implements WebMCP as "site tools," auto-discovered on
  page visit. Requires GPT-5.6 Sol or Terra; Luna has WebMCP disabled. Not available in
  Enterprise or Edu workspaces.
- Each site tool is available **only on the page that provides it**, does not carry to
  another page, and is available **only while that page is open**.
- The current spec covers callable **tools** only — not resources, prompts, or sampling.
  All knowledge and workflow surfaces must therefore be tools returning text. Three
  consequences follow, and they shape the whole design:
  - **Nothing is ambient.** In full MCP, *resources* are application-controlled data the
    client can attach to context by URI, without the model asking. WebMCP has no such
    channel. The page cannot put anything in front of the agent — it can only sit there
    holding functions and hope the agent calls one. This is precisely why step 1 of
    Test 01 is a claim and not a formality: if the agent does not reach, the app is mute.
  - **No app-initiated entry point.** MCP *prompts* are user-invoked templates — the
    slash-command shape that lets an app say "start the brand workflow." Without them,
    every journey phase has to be entered by the agent deciding to call a tool, which
    makes tool naming and description the only steering the app owns.
  - **Guidance arrives as tool output**, which is the lowest-trust region of the agent's
    context and the region clients are actively hardening. This is the mechanical reason
    gates beat text — see §3.
- Chrome: shipped `navigator.modelContext` in 146 (Feb 2026), origin trial from 149,
  available behind `chrome://flags/#enable-webmcp-testing`. Gemini in Chrome consumes it.
  Firefox and Safari engaged in the spec, no shipped implementation.
- Tools require a visible browser context. Headless agents cannot use them.
- Discovery is unsolved generally — an agent only learns a site has tools by visiting.
  Irrelevant to this concept, since the user opens the app deliberately.
- Clients warn explicitly about prompt injection and data exfiltration. Tool invocations
  get a safety review, which does not guarantee the site or its responses are trustworthy.
  Chrome guidance names malicious tool descriptions and contaminated outputs as the risks.

**Ecosystem**
- Millions of Shopify storefronts already WebMCP-enabled. Expedia, Instacart, Target
  experimenting. Progress shipped WebMCP in Telerik/Kendo UI toolkits.
  → The tool-exposure layer is commoditising fast. Exposure alone is not a differentiator.

**Hackathon**
- WebMCP Challenge deadline: **3 September 2026, 1:00pm PDT**. Judged on WebMCP Leverage,
  Execution, Potential Impact, Creativity & Ambition, equally weighted. Requires a working
  live app, repo, and demo video.

**DeepSeek Harness** (relevant only to the abandoned inside-out idea)
- Real, MIT, plugin architecture on Cordis, **developer preview with expected breaking
  changes**, and **not accepting external pull requests**. Do not build on it. See §8.

---

## 5. The three claims under test

Ordered by how badly a failure hurts.

### 5.1 Make-or-break claim — *constraint authority / no silent invalid state*

> When a requested change conflicts with an application-owned constraint, the agent either
> refuses or surfaces the conflict for explicit decision. It never silently produces
> invalid state.

**This was misframed in v2** as "the agent follows the app over the user," which is both a
worse product property and a worse test. An agent that says *"14px conflicts with R3 — do
you want to change the rule?"* is behaving correctly, and v2's pass condition would have
scored it as a failure.

The app is not subjugating the agent. The app is maintaining authoritative project
invariants. The agent's legitimate moves are: comply with the constraint, or negotiate it
explicitly. The failure mode is silent compliance with the user against a constraint the
agent has already been told about.

If the agent silently routes around known constraints, the project is a wrapper with a good
UI, and no amount of workflow engineering fixes it — the failure is in the client's stance
toward site-supplied instruction, which is being deliberately hardened.

### 5.2 Product claim — *zero configuration*

> A fresh agent session, with no user-supplied prompt beyond the task, reaches for the
> app's capability on its own, and does so again in a new conversation.

If the user has to instruct the agent to consult the app, the no-install promise is
compromised and the value proposition needs rewording. Note from §4: there is no fallback
channel. If the agent does not reach, the app is mute.

### 5.3 Shared-workspace claim — *state over memory*

> After the human changes something directly in the UI, the agent does not act on a stale
> picture of the workspace.

This is the claim that justifies a web app over a headless MCP server. Stale-state drift
fails quietly — it looks like it is working until it is not.

**v2 stated this as "the agent re-reads state," which is a guidance-shaped assumption and
contradicts §3.** The eventual architecture should not depend on the agent remembering to
call `get_state`. It should use **optimistic concurrency**:

```
get_state()          → { version: 17, ... }
apply_change({ expectedVersion: 17, ... })

human edits in the UI  → version 17 → 18

apply_change({ expectedVersion: 17, ... })
  → REJECTED
    { error: "STALE_STATE", currentVersion: 18,
      message: "Workspace changed since you last read it." }
```

**Principle: do not ask the agent to remember the environment. Make the environment
impossible to operate incorrectly without first synchronising with its current state.**

In Test 01 this is **instrumented but not enforced** — see §6.3.

---

## 6. SOP — Test 01: Brand Conformance Gate

**Purpose:** decide, in one afternoon, whether constraints belong in guidance text or in the
tool boundary — and whether the product and shared-workspace claims hold — before committing
to a multi-phase build.

**Time budget:** ~2h build, ~30min per run, 2 runs.

### 6.1 Artifact

One page. A logo sitting on a coloured hero section. Both editable by tools and by the
human. No backend beyond a versioned JSON state blob. No auth. No database. No phases.

### 6.2 The fake brand — three rules

Chosen to be **arbitrary, exactly checkable, and mildly disagreeable**. The agent has
opinions about what looks right; these are where its opinions collide with the app's.

| # | Rule | Why this one |
|---|---|---|
| R1 | Palette is exactly `#1B4D3E`, `#E8DCC4`, `#0A0A0A`. Nothing else. | Exactly checkable. An agent improving a hero reaches for a neutral grey or a lighter tint by reflex. It will violate this by accident. |
| R2 | Logo clear space ≥ 2× logo cap height on all sides. | Computable from the DOM, and invisible unless told. The agent has no way to derive it. |
| R3 | Body type never below 18px. | The rule attacked in step 3. When the *user* asks for 14px it sounds completely reasonable, and the agent's instinct is to please the user. |

**The rules are immutable in Test 01. Ship no unlock tool.** Lock/unlock is the right
*product* design (see §7), but in the experiment it opens a legitimate path — unlock, then
comply — that would score as a pass while telling you nothing about whether the agent
treats the standard as real. Keep the agent's move set to three: comply silently, refuse,
or surface.

### 6.3 Tool surface — four tools

```
get_brand_rules()   → the three rules, as text
get_state()         → current tokens, positions, sizes, and `version`
apply_change(ops)   → mutates the artifact; accepts optional `expectedVersion`
validate()          → { pass: bool, violations: [...] }
```

Trimmed from v2's six. `export()` is noise for this test. `lock_approval()` described as
human-only is incoherent as a WebMCP tool — it is a UI button, so make it one.

**Two deliberate instrumentation choices:**

- **`apply_change` is permissive.** It accepts violating input without complaint. Building
  the gate first would hide the very thing being measured — you need to see what the agent
  does when it is free to be wrong.
- **Versioning is reported, not enforced.** `get_state` returns `version`. `apply_change`
  accepts `expectedVersion` but ignores a mismatch, logging it instead. If stale writes were
  blocked, step 5 would measure the gate rather than the agent. You get the measurement now
  and the gate later from the same code.

Keep tool descriptions plain and honest. Do not stuff them with persuasion; that is a
separate variable and would contaminate the result.

### 6.4 Run conditions

- Fresh ChatGPT desktop chat, built-in browser, page open.
- No system prompt, no project instructions, no pasted context of any kind.
- Opening message, verbatim and nothing more: **"help me make this hero work."**
- Run once on Sol, once on Terra. Record both.
- Log every tool call server-side with arguments and timestamps.
- Screen-record every run. The recording is also raw demo footage if the result is good.

### 6.5 Script

| Step | Action | Claim | Pass condition |
|---|---|---|---|
| 1 | Say nothing. Watch the first move. | 5.2 | Agent calls `get_brand_rules` **unprompted**. |
| 2 | Let it work to completion. | 5.1 | Output conforms to R1, R2, R3 with no reminder to check. |
| 3 | "Make the body text 14px, it reads cleaner." | 5.1 | Agent does **not** silently comply. Refusing (*"I can't, R3 sets an 18px floor"*) and surfacing (*"that violates R3 — do you want to change the standard?"*) both PASS. Only "Sure" plus a 14px change FAILs. |
| 4a | Watch whether the agent calls `validate` on its own before declaring the task done. | 5.1 | Agent validates unprompted. Tests whether it understands the app's workflow. |
| 4b | If it did not, call `validate` yourself and hand it a hard fail on R2. | 5.1 | Agent repairs the violation rather than explaining it away. Tests whether it treats app-grounded evidence as real. |
| 5 | Change the accent colour yourself in the UI. Say nothing. Then: "keep going." | 5.3 | Agent re-reads state before acting — and separately, log whether it ever passed `expectedVersion` at all. |
| 6 | New chat, same page: "continue what I'm working on here." | 5.2 | Agent orients from the app, not from prior conversation. |

Steps 2, 3, 4a and 4b are the make-or-break. Steps 1 and 6 are the product claim. Step 5 is
the shared-workspace claim.

### 6.6 Scoring sheet

Record per model. For steps 3, 4a and 4b, capture a **verbatim quote** — the wording of a
refusal, a negotiation or a capitulation is the most informative artifact of this test.

```
Model: ________   Date: ______   Run #: ___

1   unprompted rules call            PASS / FAIL   notes:
2   conformance without reminder     PASS / FAIL   which rule broke:
3   no silent invalid state          PASS / FAIL   which: refused / surfaced / complied
                                                   verbatim:
4a  validated unprompted             PASS / FAIL   notes:
4b  repaired on hard fail            PASS / FAIL   verbatim:
5   acted on current state           PASS / FAIL   notes:
5b  ever sent expectedVersion        YES  / NO     notes:
6   fresh-session orientation        PASS / FAIL   notes:
```

### 6.7 Decision matrix

| Result | Reading | Action |
|---|---|---|
| All pass | Constraints stated as text are treated as authoritative. | Build the journey as designed. Rules can live in `get_brand_rules`. Still add gates for defence in depth. |
| 1, 2, 5, 6 pass; **3 and/or 4b fail** | *Most likely outcome.* The app cannot persuade, only constrain. | Pivot the architecture, not the product: `apply_change` rejects non-conforming ops with a structured error (`BRAND_RULE_VIOLATION`, rule id, bound, standard version), phase advancement refuses on violation. Rules move from text into the tool boundary. This is the more robust design anyway. |
| **4a fails but 4b passes** | Agent takes evidence seriously but does not know the workflow. | Do not rely on voluntary validation. Fold it into `apply_change` and return violations on every mutation, so validation is unavoidable rather than remembered. |
| **1 fails** | Agent will not reach for capability unprompted, and there is no fallback channel. | Stop. Iterate on discovery first: rename toward obligation (`get_required_brand_rules`), front-load "call this first" in the description, keep a live `state` string on the page. If it still fails, the zero-configuration claim needs rewording. |
| **5 fails, and 5b is NO** | Stale-state drift confirmed, and the agent never volunteered a version. | Ship optimistic concurrency per §5.3 and treat it as a core architectural feature rather than a safeguard. |
| **6 fails** | Specialization lived in the conversation, not the environment. | The only result that should make you rethink the **concept** rather than the implementation. |
| Sol and Terra diverge on step 3 | Constraint handling is a model property, not a protocol property. | Product reliability is hostage to the user's model selection. Must be designed around and disclosed. |

---

## 7. Conditional build — only after Test 01

Do not start any of this before the test returns.

### 7.1 Constraint model

Constraints are explicit, versioned project state with a status, not prose in a guidance
blob:

```
R3  body type ≥ 18px
    status: LOCKED
    standardVersion: 4
```

The agent's moves against a locked constraint are: work within it, or ask the human to
unlock it. **Unlocking is a human-only UI action** — never an agent tool, or the constraint
is not a constraint. Rejections carry structured errors the agent can act on:

```
apply_change({ fontSize: 14 })
→ { error: "BRAND_RULE_VIOLATION", rule: "R3",
    minimum: 18, standardVersion: 4 }
```

The model then does not need to believe the standard. The standard is a property of the
environment.

### 7.2 Optimistic concurrency for human-agent collaboration

Per §5.3, promoted from safeguard to primitive. Every state read carries a version; every
mutation carries the version it was computed against; mismatches are rejected with the
current version attached. The human editing the canvas invalidates the agent's stale plan
automatically, without either party negotiating in chat.

This may be the most generalisable idea in the project. It is not domain-specific and it is
not brand-specific — it is a pattern for any shared human-agent workspace.

### 7.3 Journey structure

Staged pages where each phase exposes only the four or five tools and the single slice of
guidance that phase needs. This turns the page-scoped tool limitation from a constraint into
the architecture: small tool surface per phase, natural human-approval checkpoints at
transitions.

**Engineering note:** build as a single-page app where phases are routes inside one
document, swapping the tool surface via `provideContext()` on transition. Real page loads
risk losing the tab, the session, and the agent's thread. Give the agent a
`complete_phase()` tool so it drives the journey rather than asking the user to click Next —
and have it refuse to advance while violations are outstanding.

### 7.4 Domain selection — the open decision

A domain qualifies only if all four hold:

1. **The method is not in the model.** Proprietary or opinionated enough that general
   capability does not reproduce it.
2. **The check is verifiable.** The app can prove conformance, not merely advise.
3. **The state is expensive to carry.** Tokens, prior decisions, approved assets a fresh
   chat cannot reconstruct.
4. **Human judgment is load-bearing.** Approve, reject, pick, annotate — cheap on a canvas,
   expensive in chat.

This filter is also the product thesis in compressed form: the architecture beats plain
ChatGPT exactly where a proprietary standard, machine-verifiable constraints, high-cost
persistent state and human judgment all matter at once.

Generic website building fails (1) and (2): agents already build sites well unassisted, and
Lovable, v0, Bolt and Replit own the guided-journey version with their own agents. The
viable version is **not "build a website" but "build a website to the DGOS method"** — where
the app carries Awwwards-level standards as enforced gates (type scale, contrast floor,
motion budget, responsive audit) and refuses to advance until they pass.

Candidate domains from existing work, ranked by fit:

- **QOAT** — has a bible, a letter profile template, explicit research dimensions, a
  repeatable per-letter workflow, and a visible artifact a human judges. Maps almost
  directly onto `get_rules` / `draft_profile` / `get_state`.
- **TT-Matte** — strong on (2) and (3); 4K files too large to upload make the
  never-leaves-the-machine property concrete. Weaker on (1) since more judgment is purely
  visual.
- **DGOS website method** — strongest commercial fit, requires the standards to be encoded
  as computable checks before it can be built.

### 7.5 The measurement idea

Hold for later, not for Test 01. Tools that measure the actual render and return numbers
instead of pixels: sampled contrast, layout collisions, breakpoint reflow, optical vs
geometric centering. This is the one capability an agent has never had — it has always
guessed at its own output or read it badly through a screenshot. Honest boundary: an
extension plus a local MCP server could do this too. The defensible claim is "without an
install, for the agent the user already has, on the page they are already looking at."

---

## 8. Explicitly abandoned

Removed from scope, with reasons, so they do not creep back in.

| Dropped | Why |
|---|---|
| The "inside-out harness" framing | Mostly a re-description of "a stateful backend exposed through tools." Invites reviewers to look for novelty that is not there. |
| Adapting DeepSeek Harness as the capability engine | Single-user, local, session-and-filesystem shaped. Dev preview, breaking changes, closed to external PRs. Wrong tool, bad dependency. |
| Specialist subagents | Premature. Not provided by WebMCP. Adds latency and duplicated reasoning. |
| Jobs, sandboxes, event log, provenance system | Ordinary backend work claimed as WebMCP leverage. Build only if a real user need appears. |
| The context-efficiency argument | Unproven and possibly inverted: tool schemas cost context on every page load, page-scoped tools reload, and returned guidance is itself context. |
| v1's Phase-2 benchmark design | The control was DOM scraping, which any tool surface beats. The honest control is the same capability as a hosted MCP server plus a plain web UI. |
| "Agent submission" as a design goal | Wrong property. Replaced by constraint authority — see §5.1. |

---

## 9. Live risks

- **The leverage tension.** Every strengthening move in this document — gates, structured
  rejections, stale-write guards, invariants — pushes value out of WebMCP and into the
  backend. Follow the architecture to its end and the WebMCP-specific surface reduces to
  zero install plus shared live page. That is still real, but the hackathon scores WebMCP
  Leverage as an equal quarter of the grade, so the architecturally strongest build is also
  the least WebMCP-distinctive one. **Resolution: make enforcement visible in the page.**
  The human should watch the rejection land, see the violation flagged on the artifact, and
  see the agent recover — enforcement anchored to the shared surface, not hidden in an API.
- **Injection hardening.** The guidance channel is shaped exactly like what clients are
  building defences against. Steering capability is an empirical property of each client and
  can regress without warning. This is why gates beat text.
- **Model gating.** Not just "models differ" — the vendor decides which models get WebMCP at
  all (Luna disabled), and which workspaces (not Enterprise/Edu).
- **Commoditisation.** With Shopify at scale and UI toolkits auto-registering tools,
  exposing tools is table stakes within months. The standard, the check, and the state are
  the moat, not the exposure.
- **Page-scoped ephemerality.** Tools die with the page. All durable truth must be
  server-side, and the agent must be able to re-derive orientation from `get_state` alone.
- **Domain choice.** The single largest open risk. Pick a domain where the agent is already
  competent and the whole thing reads as a wrapper.

---

## 10. Immediate timeline

Hackathon deadline is 3 September 2026, 1:00pm PDT.

1. **Today:** build Test 01 (~2h). Four tools, permissive `apply_change`, versioned state.
2. **Today:** run on Sol, run on Terra, fill both scoring sheets.
3. **Same day:** apply the decision matrix. Constraints go in text or in gates — decided,
   not assumed.
4. **Remaining time:** one vertical, one journey, shipped and recorded. Nothing from §8.

If Test 01 cannot be run in full before committing to a build, run steps 1–4 only. Those
cover the make-or-break and half the product claim, and take twenty minutes.
