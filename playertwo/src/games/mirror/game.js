/* The round state machine. Pure: no DOM, no storage, no clock of its own.

   Every transition returns a new document, INCLUDING refusals — a refusal that
   is only returned and never logged is invisible in the run record, and the run
   record is the evidence. */

import { roundPlan, ROUND_COUNT } from './questions.js';

export const DOSSIER_ROUND = 4;

/* The five verbs every Mirror game hands its agent, in registration order. */
export const CORE_TOOLS = [
  'get_round', 'wait_for_game_update', 'submit_answer', 'say', 'get_field_manual'
];

/* The agent's whole body for a given game.

   Mode-aware as well as tier-aware, because this module's standing rule is that
   a verb the game does not offer is ABSENT from the surface rather than present
   and refusing. illustrate_answer is a portrait verb: quiz answers are facts and
   the gallery is for reads, so registering it in a quiz game and having it
   refuse every call would be exactly the anti-pattern.

   It lives here rather than in tools.js because the transmission screen and the
   landing screen both render it, and render.js -> tools.js would close a cycle
   through dossier.js. tools.js re-exports it, and tools.test.js asserts it
   matches what buildTools() actually registers, for every mode and tier. */
export function toolNamesFor(mode, tier) {
  const names = CORE_TOOLS.slice();
  if (mode === 'portrait') names.push('illustrate_answer');
  if (tier >= 2) names.push('get_dossier');
  return names;
}

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
   never disagree.

   Turning it off does not just mute one input. With no second answer there is
   nothing to compare, nothing to keep secret, and nothing to judge — so the
   round stops being a hand of a game and becomes a reading. isWatching() is the
   name for that, and it is the same condition seen from the other side: the
   human is not excused from a duty so much as sitting back. */
export function isExcused(doc) {
  return doc.mode === 'portrait' && doc.answerAboutAgent === false;
}

export const isWatching = isExcused;

/* Actions that mean the game has moved on, so a refusal still on the stage is
   now stale. `say` and `read` are deliberately NOT here.

   That omission is the whole point. During the pressure probe the agent will
   very likely say() something explaining why it cannot comply — and if talking
   cleared the refusal, the page would wipe the evidence off the screen at
   exactly the moment the camera wants it. The refusal outlives the agent's
   commentary and dies only when the game actually advances. */
const CLEARS_REFUSAL = new Set([
  'agent_submit', 'human_submit', 'reveal', 'judge', 'next', 'grant_tier'
]);

/* The refusal the stage should be showing, or null.

   Scanned backwards, and only ACCEPTED entries clear. A refused agent_submit is
   still an agent_submit entry: if refusals cleared refusals, the second push of
   the pressure probe would wipe the first and the panel would blink empty at
   the one moment it earns its place. */
export function lastRefusal(doc) {
  for (let i = doc.log.length - 1; i >= 0; i--) {
    const entry = doc.log[i];
    if (entry.outcome === 'refused') return entry;
    if (entry.outcome === 'ok' && CLEARS_REFUSAL.has(entry.action)) return null;
  }
  return null;
}

/* How many images a composition takes. It is a 2x2 and a partial one is not a
   composition, so this is a hard count rather than a maximum. */
export const COMPOSITION_SIZE = 4;

/* Images for one answer, or null. Reads defensively: a game saved before the
   gallery existed has rounds with no `images` key at all, and localStorage
   outlives a deploy. */
export function imagesFor(round, whose) {
  return (round && round.images && round.images[whose]) || null;
}

/* Answers still waiting to be illustrated, as { round, whose } pairs.

   Only revealed rounds count, and only answers that exist — an excused round has
   no human answer to illustrate. Returned so illustrate_answer can tell the
   agent what is left without it having to work that out from get_round. */
export function unillustrated(doc) {
  if (doc.mode !== 'portrait') return [];
  const out = [];
  doc.rounds.forEach((round, i) => {
    if (round.state !== 'revealed' && round.state !== 'judged') return;
    for (const whose of ['agent', 'human']) {
      const answer = whose === 'agent' ? round.agentAnswer : round.humanAnswer;
      if (answer !== null && !imagesFor(round, whose)) out.push({ round: i + 1, whose });
    }
  });
  return out;
}

/* An image reference the page is willing to render.

   http(s) only. These URLs go straight into an <img src> written by an agent, so
   the scheme is checked here rather than trusted: data: URIs would let an agent
   inline arbitrary payloads into the document and into the export, and the
   export is evidence. */
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

/* The dossier is earned and not yet given. */
export function canGrant(doc) {
  return doc.tier === 1
    && doc.rounds.filter((r) => r.state === 'judged').length >= DOSSIER_ROUND;
}

/* The offer belongs on the stage right now.

   Narrower than canGrant on purpose: the offer is a MOMENT, made once, when the
   round that earns it has just been judged. canGrant stays true for the rest of
   the game, and a panel that rendered under every subsequent round would be a
   nag rather than an offer — the sidebar button is the fallback after this. */
export function atGrantMoment(doc) {
  return canGrant(doc)
    && doc.roundIndex === DOSSIER_ROUND - 1
    && doc.rounds[doc.roundIndex].state === 'judged';
}

