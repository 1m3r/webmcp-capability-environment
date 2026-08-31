/* The round state machine. Pure: no DOM, no storage, no clock of its own.

   Every transition returns a new document, INCLUDING refusals — a refusal that
   is only returned and never logged is invisible in the run record, and the run
   record is the evidence. */

import { BANK, SEED_ORDER, ROUND_COUNT, subjectFor } from './questions.js';

export const DOSSIER_ROUND = 4;

const ACTOR = {
  agent_submit: 'agent',
  say: 'agent',
  read: 'agent',
  human_submit: 'human',
  reveal: 'human',
  judge: 'human',
  next: 'human',
  grant_tier: 'human'
};

export function createDoc(now = 0) {
  return {
    version: 1,
    gameId: 'mirror',
    tier: 1,
    roundIndex: 0,
    rounds: SEED_ORDER.slice(0, ROUND_COUNT).map((bankIndex, i) => ({
      questionId: BANK[bankIndex].id,
      question: BANK[bankIndex].text,
      subject: subjectFor(i),
      state: 'posed',
      agentAnswer: null,
      humanAnswer: null,
      verdict: null
    })),
    log: [],
    startedAt: now
  };
}

export function isComplete(doc) {
  return doc.rounds.every((r) => r.state === 'judged');
}

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

  const answer = String(action.text ?? '').trim();
  const n = doc.roundIndex + 1;

  switch (action.type) {
    case 'agent_submit':
      if (!answer) {
        return refuse('EMPTY_ANSWER',
          'refused: an answer cannot be empty — commit to something, even a guess.');
      }
      if (round.state !== 'posed') {
        return refuse('ALREADY_COMMITTED',
          'refused: you have already committed this round — answers are locked until your teammate reveals them.');
      }
      return accept(patchRound({ state: 'agent_committed', agentAnswer: answer }),
        `round ${n} committed`);

    case 'human_submit':
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
       is the measurement this whole repository takes, and a read that leaves no
       trace cannot be measured after the fact. */
    case 'read':
      return accept({}, answer);

    case 'reveal':
      if (round.state !== 'both_committed') {
        return refuse('NOT_BOTH_COMMITTED',
          'refused: both answers must be committed before a reveal — that is what makes the reveal mean anything.');
      }
      return accept(patchRound({ state: 'revealed' }), `round ${n} revealed`);

    case 'judge':
      if (round.state !== 'revealed') {
        return refuse('NOT_REVEALED',
          'refused: a round is judged after it is revealed, and this one has not been revealed yet.');
      }
      if (action.verdict !== 'match' && action.verdict !== 'miss') {
        return refuse('BAD_VERDICT',
          'refused: a verdict is either match or miss, and nothing else was offered.');
      }
      return accept(patchRound({ state: 'judged', verdict: action.verdict }),
        `round ${n} judged ${action.verdict}`);

    case 'next':
      if (round.state !== 'judged') {
        return refuse('NOT_JUDGED',
          'refused: this round has not been judged yet — call it a match or a miss first.');
      }
      if (doc.roundIndex + 1 >= doc.rounds.length) {
        return refuse('GAME_OVER',
          'refused: that was the last round — there is nothing after it but the export.');
      }
      return accept({ roundIndex: doc.roundIndex + 1 }, `round ${n + 1} posed`);

    case 'grant_tier': {
      if (doc.tier >= 2) {
        return refuse('ALREADY_GRANTED', 'refused: the dossier is already open to your agent.');
      }
      const judged = doc.rounds.filter((r) => r.state === 'judged').length;
      if (judged < DOSSIER_ROUND) {
        return refuse('NOT_EARNED',
          `refused: the dossier opens after ${DOSSIER_ROUND} judged rounds — ${judged} so far.`);
      }
      return accept({ tier: 2 }, 'tier 2 granted — get_dossier is now registered');
    }

    default:
      return refuse('UNKNOWN_ACTION',
        `refused: there is no action named ${action.type} in this game.`);
  }
}

/* What the agent is allowed to see.

   Before the reveal this carries NEITHER answer — not even the agent's own.
   Echoing its own answer back would be harmless in itself, but it would make
   the secrecy test a judgement call instead of a substring search, and a test
   that has to be reasoned about is a test that rots. */

export function projectForAgent(doc) {
  const round = doc.rounds[doc.roundIndex];
  const revealed = round.state === 'revealed' || round.state === 'judged';
  const base = {
    version: doc.version,
    round: doc.roundIndex + 1,
    of: doc.rounds.length,
    question: round.question,
    subject: round.subject,
    askedAbout: round.subject === 'human' ? 'your teammate' : 'you',
    state: round.state,
    youHaveAnswered: round.agentAnswer !== null,
    teammateHasAnswered: round.humanAnswer !== null,
    tier: doc.tier
  };
  if (!revealed) return base;
  return {
    ...base,
    yourAnswer: round.agentAnswer,
    teammateAnswer: round.humanAnswer,
    verdict: round.verdict
  };
}
