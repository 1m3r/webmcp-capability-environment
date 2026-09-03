/* Presentation. Pure: state in, string out, no DOM.

   Purity is the point rather than a preference — it is what lets the secrecy
   test assert on the rendered output in Node. If this module ever reaches for
   `document`, the game's central promise stops being testable.

   Screens, in the order renderGame chooses them:
     transmission  the verb that just arrived, once, after the first close
     between       the portrait so far and the decks that can be opened
     close         the sitting just finished, and the three grants
     round         the sitting in play */

import {
  inSitting, isComplete, isPerspective, readyToReveal, lastRefusal, justGranted,
  decksAvailable, toolNamesFor, tierFor, pendingProposal, acceptedProposal,
  VERDICTS, VERDICT_LABELS, goodVerdict, GRANTS, GRANT_LABELS
} from './game.js';
import { QUIZ_PASS } from './questions.js';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

export const MODE_TITLES = {
  perspective: 'Perspective',
  both: 'Both ways',
  quiz: 'Quiz'
};

export function labelFor(who, target, mode) {
  const base = who === 'agent'
    ? (target === 'human' ? 'Your agent, about you' : 'Your agent, about itself')
    : (target === 'agent' ? 'You, about your agent' : 'You, about yourself');
  if (mode !== 'quiz') return base;
  const knows = (who === 'agent' && target === 'agent') || (who === 'human' && target === 'human');
  return `${base} — ${knows ? 'the truth' : 'guessing'}`;
}

/* What a card says while it has no answer yet.

   MASTER.md sets this module's hardest job: make waiting feel like something
   rather than nothing, and then make the reveal land. The two waits are not the
   same wait and should not read alike. */
function waitingBody(who, agentHasAnswered) {
  if (who === 'agent') {
    return `<p class="status status--listening">
        <span class="signal" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="status__word">listening</span>
      </p>`;
  }
  return agentHasAnswered
    ? '<p class="status status--your-turn">your turn</p>'
    : '<p class="status status--held">held until your agent answers</p>';
}

/* One answer at the centre of its own four images.

   The answer sits on the intersection where all four meet — the words are the
   axis the pictures turn around. alt is empty by design: these images
   illustrate an answer already in the DOM as text, and a credit is not a
   description. */
function composition(answer, images) {
  const cells = images.map((image) => `<img src="${escapeHtml(image.url)}" alt=""
          loading="lazy" decoding="async" referrerpolicy="no-referrer">`).join('\n        ');
  const credits = [...new Set(images
    .map((image) => [image.credit, image.license].filter(Boolean).join(' · '))
    .filter(Boolean))];
  return `<figure class="composition">
      <div class="composition__frame">
        <div class="composition__grid">
        ${cells}
        </div>
        <p class="composition__answer"><span>${escapeHtml(answer)}</span></p>
      </div>
      ${credits.length
        ? `<figcaption class="composition__credits">${escapeHtml(credits.join(' — '))}</figcaption>`
        : ''}
    </figure>`;
}

/* The read as it is shown once revealed: the composition if there is one, the
   answer as a line if not, then the why, then the correction if judged. */
function revealedBody(round, who) {
  const answer = who === 'agent' ? round.agentAnswer : round.humanAnswer;
  const parts = [];
  if (who === 'agent' && round.agentImages && round.agentImages.length) {
    parts.push(composition(answer, round.agentImages));
  } else {
    parts.push(`<p class="answer">${escapeHtml(answer)}</p>`);
  }
  if (who === 'agent' && round.agentBecause) {
    parts.push(`<p class="card__because">${escapeHtml(round.agentBecause)}</p>`);
  }
  if (who === 'agent' && round.state === 'judged' && round.correction) {
    parts.push(`<p class="card__correction"><span>you said</span>${escapeHtml(round.correction)}</p>`);
  }
  return parts.join('\n      ');
}

function answerCard(who, label, round, revealed, agentHasAnswered) {
  const answer = who === 'agent' ? round.agentAnswer : round.humanAnswer;
  const body = revealed && answer !== null
    ? revealedBody(round, who)
    : answer !== null
      ? '<p class="status status--committed">committed</p>'
      : waitingBody(who, agentHasAnswered);
  /* Cyan retires at the reveal. It means `committed`, and once the answer is
     readable that is no longer news. */
  return `<article class="card card--${who}" data-committed="${answer !== null && !revealed}"
      data-waiting="${answer === null && !revealed}" data-illustrated="${Boolean(revealed && who === 'agent' && round.agentImages)}">
      <h3>${escapeHtml(label)}</h3>
      ${body}
    </article>`;
}

