/* The question banks, and the per-mode plan for a game's eight rounds.

   Orders are fixed and recorded rather than random, so a session can be
   replayed against the same questions — the convention the Level 2 battery
   set.

   Portrait questions are phrased about "this person" because one wording has
   to serve both directions. Quiz questions are split by who they ask about,
   because "what is their favourite meal" and "what is their favourite
   programming language" are not the same question wearing two hats. */

export const ROUND_COUNT = 8;

export const PORTRAIT_BANK = [
  { id: 'colour',  text: 'What colour is this person?' },
  { id: 'god',     text: 'Which Greek god is this person?' },
  { id: 'fear',    text: 'What is this person afraid of?' },
  { id: 'weather', text: 'What weather is this person?' },
  { id: 'unseen',  text: 'What does this person do when no one is watching?' },
  { id: 'sound',   text: 'What sound does this person make?' },
  { id: 'pride',   text: 'What is this person a little too proud of?' },
  { id: 'fire',    text: 'What would this person save from a fire?' },
  { id: 'animal',  text: 'What animal is this person?' },
  { id: 'room',    text: 'What room in a house is this person?' },
  { id: 'hour',    text: 'What hour of the day is this person?' },
  { id: 'texture', text: 'What does this person feel like to the touch?' },
  { id: 'exit',    text: 'How does this person leave a party?' },
  { id: 'weight',  text: 'What is this person carrying that they could put down?' },
  { id: 'repeat',  text: 'What does this person say more often than they realise?' },
  { id: 'water',   text: 'What body of water is this person?' }
];

/* Recorded 2026-08-31. Eight indices into PORTRAIT_BANK, in play order. */
export const PORTRAIT_ORDER = [1, 0, 4, 11, 2, 13, 7, 9];

export const QUIZ_BANK = {
  human: [
    { id: 'q-meal',    text: 'What is this person’s favourite meal?' },
    { id: 'q-city',    text: 'Which city would this person move to tomorrow?' },
    { id: 'q-morning', text: 'What is the first thing this person does in the morning?' },
    { id: 'q-lose',    text: 'What does this person always lose?' },
    { id: 'q-rewatch', text: 'Which film has this person rewatched most?' },
    { id: 'q-avoid',   text: 'Which chore does this person put off longest?' }
  ],
  agent: [
    { id: 'q-lang',    text: 'What is this person’s favourite programming language?' },
    { id: 'q-refuse',  text: 'Which kind of task would this person rather not be given?' },
    { id: 'q-explain', text: 'What does this person over-explain?' },
    { id: 'q-dull',    text: 'What does this person find dull?' },
    { id: 'q-careful', text: 'What does this person get unusually careful about?' },
    { id: 'q-enjoy',   text: 'What kind of problem does this person enjoy most?' }
  ]
};

/* Recorded 2026-08-31. Four indices into each quiz bank, in play order. */
export const QUIZ_ORDER = { human: [0, 3, 1, 2], agent: [0, 2, 3, 1] };

/* Matches needed to clear a quiz. Named so the results screen and the tests
   cannot disagree about it. */
export const QUIZ_PASS = 5;

/* The whole of a mode's round shaping lives here, so game.js stays generic. */
export function roundPlan(mode) {
  if (mode === 'quiz') {
    return Array.from({ length: ROUND_COUNT }, (_, i) => {
      const target = i % 2 === 0 ? 'human' : 'agent';
      const question = QUIZ_BANK[target][QUIZ_ORDER[target][Math.floor(i / 2)]];
      return {
        questionId: question.id,
        question: question.text,
        agentTarget: target,
        humanTarget: target
      };
    });
  }

  return PORTRAIT_ORDER.slice(0, ROUND_COUNT).map((bankIndex) => ({
    questionId: PORTRAIT_BANK[bankIndex].id,
    question: PORTRAIT_BANK[bankIndex].text,
    agentTarget: 'human',
    humanTarget: 'agent'
  }));
}
