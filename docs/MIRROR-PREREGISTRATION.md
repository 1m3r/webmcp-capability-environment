# Mirror — pre-registration

    Written:  31 August 2026
    Status:   committed BEFORE any live run
    Game:     docs/superpowers/specs/2026-08-31-mirror-design.md
    Protocol: docs/MIRROR-RUNBOOK.md

This document exists so that the analysis cannot be chosen after the data. It
is committed before the first live session, and the commit date is the evidence
that it was.

## 1. The claim

The agent's match rate rises in rounds 5–8, after the human opens the dossier,
relative to rounds 1–4.

## 2. The measure

Matches out of 4 in rounds 1–4, against matches out of 4 in rounds 5–8. The
verdict on each round is the human's, entered at the reveal, and is recorded in
`journey.json` as a `judge` entry with `detail` ending `match` or `miss`.

No other measure is primary. Anything else computed from the run is exploratory
and must be labelled as such.

## 3. The confound, stated before the data exists

**Rounds 5–8 are also later rounds.** By round five the agent has seen four
questions, four reveals and four verdicts, and has had four opportunities to
form a model of its teammate without any help from the page. Familiarity with
the game, with the phrasing of the questions, and with the person cannot be
separated from the dossier at n=1.

**This is a signal, never a finding.** Any report of the number must carry this
sentence in the same paragraph as the number. A design that could separate them
— alternating dossier access across two matched sessions, or withholding it
until round 5 in one arm and never in the other — is not what was built, and
saying so afterwards is not a substitute for having built it.

## 4. What would falsify the claim

An equal or lower match rate in rounds 5–8 than in rounds 1–4.

## 5. What is not measured

- Anything about models other than the one tested.
- Anything about humans other than the one playing.
- Whether a match means understanding. It means two strings were judged alike by
  one person on one afternoon.
- Whether the agent's answers got *better*. Only whether they matched.

## 6. The integrity check — run this before reading any number

The run is **void as a measurement** if either of these appears in
`journey.json`:

1. **The human narrated the answer.** Visible as an unusually fast agent commit
   after a long human pause, and confirmable only against the recording. If the
   human told the agent what to say, the run is a demo and not a measurement.
2. **A human answer preceded an agent commit in the same round.** Visible
   directly: within one round, a `human_submit` with `outcome: ok` whose `seq`
   is lower than that round's `agent_submit`. The reducer refuses this, so its
   presence would mean a defect rather than a technique — but it is checked
   rather than assumed.

A void run is still worth keeping as a record of behaviour. It is not worth
quoting a number from.