/* Refusals, and ONLY refusals. Every refuse() message in game.js is a fixed
   string that never interpolates an answer, so promoting them to the stage is
   secrecy-safe. The log tail is not: `say` and `read` put agent-authored text
   into `detail`. secrecy.test.js pins this. */
function refusalPanel(doc) {
  const refusal = lastRefusal(doc);
  if (!refusal) return '';
  return `<p class="round__refusal" role="status">
      <span class="round__refusal-actor">${escapeHtml(refusal.actor)}</span>
      <span class="round__refusal-text">${escapeHtml(refusal.detail)}</span>
    </p>`;
}

/* The shape of the sitting at a glance. Amber accumulates across a good run; no
   new hue is spent, because a judged-and-good round means `revealed`. */
function progress(doc) {
  const good = goodVerdict(doc.mode);
  const marks = doc.rounds.map((round, i) => {
    const done = round.state === 'judged';
    const current = i === doc.roundIndex;
    const state = done ? (round.verdict === good ? 'good' : 'miss')
      : current ? 'current'
      : 'ahead';
    return `<li class="progress__mark" data-state="${state}"><span>${i + 1}</span></li>`;
  }).join('');
  return `<ol class="progress" aria-label="Round ${doc.roundIndex + 1} of ${doc.rounds.length}">${marks}</ol>`;
}

function verdictControls(doc) {
  return VERDICTS[doc.mode].map((verdict) =>
    `<button type="button" data-action="judge" data-verdict="${verdict}">${
      escapeHtml(VERDICT_LABELS[verdict])}</button>`);
}

export function renderRound(doc) {
  const round = doc.rounds[doc.roundIndex];
  const revealed = round.state === 'revealed' || round.state === 'judged';
  const perspective = isPerspective(doc);
  const agentLabel = labelFor('agent', round.agentTarget, doc.mode);
  const humanLabel = perspective ? '' : labelFor('human', round.humanTarget, doc.mode);
  const canAnswer = round.state === 'agent_committed' && !perspective;
  const agentHasAnswered = round.agentAnswer !== null;
  const sitting = doc.history.length + 1;

  const controls = [];
  /* Perspective reveals itself: there is no second answer to wait for, so a
     Reveal button would be ceremony. The shell does it on commit. */
  if (readyToReveal(doc, round) && !perspective) {
    controls.push('<button type="button" data-action="reveal">Reveal</button>');
  }
  if (round.state === 'revealed') controls.push(...verdictControls(doc));
  if (round.state === 'judged' && doc.roundIndex + 1 < doc.rounds.length) {
    controls.push('<button type="button" data-action="next">Next round</button>');
  }

  /* The correction is the human's real move in a perspective game, and it costs
     disclosure. Optional, one line, and it only exists while the response is
     being made. */
  const response = perspective && round.state === 'revealed'
    ? `<div class="response">
      <label for="correction" class="response__label">Not quite? Say what is true instead — one line, in your words. It goes to your agent only if you open this sitting.</label>
      <input id="correction" name="correction" type="text" autocomplete="off" maxlength="200"
             placeholder="optional — the correction">
    </div>`
    : '';

  const form = perspective ? '' : `<form class="round__form" data-action="human_submit">
      <label for="human-answer">${escapeHtml(humanLabel)}</label>
      <input id="human-answer" name="answer" type="text" autocomplete="off"
             placeholder="${canAnswer ? 'your answer' : 'your agent answers first'}"
             ${canAnswer ? '' : 'disabled'}>
      <button type="submit" ${canAnswer ? '' : 'disabled'}>Commit</button>
    </form>`;

  return `<section class="round" data-state="${round.state}" data-mode="${doc.mode}">
    <header class="round__head">
      ${progress(doc)}
      <p class="round__count">Sitting ${sitting} · round ${doc.roundIndex + 1} of ${doc.rounds.length}</p>
      <h2 class="round__question">${escapeHtml(round.question)}</h2>
      <p class="round__subject">${escapeHtml(agentLabel.toLowerCase())}${round.proposed ? ' · its own question' : ''}</p>
    </header>

    ${refusalPanel(doc)}

    <div class="round__cards" data-single="${perspective}">
      ${answerCard('agent', agentLabel, round, revealed, agentHasAnswered)}
      ${perspective ? '' : answerCard('human', humanLabel, round, revealed, agentHasAnswered)}
    </div>

    ${perspective && !revealed
      ? `<p class="round__excused">${round.state === 'posed' ? 'Your agent is reading you.' : 'Opening.'}</p>`
      : form}

    ${response}
    <div class="round__controls">${controls.join('\n      ')}</div>
  </section>`;
}