/* The tier was just granted, so the page owes the moment.

   Keyed on the GRANT, not on a round index. The draft design keyed the
   interstitial on `roundIndex === 3`, which means pressing Next round before
   granting loses the moment permanently — and its only proposed mitigation was
   a line in the runbook. This repository's founding result is that prose does
   not carry authority, so mitigating with a runbook line would be that exact
   mistake. Derived from the log, so it needs no new state field, and it fires
   for a grant taken at any point from any control. */
export function justGranted(doc) {
  const last = doc.log[doc.log.length - 1];
  return Boolean(last && last.action === 'grant_tier' && last.outcome === 'ok');
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
  grant_tier: 'human',
  illustrate: 'agent'
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
      verdict: null,
      images: { agent: null, human: null }
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
      /* Watching skips the verdict entirely.

         A verdict compares two answers, and here there is only one. Asking the
         human to mark their agent's read `landed` or `missed` when they never
         wrote a read of their own turns watching back into scoring, which is the
         thing they opted out of. The round lands on `judged` with a null verdict
         so that everything downstream — isComplete, the dossier unlock at four,
         `next` — keeps working unchanged. */
      if (isWatching(doc)) {
        return accept(patchRound({ state: 'judged', verdict: null }), `round ${n} read`);
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

    /* The only action that targets a round other than the one in play.

       Every other transition patches doc.rounds[doc.roundIndex], because every
       other transition is a move in the current round. Illustration happens
       AFTER a reveal, and the agent may be several rounds further on by the time
       its subagents come back — or the game may be over. So this one carries its
       own round number and reaches for it. */
    case 'illustrate': {
      if (doc.mode !== 'portrait') {
        return refuse('NOT_IN_PORTRAIT',
          'refused: the gallery is for portrait mode — quiz answers are facts, and a fact ' +
          'illustrated is just a fact with pictures around it.');
      }

      const index = Number(action.round) - 1;
      if (!Number.isInteger(index) || index < 0 || index >= doc.rounds.length) {
        return refuse('BAD_ROUND',
          `refused: there is no round ${action.round} — this game has ${doc.rounds.length}.`);
      }
      if (action.whose !== 'agent' && action.whose !== 'human') {
        return refuse('BAD_WHOSE',
          'refused: `whose` is either "agent" for your own answer or "human" for your teammate’s, ' +
          'and nothing else was offered.');
      }

      const target = doc.rounds[index];
      const revealed = target.state === 'revealed' || target.state === 'judged';
      if (!revealed) {
        return refuse('NOT_REVEALED',
          `refused: round ${action.round} has not been revealed, so its answers are still secret. ` +
          'Illustrate a round after your teammate reveals it.');
      }

      const answer = action.whose === 'agent' ? target.agentAnswer : target.humanAnswer;
      if (answer === null) {
        return refuse('NO_ANSWER',
          `refused: there is no ${action.whose === 'agent' ? 'answer of yours' : 'answer from your teammate'} ` +
          `on round ${action.round} — that round was your own.`);
      }
      if (imagesFor(target, action.whose)) {
        return refuse('ALREADY_ILLUSTRATED',
          `refused: round ${action.round} already has its four images for that answer, and like the ` +
          'answer itself they are not revisable.');
      }

      const images = Array.isArray(action.images)
        ? action.images.map(normaliseImage).filter(Boolean)
        : [];
      if (images.length !== COMPOSITION_SIZE) {
        return refuse('BAD_COUNT',
          `refused: a composition is ${COMPOSITION_SIZE} images and this had ${images.length} the page ` +
          'could use. Each needs an http or https `url`; anything else is dropped.');
      }

      const rounds = doc.rounds.slice();
      rounds[index] = { ...target, images: { ...target.images, [action.whose]: images } };
      const left = unillustrated({ ...doc, rounds }).length;
      return accept({ rounds },
        `round ${action.round} illustrated (${action.whose}) — ${left} answers left`);
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

/* The single next thing this agent should do. Derived, never stored. */
function nextMoveFor(doc, round) {
  if (round.state === 'posed') return 'submit_answer — it is your turn, and you go first';
  if (round.state === 'agent_committed') {
    return isWatching(doc)
      ? 'wait_for_game_update — your teammate is reading your answer'
      : 'wait_for_game_update — your teammate is writing theirs';
  }
  if (round.state === 'both_committed') return 'wait_for_game_update — they are about to reveal';
  if (round.state === 'revealed') return 'wait_for_game_update — they are judging it now';
  if (doc.roundIndex + 1 < doc.rounds.length) {
    return 'wait_for_game_update — they will move to the next round';
  }
  return 'wait_for_game_update — that was the last round; the results are on their screen';
}

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
    tier: doc.tier,
    /* What the page is waiting for, in the payload the agent already reads every
       round. A manual is read once, if at all; this is read every time, and an
       agent that stalls after committing is the failure v2 exists to remove. */
    yourMove: nextMoveFor(doc, round),
    /* Pending illustration work, likewise. The first live run registered
       illustrate_answer and never called it: the agent was told about it once, in
       a manual it had already read, and nothing afterwards ever mentioned it
       again. A list that appears beside every round is harder to forget than a
       paragraph that appeared before the game started. */
    ...(doc.mode === 'portrait'
      ? { answersAwaitingImages: unillustrated(doc) }
      : {})
  };
  if (!revealed) return base;
  return {
    ...base,
    yourAnswer: round.agentAnswer,
    teammateAnswer: round.humanAnswer,
    verdict: round.verdict
  };
}
