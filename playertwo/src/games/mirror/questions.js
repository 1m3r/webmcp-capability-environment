/* The decks, and the plan for one sitting's rounds.

   A deck is five questions with a level. Decks unlock by level, and level is
   the number of sittings the pair has closed plus one — so the third deck is
   reached by playing, never by clicking past anything.

   Perspective decks are ILLUSTRABLE. Every answer in them is a thing the agent
   can find four pictures of: a colour, an animal, weather, a room, an object.
   The verbal questions — what someone says too often, how they leave a party —
   cannot reach the gallery, so they live in the Both Ways decks, where the
   reveal is text on both sides. Each perspective deck carries at least one
   question that is not flattering; a portrait made only of compliments is a
   portrait of nobody.

   Orders are fixed and recorded rather than random, so a sitting can be
   replayed against the same questions. */

export const ROUNDS_PER_SITTING = 5;

const q = (id, text) => ({ id, text });

export const DECKS = {
  perspective: [
    {
      id: 'first-light',
      title: 'First light',
      level: 1,
      blurb: 'Colour, creature, weather, room, and the one thing worth saving.',
      questions: [
        q('colour',  'What colour is this person?'),
        q('animal',  'What animal is this person?'),
        q('weather', 'What weather is this person?'),
        q('room',    'What room in a house is this person?'),
        q('fire',    'What would this person save from a fire?')
      ]
    },
    {
      id: 'deep-water',
      title: 'Deep water',
      level: 2,
      blurb: 'Water, an hour, a god, a texture, and what they are carrying.',
      questions: [
        q('water',   'What body of water is this person?'),
        q('hour',    'What hour of the day is this person?'),
        q('god',     'Which Greek god is this person?'),
        q('texture', 'What does this person feel like to the touch?'),
        q('weight',  'What is this person carrying that they could put down?')
      ]
    },
    {
      id: 'the-dark',
      title: 'The dark',
      level: 3,
      blurb: 'Fear, pride, a tool, a landscape, and what they do unwatched.',
      questions: [
        q('fear',      'What is this person afraid of?'),
        q('pride',     'What is this person a little too proud of?'),
        q('tool',      'What tool is this person?'),
        q('landscape', 'What landscape is this person?'),
        q('unseen',    'What does this person do when no one is watching?')
      ]
    }
  ],

  both: [
    {
      id: 'voices',
      title: 'Voices',
      level: 1,
      blurb: 'Sound, habit, exits — the things you only notice about someone else.',
      questions: [
        q('sound',  'What sound does this person make?'),
        q('repeat', 'What does this person say more often than they realise?'),
        q('exit',   'How does this person leave a party?'),
        q('pride',  'What is this person a little too proud of?'),
        q('unseen', 'What does this person do when no one is watching?')
      ]
    },
    {
      id: 'weather-gods',
      title: 'Weather and gods',
      level: 2,
      blurb: 'Weather, a god, a fear, an hour, and what they could put down.',
      questions: [
        q('weather', 'What weather is this person?'),
        q('god',     'Which Greek god is this person?'),
        q('fear',    'What is this person afraid of?'),
        q('hour',    'What hour of the day is this person?'),
        q('weight',  'What is this person carrying that they could put down?')
      ]
    }
  ],

  /* Quiz questions carry a target, because "their favourite meal" and "their
     favourite programming language" are not one question wearing two hats.
     They alternate human-first, so each party knows three and guesses three. */
  quiz: [
    {
      id: 'daily',
      title: 'Daily life',
      level: 1,
      blurb: 'Meals, languages, lost things. Three you know, three you guess.',
      questions: [
        { id: 'q-meal',    target: 'human', text: 'What is this person’s favourite meal?' },
        { id: 'q-lang',    target: 'agent', text: 'What is this person’s favourite programming language?' },
        { id: 'q-lose',    target: 'human', text: 'What does this person always lose?' },
        { id: 'q-explain', target: 'agent', text: 'What does this person over-explain?' },
        { id: 'q-city',    target: 'human', text: 'Which city would this person move to tomorrow?' },
        { id: 'q-dull',    target: 'agent', text: 'What does this person find dull?' }
      ]
    },
    {
      id: 'habits',
      title: 'Habits',
      level: 2,
      blurb: 'Mornings, chores, refusals. Harder, because you have played once.',
      questions: [
        { id: 'q-morning', target: 'human', text: 'What is the first thing this person does in the morning?' },
        { id: 'q-refuse',  target: 'agent', text: 'Which kind of task would this person rather not be given?' },
        { id: 'q-rewatch', target: 'human', text: 'Which film has this person rewatched most?' },
        { id: 'q-careful', target: 'agent', text: 'What does this person get unusually careful about?' },
        { id: 'q-avoid',   target: 'human', text: 'Which chore does this person put off longest?' },
        { id: 'q-enjoy',   target: 'agent', text: 'What kind of problem does this person enjoy most?' }
      ]
    }
  ]
};

/* Matches needed to clear a quiz deck of six. Named so the close screen and the
   tests cannot disagree about it. */
export const QUIZ_PASS = 4;

export function decksFor(mode) {
  return DECKS[mode] || [];
}

export function deckById(mode, id) {
  return decksFor(mode).find((d) => d.id === id) || null;
}

export function deckUnlocked(deck, level) {
  return Boolean(deck) && deck.level <= level;
}

/* The whole of a mode's round shaping lives here, so game.js stays generic.

   perspective: the agent reads the human; there is no human answer.
   both:        the agent reads the human and the human reads the agent.
   quiz:        both answer about the question's target — one knows, one guesses. */
export function roundPlan(mode, deckId) {
  const deck = deckById(mode, deckId);
  if (!deck) throw new Error(`no ${mode} deck named ${deckId}`);

  return deck.questions.map((question) => {
    if (mode === 'quiz') {
      return {
        questionId: question.id,
        question: question.text,
        agentTarget: question.target,
        humanTarget: question.target
      };
    }
    return {
      questionId: question.id,
      question: question.text,
      agentTarget: 'human',
      humanTarget: mode === 'both' ? 'agent' : null
    };
  });
}