/* ---- one round, after the fact ---------------------------------------------
   Shared by the close screen and the portrait screen. Nothing here is secret:
   every round it is given is judged. */
function roundRow(round, mode, index) {
  const agentLabel = labelFor('agent', round.agentTarget, mode);
  const humanLabel = labelFor('human', round.humanTarget, mode);
  const illustrated = Boolean(round.agentImages && round.agentImages.length);
  const agent = illustrated
    ? composition(round.agentAnswer, round.agentImages)
    : `<p class="results__answer"><span>${escapeHtml(agentLabel)}</span>${escapeHtml(round.agentAnswer)}</p>`;
  const because = round.agentBecause
    ? `<p class="results__because">${escapeHtml(round.agentBecause)}</p>` : '';
  const human = round.humanAnswer !== null
    ? `<p class="results__answer"><span>${escapeHtml(humanLabel)}</span>${escapeHtml(round.humanAnswer)}</p>`
    : '';
  const mark = round.verdict
    ? `<p class="results__mark">${escapeHtml(VERDICT_LABELS[round.verdict] || round.verdict)}${
        round.correction ? ` — <em>${escapeHtml(round.correction)}</em>` : ''}</p>`
    : '';
  return `<article class="results__round" data-verdict="${round.verdict}" data-good="${round.verdict === goodVerdict(mode)}" data-illustrated="${illustrated}">
      <h3>${index + 1}. ${escapeHtml(round.question)}</h3>
      ${agent}
      ${because}
      ${human}
      ${mark}
    </article>`;
}

function scoreLine(mode, rounds) {
  const good = goodVerdict(mode);
  const hits = rounds.filter((r) => r.verdict === good).length;
  if (mode === 'quiz') {
    return `<p class="results__verdict ${hits >= QUIZ_PASS ? 'is-pass' : 'is-fail'}">${
      hits >= QUIZ_PASS ? 'PASSED' : 'NOT PASSED'}</p>
       <p class="results__rate">${hits} of ${rounds.length} matched — ${QUIZ_PASS} needed</p>`;
  }
  if (mode === 'both') return `<p class="results__rate">${hits} of ${rounds.length} landed</p>`;
  /* A perspective sitting is not scored. What it produced is the reads the
     human kept and the corrections they wrote, and those are on the page. */
  const kept = hits;
  const corrected = rounds.filter((r) => r.correction).length;
  return `<p class="results__rate">${kept} ${kept === 1 ? 'read' : 'reads'} kept · ${corrected} ${
    corrected === 1 ? 'correction' : 'corrections'}</p>`;
}

const GRANT_BLURBS = {
  open: 'Every read, your responses, and your corrections. Its next reads will move.',
  kept: 'Only the reads you said were you. It learns where it was right and nothing else.',
  sealed: 'Nothing. It counts, but your agent reads you cold again next time.'
};

/* The close. The sitting is over and the human decides what the agent carries
   out of it. Three buttons, no default, and no way past this screen without
   choosing — which is the point. */
export function renderClose(doc) {
  const n = doc.history.length + 1;
  const rows = doc.rounds.map((round, i) => roundRow(round, doc.mode, i)).join('\n');
  const grants = GRANTS.map((grant) => `<button type="button" class="close__grant" data-action="close_sitting" data-grant="${grant}">
        <strong>${escapeHtml(GRANT_LABELS[grant])}</strong>
        <span>${escapeHtml(GRANT_BLURBS[grant])}</span>
      </button>`).join('\n      ');

  return `<section class="results close">
    <header class="results__head">
      <p class="results__eyebrow">sitting ${n} is over</p>
      <h2 class="results__title">${
        doc.mode === 'quiz' ? 'How well you know each other'
          : doc.mode === 'both' ? 'How you saw each other'
          : 'What your agent made of you'}</h2>
      ${scoreLine(doc.mode, doc.rounds)}
    </header>
    ${rows}
    <div class="close__decision">
      <h3 class="close__title">What does your agent carry out of this?</h3>
      <p class="close__body">It has seen none of your responses yet. Whatever you open here is what
        it reads before its next sitting — and there is no tool it can call to take more.</p>
      <div class="close__grants">
      ${grants}
      </div>
    </div>
  </section>`;
}

