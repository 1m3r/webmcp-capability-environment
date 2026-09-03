/* Shared moves for the tests. Not a test file itself — the runner matches
   *.test.js, and a helper that lived in a test file would re-run that file's
   tests inside every importer. */

import assert from 'node:assert/strict';
import { createDoc, reduce, isComplete } from '../src/games/mirror/game.js';
import { decksFor } from '../src/games/mirror/questions.js';

export const four = (tag = 'x') => Array.from({ length: 4 }, (_, i) => ({
  url: `https://images.example/${tag}-${i}.jpg`,
  credit: `Photographer ${i}`,
  license: 'CC BY 4.0'
}));

export const GOOD = { perspective: 'me', both: 'landed', quiz: 'match' };

export function open(doc, deckId) {
  const id = deckId || decksFor(doc.mode)[0].id;
  const r = reduce(doc, { type: 'open_sitting', deckId: id });
  assert.equal(r.ok, true, r.message);
  return r.doc;
}

/* Play every round of the sitting in play to judged, with the mode's good
   verdict except where `verdicts` says otherwise. Answers are `agent N` and
   `human N`; perspective corrections are `correction N`. */
export function playOut(doc, verdicts = []) {
  const perspective = doc.mode === 'perspective';
  const move = (action) => {
    const r = reduce(doc, action);
    assert.equal(r.ok, true, `${action.type} at round ${doc.roundIndex + 1}: ${r.message}`);
    doc = r.doc;
  };
  let guard = 0;
  /* Resumes from wherever the sitting is, so a test can play a round by hand
     and then hand the rest over. */
  while (!isComplete(doc) && guard++ < 100) {
    const i = doc.roundIndex;
    const round = doc.rounds[i];
    if (round.state === 'posed') {
      move({
        type: 'agent_submit', text: `agent ${i}`, because: `because ${i}`,
        images: perspective ? four(`r${i}`) : undefined
      });
    } else if (round.state === 'agent_committed' && !perspective) {
      move({ type: 'human_submit', text: `human ${i}` });
    } else if (round.state === 'agent_committed' || round.state === 'both_committed') {
      move({ type: 'reveal' });
    } else if (round.state === 'revealed') {
      move({ type: 'judge', verdict: verdicts[i] || GOOD[doc.mode], correction: `correction ${i}` });
    } else if (round.state === 'judged') {
      move({ type: 'next' });
    }
  }
  assert.equal(isComplete(doc), true);
  return doc;
}

export function close(doc, grant = 'open') {
  const r = reduce(doc, { type: 'close_sitting', grant });
  assert.equal(r.ok, true, r.message);
  return r.doc;
}

/* A portrait with one closed sitting, of the given mode and grant. */
export function afterOne(mode = 'both', grant = 'open', verdicts = []) {
  return close(playOut(open(createDoc(0, { mode })), verdicts), grant);
}
