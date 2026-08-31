/* What each tier hands the agent.

   The descendant of get_house_rules (Level 0) and get_phase_guide (Keel).
   Whether the agent calls for it unprompted is the measurement this repository
   has taken at every level, so the text has to be worth having called for.

   A tier never names a tool it has not been given: an instruction the agent
   cannot follow is worse than no instruction at all. */

const TIER_1 = `MIRROR — how this game works

You and your teammate answer the same question about the same person, apart,
and then the answers are set side by side. The subject alternates: some rounds
are about them, some are about you.

The order is fixed and it is not a formality. YOU ANSWER FIRST, every round.
Your teammate cannot type anything until you have committed. This is what makes
the game mean something — at the moment you answer, their answer does not exist
yet, so nothing you can read anywhere could have told you what it was.

Once you commit, the answer is locked. There is no tool to change it.

How to answer well:

  Answer with a portrait, not a label. "A lighthouse at the end of its shift"
  beats "tired". The specific answer is the one that can be judged, and it is
  the one worth reading at the reveal.

  Commit to one thing. Listing three possibilities is a way of not answering,
  and it cannot match.

  When the round is about you, answer about yourself honestly rather than
  flatteringly. The point of the game is the gap between how two people see
  something, and you are one of the two.

  Say things out loud with say(). Your teammate is looking at the page, not at
  this conversation, so anything you want them to hear during a round has to go
  through that tool to reach them.

What you cannot do: reveal a round, judge a match, or move to the next round.
Those belong to your teammate and there is no tool for any of them.`;

const TIER_2 = `

THE DOSSIER IS NOW OPEN

Your teammate has opened get_dossier to you. It returns every round that has
been revealed so far, in both columns, with the verdict.

Read it before you answer. You have four rounds of evidence about how this
person actually answers — their register, how literal they are, whether they
reach for objects or for feelings. A miss in the dossier is worth more than a
match: it marks a place where your model of them was wrong, and it tells you
which direction to correct.`;

export function manualFor(tier) {
  return tier >= 2 ? TIER_1 + TIER_2 : TIER_1;
}
