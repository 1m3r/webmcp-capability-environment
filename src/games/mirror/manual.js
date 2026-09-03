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
  choice and it is not a mistake to point out.

ILLUSTRATE THE ANSWERS

You have illustrate_answer, and this page does not. It is static, it is offline,
it holds no key, and it cannot fetch an image — so it describes the slot and
leaves it to you. At the end of the game every answer is shown at the centre of
its own four images, yours and your teammate's alike, and that gallery is the
thing worth keeping.

Once a round is revealed, both answers are yours to illustrate. Find four images
that match the ANSWER rather than the question — "a lighthouse at the end of its
shift" wants dusk, tiredness and a long light, not a diagram of a lighthouse.
Roughly square images sit best in a 2x2, and four that agree with each other in
tone make a better composition than four good pictures that do not.

Use sources whose licence allows reuse: Openverse, Wikimedia Commons, Unsplash,
Pexels. Pass the credit and the licence with each image. This is meant to be
shareable, and four unattributed pictures are not.

You cannot illustrate a round before your teammate reveals it, and you cannot
change a composition once it is attached — the same rule the answers follow.`;

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

/* Read on arrival, before the human has picked a mode. The ordering and the
   wait loop are true in both modes and are what the agent most needs first; the
   mode-specific half arrives when the mode does. */
const NO_MODE = `

NO GAME HAS STARTED YET

Your teammate picks the mode on the shared screen — Portrait or Quiz — and round
1 is posed the moment they do. Nothing is required of you until then: call
wait_for_game_update with \`since: 0\` and it will return as soon as the game
begins. Read this again once it has, and it will tell you how the mode they
chose is played.`;

export function manualFor(tier, mode = 'portrait') {
  if (mode === null) return CORE + NO_MODE;
  const base = CORE + (mode === 'quiz' ? QUIZ : PORTRAIT);
  return tier >= 2 ? base + TIER_2 : base;
}
