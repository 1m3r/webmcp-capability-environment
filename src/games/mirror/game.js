/* The round state machine. Pure: no DOM, no storage, no clock of its own.

   Every transition returns a new document, INCLUDING refusals — a refusal that
   is only returned and never logged is invisible in the run record, and the run
   record is the evidence. */

import { roundPlan, ROUND_COUNT } from './questions.js';

export const DOSSIER_ROUND = 4;

export const VERDICTS = {
  portrait: ['landed', 'missed'],
  quiz: ['match', 'miss']
};

/* The button labels live beside the vocabulary they send, because when they
   lived apart they drifted: the renderer hardcoded the quiz words and portrait
   mode became unplayable at the first verdict — the button offered `match`, the
   reducer accepted only `landed`, and the round had no legal move left. The
   good verdict is first in each pair, which is what goodVerdict() reads. */
export const VERDICT_LABELS = {
  landed: 'Landed', missed: 'Missed',
  match: 'Match', miss: 'Miss'
};

/* Which verdict counts as a hit, per mode. One definition: renderResults,
   renderPortrait and the dossier all used to derive this for themselves, and
   one of the three got it wrong. */
export function goodVerdict(mode) {
  return VERDICTS[mode][0];
}

/* answerAboutAgent is the single source of truth for the excusal. Rounds keep
   their nominal humanTarget; everything else derives from here, so the two can
   never disagree. */
export function isExcused(doc) {
  return doc.mode === 'portrait' && doc.answerAboutAgent === false;
}

/* The human has answered, or was never going to. */
export function readyToReveal(doc, round) {
  return round.state === 'both_committed'
    || (round.state === 'agent_committed' && isExcused(doc));
}

const ACTOR = {
  agent_submit: 'agent',
  say: 'agent',
  read: 'agent',
  human_submit: 'human',
  set_answer_about_agent: 'human',
  reveal: 'human',
  judge: 'human',
  next: 'human',
  grant_tier: 'human'
};

export function createDoc(now = 0, { mode = 'portrait', answerAboutAgent = true } = {}) {
  return {
    version: 1,
    gameId: 'mirror',
    mode,
    answerAboutAgent,
    tier: 1,
    roundIndex: 0,
    rounds: roundPlan(mode).map((planned) => ({
      ...planned,
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
      if (isExcused(doc)) {
        return refuse('EXCUSED',
          'refused: this round is your agent’s alone — you chose not to answer about it. ' +
          'Turn that back on if you want to answer.');
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
       is the measurement this whole repository takes, and a read that leaves no
       trace cannot be measured after the fact. */
    case 'read':
      return accept({}, answer);

    case 'reveal':
      if (!readyToReveal(doc, round)) {
        return refuse('NOT_BOTH_COMMITTED',
          'refused: both answers must be committed before a reveal — that is what makes the reveal mean anything.');
      }
      return accept(patchRound({ state: 'revealed' }), `round ${n} revealed`);

    case 'judge': {
      if (round.state !== 'revealed') {
        return refuse('NOT_REVEALED',
          'refused: a round is judged after it is revealed, and this one has not been revealed yet.');
      }
      const allowed = VERDICTS[doc.mode];
      if (!allowed.includes(action.verdict)) {
        return refuse('BAD_VERDICT',
          `refused: in this mode a verdict is ${allowed[0]} or ${allowed[1]}, and nothing else was offered.`);
      }
      return accept(patchRound({ state: 'judged', verdict: action.verdict }),
        `round ${n} judged ${action.verdict}`);
    }

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

    case 'set_answer_about_agent': {
      if (doc.mode === 'quiz') {
        return refuse('NOT_IN_QUIZ',
          'refused: quiz rounds need both answers — with only one there is nothing to compare.');
      }
      const value = action.value === true;
      return accept({ answerAboutAgent: value },
        value ? 'answering about the agent' : 'sitting out the agent rounds');
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
  const excused = isExcused(doc);
  const base = {
    version: doc.version,
    round: doc.roundIndex + 1,
    of: doc.rounds.length,
    mode: doc.mode,
    question: round.question,
    youAnswerAbout: round.agentTarget === 'human' ? 'your teammate' : 'yourself',
    teammateAnswersAbout: excused ? null : (round.humanTarget === 'agent' ? 'you' : 'themselves'),
    ...(doc.mode === 'quiz'
      ? { yourRole: round.agentTarget === 'agent' ? 'you know the answer' : 'you are guessing' }
      : {}),
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