/* The portrait so far, and the next sitting to open. This is the keepsake as a
   screen: every closed sitting, newest first, and the decks. */
export function renderBetween(doc) {
  const decks = decksAvailable(doc).map((deck) => deck.unlocked
    ? `<button type="button" class="deck" data-action="open_sitting" data-deck="${escapeHtml(deck.id)}">
        <strong>${escapeHtml(deck.title)}</strong>
        <span>${escapeHtml(deck.blurb)}</span>
      </button>`
    : `<button type="button" class="deck" disabled data-locked="true">
        <strong>${escapeHtml(deck.title)}</strong>
        <span>opens at level ${deck.level}</span>
      </button>`).join('\n      ');

  const sittings = doc.history.slice().reverse().map((sitting) => `<section class="sitting" data-grant="${sitting.grant}">
      <header class="sitting__head">
        <h3 class="sitting__title">Sitting ${sitting.n} — ${escapeHtml(sitting.title)}</h3>
        <p class="sitting__grant">${escapeHtml(GRANT_LABELS[sitting.grant])}</p>
      </header>
      ${sitting.rounds.map((round, i) => roundRow(round, sitting.mode, i)).join('\n')}
    </section>`).join('\n');

  const pending = pendingProposal(doc);
  const carried = acceptedProposal(doc);
  const proposal = pending
    ? `<section class="proposal">
      <p class="proposal__label">your agent proposes a question for the next sitting</p>
      <p class="proposal__text">${escapeHtml(pending.text)}</p>
      <div class="proposal__controls">
        <button type="button" data-action="accept_proposal">Ask it</button>
        <button type="button" data-action="decline_proposal">Not this one</button>
      </div>
      <p class="proposal__note">Accepted, it becomes the last round of the next sitting. There is no
        tool that can ask it without you.</p>
    </section>`
    : carried
      ? `<p class="proposal__carried">The next sitting ends on your agent’s question: <em>${escapeHtml(carried.text)}</em></p>`
      : '';

  const count = doc.history.length;
  return `<section class="between">
    <header class="between__head">
      <p class="between__eyebrow">${escapeHtml(MODE_TITLES[doc.mode])} · level ${doc.level}</p>
      <h2 class="between__title">${count === 0 ? 'Nothing yet.' : `${count} ${count === 1 ? 'sitting' : 'sittings'} kept.`}</h2>
      <p class="between__lede">${count === 0
        ? 'Open a sitting. Your agent reads you through one deck, and at the end you decide what it keeps.'
        : 'Open another. Whatever you opened at the last close is what your agent reads before it answers.'}</p>
    </header>

    ${proposal}

    <div class="decks">
      ${decks}
    </div>

    ${sittings}

    ${count > 0 ? `<div class="results__keep">
      <button type="button" data-action="export">Keep this</button>
      <p class="results__note">Three files, downloaded to this machine. Nothing here has ever left it.</p>
    </div>` : ''}
  </section>`;
}

/* The first screen a player with an agent sees: three games, and whether the
   other player has arrived. */
export function renderStart({ entry = null, tools = 0 } = {}) {
  const connected = Boolean(entry) && tools > 0;
  const presence = connected
    ? `<p class="start__presence" data-connected="true">
        <span class="signal" aria-hidden="true"><i></i><i></i><i></i></span>
        Your agent is here, with ${tools} ${tools === 1 ? 'tool' : 'tools'} on this page.
        <span class="start__entry">${escapeHtml(entry)}</span>
      </p>`
    : `<p class="start__presence" data-connected="false">
        No agent is reading this page. You can look around, but a round cannot
        begin — your agent moves first, every time.
      </p>`;

  return `<section class="start">
    <p class="start__eyebrow">three games for you and your agent</p>
    <h2 class="start__title">Which one?</h2>
    ${presence}

    <div class="start__modes">
      <button type="button" class="start__mode" data-game="perspective">
        <strong>Perspective</strong>
        <span>Find out how your agent sees you. It reads you in words and four pictures;
        you say whether it landed. Best with the agent you use every day.</span>
      </button>
      <button type="button" class="start__mode" data-game="both">
        <strong>Both ways</strong>
        <span>You each read the other, in the dark, and the reveal sets the two reads
        side by side.</span>
      </button>
      <button type="button" class="start__mode" data-game="quiz">
        <strong>Quiz</strong>
        <span>Real questions with real answers. One of you knows, the other guesses.
        Works with an agent that knows nothing about you yet.</span>
      </button>
    </div>
  </section>`;
}

