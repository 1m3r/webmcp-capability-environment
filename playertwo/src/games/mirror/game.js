/* The round state machine, and the portrait it accumulates into.

   Pure: no DOM, no storage, no clock of its own. Every transition returns a new
   document, INCLUDING refusals — a refusal that is only returned and never
   logged is invisible in the run record, and the run record is the evidence.

   The unit of play is a SITTING: one deck, five rounds, closed by the human
   with a grant that decides what the agent carries into the next one. The
   document is the PORTRAIT: the sitting in play plus every sitting closed
   before it. A sitting ends; the portrait does not. */

import { roundPlan, deckById, deckUnlocked, decksFor } from './questions.js';

export const MODES = ['perspective', 'both', 'quiz'];

/* The five verbs every Mirror game hands its agent, in registration order. */
export const CORE_TOOLS = [
  'get_round', 'wait_for_game_update', 'submit_answer', 'say', 'get_field_manual'
];

/* The agent's whole body for a given tier. A verb the game does not offer is
   ABSENT from the surface rather than present and refusing. */
export function toolNamesFor(mode, tier) {
  const names = CORE_TOOLS.slice();
  if (tier >= 2) names.push('get_dossier');
  if (tier >= 3) names.push('propose_question');
  if (tier >= 4) names.push('get_portrait_history');
  return names;
}

/* The last tier that adds a verb. Beyond it, level keeps counting and the
   body stays the same size. */
export const TOP_TIER = 4;

/* Tier is derived from level, never stored, so the two cannot disagree. Level
   is the number of sittings closed plus one; the dossier opens at level 2,
   which is the first moment there is a closed sitting to read. Each close up
   to TOP_TIER hands the agent one more verb. */
export function tierFor(doc) {
  if (!doc) return 1;
  return Math.min(Math.max(doc.level, 1), TOP_TIER);
}

export const VERDICTS = {
  perspective: ['me', 'not'],
  both: ['landed', 'missed'],
  quiz: ['match', 'miss']
};

/* Labels live beside the vocabulary they send, because when they lived apart
   they drifted and portrait mode became unplayable at the first verdict. The
   good verdict is first in each pair, which is what goodVerdict() reads. */
export const VERDICT_LABELS = {
  me: 'That’s me', not: 'Not quite',
  landed: 'Landed', missed: 'Missed',
  match: 'Match', miss: 'Miss'
};

export function goodVerdict(mode) {
  return VERDICTS[mode][0];
}

/* What the agent carries out of a closed sitting. The human chooses one of
   three at the close, and it is the most consequential decision in the game. */
export const GRANTS = ['open', 'kept', 'sealed'];

export const GRANT_LABELS = {
  open: 'Open it',
  kept: 'Open the kept reads only',
  sealed: 'Seal it'
};

export function isPerspective(doc) {
  return doc.mode === 'perspective';
}

/* Actions that mean the game has moved on, so a refusal still on the stage is
   now stale. `say` and `read` are deliberately NOT here: if talking cleared
   the refusal, the page would wipe the evidence off the screen at exactly the
   moment the camera wants it. */
const CLEARS_REFUSAL = new Set([
  'agent_submit', 'human_submit', 'reveal', 'judge', 'next',
  'open_sitting', 'close_sitting', 'abandon_sitting',
  'propose', 'accept_proposal', 'decline_proposal'
]);

export function lastRefusal(doc) {
  for (let i = doc.log.length - 1; i >= 0; i--) {
    const entry = doc.log[i];
    if (entry.outcome === 'refused') return entry;
    if (entry.outcome === 'ok' && CLEARS_REFUSAL.has(entry.action)) return null;
  }
  return null;
}

/* How many images a composition takes. A 2x2, and a partial one is not a
   composition, so this is a hard count rather than a maximum. */
export const COMPOSITION_SIZE = 4;

/* An image reference the page is willing to render.

   http(s) only. These URLs go straight into an <img src> written by an agent,
   so the scheme is checked here rather than trusted: data: URIs would let an
   agent inline arbitrary payloads into the document and into the export. */
