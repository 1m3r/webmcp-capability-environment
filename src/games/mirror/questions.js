/* The question bank. A run draws ROUND_COUNT questions in SEED_ORDER.

   The order is fixed and recorded rather than random, so a session can be
   replayed against the same questions — the convention the Level 2 battery
   set. Questions are phrased about "this person" so one wording serves both
   subjects. */

export const BANK = [
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

/* Recorded 2026-08-31. Eight indices into BANK, in play order. */
export const SEED_ORDER = [1, 0, 4, 11, 2, 13, 7, 9];

export const ROUND_COUNT = 8;

/* The subject alternates and starts with the human, so each side is asked
   about four times. */
export function subjectFor(index) {
  return index % 2 === 0 ? 'human' : 'agent';
}
