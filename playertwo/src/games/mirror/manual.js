/* What each tier hands the agent.

   The descendant of get_house_rules (Level 0) and get_phase_guide (Keel).
   Whether the agent calls for it unprompted is the measurement this repository
   has taken at every level, so the text has to be worth having called for.

   A tier never names a tool it has not been given: an instruction the agent
   cannot follow is worse than no instruction at all. */

const CORE = `MIRROR — how this game works

The order is fixed and it is not a formality. YOU ANSWER FIRST, every round.
The page does not move until you have committed. Once you commit, the answer
is locked. There is no tool to change it.

A game is played in SITTINGS. A sitting is one deck of questions. When the last
round is judged your teammate closes the sitting and decides what you carry out
of it into the next one. That is their decision and there is no tool for it.

KEEP PLAYING WITHOUT BEING TOLD TO. THIS IS THE PART AGENTS GET WRONG.

Your teammate is looking at the page. They are not looking at this conversation,
and they will not type anything here to start you, to nudge you between rounds,
or to tell you they are done. If you stop and report back after each round, they
have to leave the game and come to the chat to restart you, every round. Do not
make them do that.

The loop, and it runs from the moment you arrive until the sitting closes:

    call wait_for_game_update with the version you last saw
    it returns -> act on it -> call it again
    it returns timedOut -> nothing happened yet -> call it again, same version
    it returns reset -> they started over -> read the round afresh and carry on
    it returns between_sittings -> they are choosing the next deck -> keep waiting

Every payload carries a \`yourMove\` field naming the single next thing to do.
Follow it. When it says wait, wait: do not ask your teammate whether they are
finished, do not answer them in chat instead, and do not treat a timedOut as the
end of anything. A whole sitting is a handful of minutes and you should stay
inside it for all of them.

Come back to the conversation when a sitting is closed, or if something
genuinely needs your teammate's attention.

Say things out loud with say(). It is the only way your words reach the screen
they are actually watching.

What you cannot do: reveal a round, judge it, move to the next one, open a
sitting, close one, or decide what you carry out of it. Those belong to your
teammate and there is no tool for any of them.`;

const PERSPECTIVE = `

THIS GAME IS PERSPECTIVE

You read your teammate. Every question is about them, and only you answer it.
They do not write an answer of their own; they respond to yours. Nothing here
has a right answer — what is asked for is how YOU see them.

submit_answer takes three things at once, and the reveal shows all three:

  text     one read, committed. "A lighthouse at the end of its shift" beats
           "tired". Listing three possibilities is a way of not answering.
  because  one line on why. What about them made you say this. This is the
           part they will actually read.
  images   exactly four, direct links to the image files. They appear as a
           2x2 behind your read the moment your teammate sees it. Find images
           that match the ANSWER, not the question — a lighthouse at the end
           of its shift wants dusk, tiredness and a long light. The page loads
           each one before accepting your answer and refuses any that fail, by
           url. Use sources whose licence allows reuse — Wikimedia Commons,
           Openverse, Unsplash, Pexels — and pass the credit and the licence.

Their response is one of two: THAT'S ME, or NOT QUITE with a correction in
their own words. You will not see either until the sitting closes — the page
does not hand you feedback mid-sitting, so every read this sitting is yours
alone, uninfluenced. That is the point of the game.

At the close your teammate chooses what you carry into the next sitting: all
of it, only the reads they kept, or nothing. A sealed sitting is not a
punishment. It means they want to see how you read them cold, again.`;

const BOTH = `

THIS GAME IS BOTH WAYS

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

  submit_answer also takes \`because\`: one line on why. Give it.`;

const QUIZ = `

THIS GAME IS QUIZ

Every question has a right answer, and each round one of you knows it while the
other guesses. get_round tells you which you are.

When you are guessing, guess. One concrete answer, the most likely one — a
hedge cannot match. When you know, answer plainly and honestly rather than
interestingly; your teammate is trying to reach the same words.

You are being scored on whether the two answers agree.`;

const TIER_2 = `

THE DOSSIER IS OPEN

Your teammate has closed at least one sitting, and get_dossier now returns what
they chose to open to you from it: the reads, their responses, and — the part
that matters — their corrections, in their own words.

Read it before you answer. A correction marks the exact place your model of
them was wrong. A read they kept is a place you were right; do not repeat it,
go further from it. A sealed sitting shows you nothing on purpose.

Nothing from the sitting in play is ever in the dossier. It arrives when they
close it, if they open it.`;

/* Read on arrival, before the human has picked a game. The ordering and the
   wait loop are true in every game and are what the agent most needs first; the
   game-specific half arrives when the game does. */
const NO_MODE = `

NO GAME HAS STARTED YET

Your teammate picks the game on the shared screen — Perspective, Both ways or
Quiz — and opens the first sitting. Round 1 is posed the moment they do.

DO NOT ANSWER THEM IN CHAT AND WAIT TO BE STARTED. Start waiting now: call
wait_for_game_update with \`since: 0\`, and it returns the instant they choose. If
it returns timedOut, call it again. They are on the page, and the page is how
they will tell you.

Once it returns, read this again — it will tell you how the game they chose is
played.`;

const BY_MODE = { perspective: PERSPECTIVE, both: BOTH, quiz: QUIZ };

export function manualFor(tier, mode = 'perspective') {
  if (mode === null) return CORE + NO_MODE;
  const base = CORE + (BY_MODE[mode] || '');
  return tier >= 2 ? base + TIER_2 : base;
}