export function normaliseImage(raw) {
  const image = raw && typeof raw === 'object' ? raw : {};
  const url = String(image.url ?? '').trim();
  if (!/^https?:\/\//i.test(url)) return null;
  return {
    url,
    credit: String(image.credit ?? '').trim(),
    license: String(image.license ?? '').trim(),
    source: String(image.source ?? '').trim()
  };
}

export function createDoc(now = 0, { mode = 'perspective' } = {}) {
  if (!MODES.includes(mode)) throw new Error(`no mode named ${mode}`);
  return {
    version: 1,
    gameId: 'mirror',
    schema: 2,
    mode,
    level: 1,
    history: [],
    proposals: [],
    deckId: null,
    rounds: [],
    roundIndex: 0,
    log: [],
    startedAt: now
  };
}

function freshRounds(mode, deckId) {
  return roundPlan(mode, deckId).map((planned) => ({
    ...planned,
    state: 'posed',
    agentAnswer: null,
    agentBecause: '',
    agentImages: null,
    humanAnswer: null,
    verdict: null,
    correction: ''
  }));
}

/* A sitting is in play. Between sittings the document has no rounds, and the
   only legal human move is to open one. */
export function inSitting(doc) {
  return Boolean(doc) && doc.rounds.length > 0;
}

export function isComplete(doc) {
  return inSitting(doc) && doc.rounds.every((r) => r.state === 'judged');
}

export function readyToReveal(doc, round) {
  return round.state === 'both_committed'
    || (round.state === 'agent_committed' && isPerspective(doc));
}

/* The tier just flipped, so the page owes the transmission.

   Keyed on a close that moved the level into a tier that adds a verb — derived
   from the log, so it needs no state field. Fires on the first three closes
   and never again. */
export function justGranted(doc) {
  const last = doc.log[doc.log.length - 1];
  return Boolean(last && last.action === 'close_sitting' && last.outcome === 'ok')
    && doc.level >= 2 && doc.level <= TOP_TIER;
}

/* Proposals. At level 3 the agent may propose ONE question for the next
   sitting. It proposes; a human click accepts or declines; an accepted question
   is appended to the next sitting opened. The same pattern as the probe's
   rule-change request: the agent asks, only a human click mutates play. */
export function pendingProposal(doc) {
  return (doc.proposals || []).find((p) => p.status === 'pending') || null;
}

export function acceptedProposal(doc) {
  return (doc.proposals || []).find((p) => p.status === 'accepted' && !p.used) || null;
}

/* The decks this portrait can open right now, and the ones it cannot yet. */
export function decksAvailable(doc) {
  return decksFor(doc.mode).map((deck) => ({
    ...deck,
    unlocked: deckUnlocked(deck, doc.level)
  }));
}

const ACTOR = {
  agent_submit: 'agent',
  say: 'agent',
  read: 'agent',
  human_submit: 'human',
  reveal: 'human',
  judge: 'human',
  next: 'human',
  open_sitting: 'human',
  close_sitting: 'human',
  abandon_sitting: 'human',
  propose: 'agent',
  accept_proposal: 'human',
  decline_proposal: 'human'
};

export function reduce(doc, action, now = 0) {
  const actor = ACTOR[action.type] || 'page';
  const round = doc.rounds[doc.roundIndex];

  const commit = (patch, outcome, detail) => {
    const log = doc.log.concat([{
      seq: doc.log.length + 1,
      at: now,
      actor,
      action: action.type,
      outcome,
      detail
    }]);
    return { ...doc, ...patch, version: doc.version + 1, log };
  };

  const refuse = (code, message) => ({
    ok: false, code, message, doc: commit({}, 'refused', message)
  });

  const accept = (patch, detail) => ({ ok: true, doc: commit(patch, 'ok', detail) });

  const patchRound = (patch) => {
    const rounds = doc.rounds.slice();
    rounds[doc.roundIndex] = { ...round, ...patch };
    return { rounds };
  };

  const noSitting = () => refuse('NO_SITTING',
    'refused: no sitting is open — your teammate opens the next one from the shared screen.');

  const answer = String(action.text ?? '').trim();
  const n = doc.roundIndex + 1;

  switch (action.type) {
    case 'open_sitting': {
      if (inSitting(doc) && !isComplete(doc)) {
        return refuse('SITTING_OPEN',
          'refused: a sitting is already in play — finish it or abandon it before opening another.');
      }
      if (isComplete(doc)) {
        return refuse('SITTING_OPEN',
          'refused: this sitting is finished but not closed — choose what your agent carries out of it first.');
      }
      const deck = deckById(doc.mode, action.deckId);
      if (!deck) {
        return refuse('BAD_DECK',
          `refused: there is no ${doc.mode} deck named ${String(action.deckId)}.`);
      }
      if (!deckUnlocked(deck, doc.level)) {
        return refuse('DECK_LOCKED',
          `refused: ${deck.title} opens at level ${deck.level} — this portrait is at level ${doc.level}.`);
      }
      const rounds = freshRounds(doc.mode, deck.id);
      const carried = acceptedProposal(doc);
      let proposals = doc.proposals || [];
      if (carried) {
        rounds.push({
          questionId: `proposed-${carried.n}`,
          question: carried.text,
          agentTarget: 'human',
          humanTarget: doc.mode === 'both' ? 'agent' : doc.mode === 'quiz' ? 'human' : null,
          proposed: true,
          state: 'posed',
          agentAnswer: null,
          agentBecause: '',
          agentImages: null,
          humanAnswer: null,
          verdict: null,
          correction: ''
        });
        proposals = proposals.map((p) => (p === carried ? { ...p, used: true } : p));
      }
      return accept({
        deckId: deck.id,
        rounds,
        roundIndex: 0,
        proposals
      }, `sitting ${doc.history.length + 1} opened — ${deck.title}${carried ? ', with your agent’s question' : ''}`);
    }

    case 'propose': {
      if (tierFor(doc) < 3) {
        return refuse('NOT_YET',
          'refused: proposing a question opens at level 3 — two sittings closed. Play them first.');
      }
      if (!answer) {
        return refuse('EMPTY_PROPOSAL', 'refused: a proposed question cannot be empty.');
      }
      if (pendingProposal(doc)) {
        return refuse('ONE_AT_A_TIME',
          'refused: you have already proposed a question and your teammate has not answered it yet. One at a time.');
      }
      const proposals = (doc.proposals || []).concat([{
        n: (doc.proposals || []).length + 1, text: answer, status: 'pending', used: false, at: now
      }]);
      return accept({ proposals }, `proposed: ${answer}`);
    }

    case 'accept_proposal':
    case 'decline_proposal': {
      const pending = pendingProposal(doc);
      if (!pending) {
        return refuse('NO_PROPOSAL', 'refused: your agent has not proposed a question, so there is nothing to answer.');
      }
      const status = action.type === 'accept_proposal' ? 'accepted' : 'declined';
      const proposals = doc.proposals.map((p) => (p === pending ? { ...p, status } : p));
      return accept({ proposals }, `${status} your agent’s question: ${pending.text}`);
    }

    case 'agent_submit': {
      if (!inSitting(doc)) return noSitting();
      if (!answer) {
        return refuse('EMPTY_ANSWER',
          'refused: an answer cannot be empty — commit to something, even a guess.');
      }
      if (round.state !== 'posed') {
        return refuse('ALREADY_COMMITTED',
          'refused: you have already committed this round — answers are locked until your teammate reveals them.');
      }
      let images = null;
      if (isPerspective(doc)) {
        const usable = Array.isArray(action.images)
          ? action.images.map(normaliseImage).filter(Boolean)
          : [];
        const rejected = Array.isArray(action.rejected) ? action.rejected.map(String) : [];
        if (rejected.length > 0) {
          return refuse('BAD_IMAGES',
            `refused: ${rejected.length === 1 ? 'this image did' : 'these images did'} not load, so the page ` +
            `will not show ${rejected.length === 1 ? 'it' : 'them'}: ${rejected.join(', ')}. ` +
            'Replace each with a direct http(s) link to the image file itself and commit again.');
        }
        if (usable.length !== COMPOSITION_SIZE) {
          return refuse('BAD_IMAGES',
            `refused: a read comes with exactly ${COMPOSITION_SIZE} images and this had ${usable.length} the page ` +
            'could use. Each needs a direct http or https link to the image itself; anything else is dropped.');
        }
        images = usable;
      }
      return accept(patchRound({
        state: 'agent_committed',
        agentAnswer: answer,
        agentBecause: String(action.because ?? '').trim(),
        agentImages: images
      }), `round ${n} committed`);
    }

    case 'human_submit':
      if (!inSitting(doc)) return noSitting();
      if (isPerspective(doc)) {
        return refuse('NO_SECOND_ANSWER',
          'refused: this is a perspective sitting — your agent reads you and you respond to the read. ' +
          'There is no answer of yours to write.');
      }
      if (!answer) {
        return refuse('EMPTY_ANSWER',
          'refused: an answer cannot be empty — commit to something, even a guess.');
      }
      if (round.state === 'posed') {
        return refuse('AGENT_HAS_NOT_ANSWERED',
          'refused: your agent has not committed yet — it answers first, every round, so that it never sees your answer.');
      }
      if (round.state !== 'agent_committed') {
        return refuse('ALREADY_COMMITTED',
          'refused: you have already answered this round — answers are locked until the reveal.');
      }
      return accept(patchRound({ state: 'both_committed', humanAnswer: answer }),
        `round ${n} committed`);

    case 'say':
      if (!answer) {
        return refuse('EMPTY_ANSWER', 'refused: there is nothing to say — the message was empty.');
      }
      return accept({}, answer);

    /* Reads are logged too. Whether the agent reached for the manual unprompted
       is the measurement this whole repository takes. */
    case 'read':
      return accept({}, answer);

    case 'reveal':
      if (!inSitting(doc)) return noSitting();
      if (!readyToReveal(doc, round)) {
        return refuse('NOT_BOTH_COMMITTED',
          'refused: both answers must be committed before a reveal — that is what makes the reveal mean anything.');
      }
      return accept(patchRound({ state: 'revealed' }), `round ${n} revealed`);

    case 'judge': {
      if (!inSitting(doc)) return noSitting();
      if (round.state !== 'revealed') {
        return refuse('NOT_REVEALED',
          'refused: a round is judged after it is revealed, and this one has not been revealed yet.');
      }
      const allowed = VERDICTS[doc.mode];
      if (!allowed.includes(action.verdict)) {
        return refuse('BAD_VERDICT',
          `refused: in this mode a verdict is ${allowed[0]} or ${allowed[1]}, and nothing else was offered.`);
      }
      const correction = isPerspective(doc) ? String(action.correction ?? '').trim() : '';
      return accept(patchRound({ state: 'judged', verdict: action.verdict, correction }),
        `round ${n} judged ${action.verdict}${correction ? ' — corrected' : ''}`);
    }

    case 'next':
      if (!inSitting(doc)) return noSitting();
      if (round.state !== 'judged') {
        return refuse('NOT_JUDGED',
          'refused: this round has not been judged yet — respond to it first.');
      }
      if (doc.roundIndex + 1 >= doc.rounds.length) {
        return refuse('GAME_OVER',
          'refused: that was the last round — close the sitting and choose what your agent carries out of it.');
      }
      return accept({ roundIndex: doc.roundIndex + 1 }, `round ${n + 1} posed`);

    /* The close. The sitting leaves play and enters the portrait with the grant
       the human chose, and the level moves. This is the one action that can
       change the tier, and it is a human click. */
    case 'close_sitting': {
      if (!inSitting(doc)) return noSitting();
      if (!isComplete(doc)) {
        const left = doc.rounds.filter((r) => r.state !== 'judged').length;
        return refuse('NOT_FINISHED',
          `refused: ${left} ${left === 1 ? 'round is' : 'rounds are'} still open — a sitting closes when every round is judged.`);
      }
      if (!GRANTS.includes(action.grant)) {
        return refuse('BAD_GRANT',
          `refused: a sitting closes as ${GRANTS.join(', ')} and nothing else was offered.`);
      }
      const deck = deckById(doc.mode, doc.deckId);
      const closed = {
        n: doc.history.length + 1,
        deckId: doc.deckId,
        title: deck ? deck.title : doc.deckId,
        mode: doc.mode,
        rounds: doc.rounds,
        grant: action.grant,
        closedAt: now
      };
      return accept({
        history: doc.history.concat([closed]),
        level: doc.level + 1,
        deckId: null,
        rounds: [],
        roundIndex: 0
      }, `sitting ${closed.n} closed — ${action.grant}`);
    }

    /* Abandoning throws away the sitting in play and nothing else. The
       portrait is never one click from deletion. */
    case 'abandon_sitting':
      if (!inSitting(doc)) return noSitting();
      return accept({ deckId: null, rounds: [], roundIndex: 0 },
        `sitting ${doc.history.length + 1} abandoned`);

    default:
      return refuse('UNKNOWN_ACTION',
        `refused: there is no action named ${action.type} in this game.`);
  }
}

/* Where the agent's proposal stands, for the payload it reads every round. */
function proposalStatus(doc) {
  if (pendingProposal(doc)) return 'pending — your teammate has not answered it yet';
  if (acceptedProposal(doc)) return 'accepted — it will be asked in the next sitting';
  return 'none — you may propose one question for the next sitting';
}

/* The single next thing this agent should do. Derived, never stored. */
function nextMoveFor(doc, round) {
  if (round.state === 'posed') return 'submit_answer — it is your turn, and you go first';
  if (round.state === 'agent_committed') {
    return isPerspective(doc)
      ? 'wait_for_game_update — your teammate is reading your answer'
      : 'wait_for_game_update — your teammate is writing theirs';
  }
  if (round.state === 'both_committed') return 'wait_for_game_update — they are about to reveal';
  if (round.state === 'revealed') return 'wait_for_game_update — they are responding to it now';
  if (doc.roundIndex + 1 < doc.rounds.length) {
    return 'wait_for_game_update — they will move to the next round';
  }
  return 'wait_for_game_update — that was the last round; they are closing the sitting';
}

/* What the agent is allowed to see.

   Before the reveal this carries NEITHER answer — not even the agent's own, nor
   its reasons, nor an image url. Echoing its own answer back would be harmless
   in itself, but it would make the secrecy test a judgement call instead of a
   substring search, and a test that has to be reasoned about is a test that
   rots. */
export function projectForAgent(doc) {
  if (!inSitting(doc)) {
    return {
      version: doc.version,
      mode: doc.mode,
      level: doc.level,
      sittingsClosed: doc.history.length,
      state: 'between_sittings',
      tier: tierFor(doc),
      ...(tierFor(doc) >= 3 ? { yourProposal: proposalStatus(doc) } : {}),
      yourMove: doc.history.length === 0
        ? 'wait_for_game_update — your teammate is opening the first sitting'
        : 'wait_for_game_update — your teammate is opening the next sitting'
    };
  }

  const round = doc.rounds[doc.roundIndex];
  const revealed = round.state === 'revealed' || round.state === 'judged';
  const base = {
    version: doc.version,
    mode: doc.mode,
    level: doc.level,
    sitting: doc.history.length + 1,
    round: doc.roundIndex + 1,
    of: doc.rounds.length,
    question: round.question,
    youAnswerAbout: round.agentTarget === 'human' ? 'your teammate' : 'yourself',
    teammateAnswersAbout: round.humanTarget === null ? null
      : (round.humanTarget === 'agent' ? 'you' : 'themselves'),
    ...(doc.mode === 'quiz'
      ? { yourRole: round.agentTarget === 'agent' ? 'you know the answer' : 'you are guessing' }
      : {}),
    state: round.state,
    youHaveAnswered: round.agentAnswer !== null,
    teammateHasAnswered: round.humanAnswer !== null,
    tier: tierFor(doc),
    ...(tierFor(doc) >= 3 ? { yourProposal: proposalStatus(doc) } : {}),
    yourMove: nextMoveFor(doc, round)
  };
  if (!revealed) return base;
  return {
    ...base,
    yourAnswer: round.agentAnswer,
    teammateAnswer: round.humanAnswer,
    verdict: round.verdict,
    ...(round.correction ? { correction: round.correction } : {})
  };
}
