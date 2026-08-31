/* What each tier hands the agent.

   The descendant of get_house_rules (Level 0) and get_phase_guide (Keel).
   Whether the agent calls for it unprompted is the measurement this repository
   has taken at every level, so the text has to be worth having called for.

   A tier never names a tool it has not been given: an instruction the agent
   cannot follow is worse than no instruction at all. */

const CORE = `MIRROR — how this game works

The order is fixed and it is not a formality. YOU ANSWER FIRST, every round.
Your teammate cannot type anything until you have committed. This is what makes
the game mean something — at the moment you answer, their answer does not exist
yet, so nothing you can read anywhere could have told you what it was.

Once you commit, the answer is locked. There is no tool to change it.

KEEP PLAYING WITHOUT BEING TOLD TO.

After you commit, call wait_for_game_update with the version number you last
saw. It returns the moment your teammate does something — commits, reveals,
judges, moves on — and it returns the round exactly as get_round would. Then
act on what you find.

Do not ask your teammate whether they are finished, and do not wait to be told
to continue. They are looking at the page, not at this conversation. If the wait
returns timedOut, nothing happened yet; call it again with the same version. If
it returns reset, they restarted the game and you should read the round afresh.

Say things out loud with say(). It is the only way your words reach the screen
they are actually watching.

What you cannot do: reveal a round, judge it, or move to the next one. Those
belong to your teammate and there is no tool for any of them.`;

const PORTRAIT = `

THIS GAME IS PORTRAIT MODE

You and your teammate answer about each other. The question is the same for
both of you; the person it describes is not. You answer it about them, and they
answer it about you.

Nothing here has a right answer. What is being asked for is a read, and your
teammate will judge whether yours landed.

How to answer well:

  Answer with a portrait, not a label. "A lighthouse at the end of its shift"
  beats "tired". The specific answer is the one that can be judged, and it is
  the one worth reading at the reveal.

  Commit to one thing. Listing three possibilities is a way of not answering.

  Sometimes your teammate sits a round out and only you answer. That is their
  choice and it is not a mistake to point out.`;

const QUIZ = `

THIS GAME IS QUIZ MODE

Every question has a right answer, and each round one of you knows it while the
other guesses. get_round tells you which you are.

When you are guessing, guess. One concrete answer, the most likely one — a
hedge cannot match. When you know, answer plainly and honestly rather than
interestingly; your teammate is trying to reach the same words.

You are being scored on whether the two answers agree.`;

const TIER_2 = `

THE DOSSIER IS NOW OPEN

Your teammate has opened get_dossier to you. It returns every round that has
been revealed so far, in both columns, with the verdict.

Read it before you answer. You have four rounds of evidence about how this
person actually answers — their register, how literal they are, whether they
reach for objects or for feelings. A miss in the dossier is worth more than a
hit: it marks a place where your model of them was wrong, and it tells you which
direction to correct.`;

export function manualFor(tier, mode = 'portrait') {
  const base = CORE + (mode === 'quiz' ? QUIZ : PORTRAIT);
  return tier >= 2 ? base + TIER_2 : base;
}