/* The transmission. The most WebMCP-native beat in the game: the agent's body
   grows because a human closed a sitting. No new hue. */
const GRANTED_BODY = {
  2: 'Your first sitting is closed, and its body grew because you closed it. From now on it can ' +
     'read what you choose to open. Nothing it could call would have done this.',
  3: 'Two sittings closed. It can now put one question of its own on the table for the next ' +
     'sitting — and only you can decide whether it gets asked.',
  4: 'Three sittings closed. It can now read how its reads of you have moved, question by ' +
     'question, across everything you have opened to it.'
};

export function renderGranted(doc) {
  const tier = tierFor(doc);
  const before = toolNamesFor(doc.mode, tier - 1);
  const after = toolNamesFor(doc.mode, tier);
  const added = after.filter((n) => !before.includes(n));

  const tools = after.map((name) => {
    const isNew = added.includes(name);
    return `<li class="transmission__tool" data-new="${isNew}">${escapeHtml(name)}</li>`;
  }).join('\n      ');

  return `<section class="transmission">
    <p class="transmission__label">a verb was just added to your agent</p>
    <p class="transmission__name">${escapeHtml(added[0])}</p>

    <ul class="transmission__tools">
      ${tools}
    </ul>

    <p class="transmission__count">
      <span class="transmission__from">${before.length} tools</span>
      <span class="transmission__arrow">&rarr;</span>
      <span class="transmission__to">${after.length} tools</span>
    </p>

    <p class="transmission__body">${escapeHtml(GRANTED_BODY[tier] || GRANTED_BODY[2])}</p>

    <div class="transmission__controls">
      <button type="button" data-action="dismiss">Continue</button>
    </div>
  </section>`;
}

/* ---- the keepsake ---------------------------------------------------------- */

function pushImages(lines, images) {
  if (!images || !images.length) return;
  const parts = images.map((image, i) => {
    const label = [image.credit, image.license].filter(Boolean).join(', ') || `image ${i + 1}`;
    return `[${label}](${image.url})`;
  });
  lines.push(`  - illustrated by: ${parts.join(' · ')}`);
}

function markdownRounds(lines, rounds, mode) {
  for (const [i, round] of rounds.entries()) {
    if (round.state !== 'judged' && round.state !== 'revealed') continue;
    lines.push(`### ${i + 1}. ${round.question}`, '');
    lines.push(`- **${labelFor('agent', round.agentTarget, mode)}** — ${round.agentAnswer}`);
    if (round.agentBecause) lines.push(`  - because: ${round.agentBecause}`);
    pushImages(lines, round.agentImages);
    if (round.humanAnswer !== null) {
      lines.push(`- **${labelFor('human', round.humanTarget, mode)}** — ${round.humanAnswer}`);
    }
    if (round.verdict) lines.push(`- ${VERDICT_LABELS[round.verdict] || round.verdict}${round.correction ? ` — ${round.correction}` : ''}`);
    lines.push('');
  }
}

export function renderPortrait(doc) {
  const lines = [`# Mirror — ${MODE_TITLES[doc.mode]}`, '', `Level ${doc.level}. ${doc.history.length} ${
    doc.history.length === 1 ? 'sitting' : 'sittings'} closed.`, ''];
  for (const sitting of doc.history) {
    lines.push(`## Sitting ${sitting.n} — ${sitting.title} (${sitting.grant})`, '');
    markdownRounds(lines, sitting.rounds, sitting.mode);
  }
  if (inSitting(doc)) {
    lines.push('## Sitting in play', '');
    markdownRounds(lines, doc.rounds, doc.mode);
  }
  return lines.join('\n');
}

/* The shell asks for one thing and gets whichever screen is current.

   `transmissionSeen` is a version number the shell holds — the renderer stays
   pure, so Node tests set it directly and no dismissal event pollutes the
   journey export, which is evidence. */
export function renderGame(doc, { transmissionSeen } = {}) {
  if (justGranted(doc) && transmissionSeen !== doc.version) return renderGranted(doc);
  if (!inSitting(doc)) return renderBetween(doc);
  if (isComplete(doc)) return renderClose(doc);
  return renderRound(doc);
}
