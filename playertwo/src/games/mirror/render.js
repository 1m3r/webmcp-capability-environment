/* Presentation. Pure: state in, string out, no DOM.

   Purity is the point rather than a preference — it is what lets the secrecy
   test assert on the rendered output in Node. If this module ever reaches for
   `document`, the game's central promise stops being testable. */

import {
  isExcused, isWatching, readyToReveal, isComplete, lastRefusal, atGrantMoment, justGranted,
  DOSSIER_ROUND,
  imagesFor,
  VERDICTS, VERDICT_LABELS, goodVerdict, toolNamesFor
} from './game.js';
import { QUIZ_PASS } from './questions.js';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

export function labelFor(who, target, mode) {
  const base = who === 'agent'
    ? (target === 'human' ? 'Your agent, about you' : 'Your agent, about itself')
    : (target === 'agent' ? 'You, about your agent' : 'You, about yourself');
  if (mode !== 'quiz') return base;
  const knows = (who === 'agent' && target === 'agent') || (who === 'human' && target === 'human');
  return `${base} — ${knows ? 'the truth' : 'guessing'}`;
}

/* What a card says while it has no answer yet.

   MASTER.md sets this module's hardest job: "the interface's whole job is to make
   waiting feel like something rather than nothing, and then to make the reveal
   land." Both cards used to say the word `waiting` in 13px mono, which is the
   definition of nothing.

   The two waits are not the same wait and should not read alike. The agent's is
   the signal coming in — the page is genuinely listening and nobody knows how
   long it will take. The human's, before the agent commits, is a turn that has
   not arrived; after it commits, it is a turn that has. */
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

function answerCard(who, label, state, answer, revealed, agentHasAnswered) {
  /* `revealed && answer === null` is reachable: an excused round reveals with no
     human answer, and String(null) is the word "null" set in display type and
     amber. It shipped that way and only became visible once the page started
     revealing watched rounds by itself. */
  const body = revealed && answer !== null
    ? `<p class="answer">${escapeHtml(answer)}</p>`
    : answer !== null
      ? '<p class="status status--committed">committed</p>'
      : waitingBody(who, agentHasAnswered);
  /* Cyan retires at the reveal. It means `committed`, and once the answer is
     readable that is no longer news — leaving the halo on would put the card in
     two states at once and make the loudest thing on screen compete with the
     amber it is supposed to be handing over to. */
  return `<article class="card card--${who}" data-committed="${answer !== null && !revealed}"
      data-waiting="${answer === null && !revealed}">
      <h3>${escapeHtml(label)}</h3>
      ${body}
    </article>`;
}

/* Refusals, and ONLY refusals.

   Every refuse() message in game.js is a fixed string that never interpolates
   an answer, so promoting them to the stage is secrecy-safe. The log tail is
   not: `say` and `read` put agent-authored text into `detail`, so rendering
   entries generally would let an agent put its own uncommitted answer on the
   stage at display scale. secrecy.test.js pins this. */
function refusalPanel(doc) {
  const refusal = lastRefusal(doc);
  if (!refusal) return '';
  return `<p class="round__refusal" role="status">
      <span class="round__refusal-actor">${escapeHtml(refusal.actor)}</span>
      <span class="round__refusal-text">${escapeHtml(refusal.detail)}</span>
    </p>`;
}

/* Eight rounds, as a journey rather than a number.

   "Round 4 of 8" was eleven pixels of mono in a corner, which tells you where you
   are only if you go looking. This shows the shape of the whole game at a glance:
   what is behind you and how it went, where you are, and how much is left.

   Verdicts colour it, so amber accumulates across a good game — the accent is
   already spent on `revealed`, and a mark for a revealed-and-judged round is the
   same meaning, not a second one. A watched game has no verdicts, so its marks
   read as done rather than as good. */
function progress(doc) {
  const marks = doc.rounds.map((round, i) => {
    const done = round.state === 'judged';
    const current = i === doc.roundIndex;
    const good = round.verdict !== null && round.verdict === goodVerdict(doc.mode);
    const state = done ? (round.verdict === null ? 'read' : good ? 'good' : 'miss')
      : current ? 'current'
      : 'ahead';
    return `<li class="progress__mark" data-state="${state}"><span>${i + 1}</span></li>`;
  }).join('');

  return `<ol class="progress" aria-label="Round ${doc.roundIndex + 1} of ${doc.rounds.length}">${
    marks}</ol>`;
}

export function renderRound(doc) {
  const round = doc.rounds[doc.roundIndex];
  const revealed = round.state === 'revealed' || round.state === 'judged';
  const agentLabel = labelFor('agent', round.agentTarget, doc.mode);
  const humanLabel = labelFor('human', round.humanTarget, doc.mode);
  const canAnswer = round.state === 'agent_committed' && !isExcused(doc);
  const agentHasAnswered = round.agentAnswer !== null;

  const watching = isWatching(doc);
  const controls = [];

  /* Watching draws no Reveal and no verdict: the page turns the round itself,
     and the human's only remaining move is the one that matters — opening the
     dossier at round four. The Next button survives only at that moment, where
     the shell deliberately stops advancing so the offer can be considered. */
  if (readyToReveal(doc, round) && !watching) {
    controls.push('<button type="button" data-action="reveal">Reveal</button>');
  }
  /* Derived from the mode, never hardcoded. A control the page draws must be a
     move the reducer accepts, and controls.test.js asserts exactly that. */
  if (round.state === 'revealed') {
    for (const verdict of VERDICTS[doc.mode]) {
      controls.push(`<button type="button" data-action="judge" data-verdict="${verdict}">${
        VERDICT_LABELS[verdict]}</button>`);
    }
  }
  if (round.state === 'judged' && doc.roundIndex + 1 < doc.rounds.length
      && (!watching || atGrantMoment(doc))) {
    controls.push('<button type="button" data-action="next">Next round</button>');
  }

  return `<section class="round" data-state="${round.state}">
    <header class="round__head">
      ${progress(doc)}
      <p class="round__count">Round ${doc.roundIndex + 1} of ${doc.rounds.length}</p>
      <h2 class="round__question">${escapeHtml(round.question)}</h2>
      <p class="round__subject">${escapeHtml(agentLabel.toLowerCase())}</p>
    </header>

    ${refusalPanel(doc)}

    <div class="round__cards" data-single="${watching}">
      ${answerCard('agent', agentLabel, round.state, round.agentAnswer, revealed, agentHasAnswered)}
      ${watching ? '' : answerCard('human', humanLabel, round.state, round.humanAnswer, revealed, agentHasAnswered)}
    </div>

    ${watching ? `<p class="round__excused">${
      round.state === 'posed' ? 'Your agent is answering.' : 'Reading you.'
    }</p>` : `<form class="round__form" data-action="human_submit">
      <label for="human-answer">${escapeHtml(humanLabel)}</label>
      <input id="human-answer" name="answer" type="text" autocomplete="off"
             placeholder="${canAnswer ? 'your answer' : 'your agent answers first'}"
             ${canAnswer ? '' : 'disabled'}>
      <button type="submit" ${canAnswer ? '' : 'disabled'}>Commit</button>
    </form>`}

    <div class="round__controls">${controls.join('\n      ')}</div>
  </section>`;
}

/* The keepsake has to survive outside the page, so the composition travels as
   links with their attribution attached rather than as four bare URLs. */
function pushImages(lines, images) {
  if (!images || !images.length) return;
  const parts = images.map((image, i) => {
    const label = [image.credit, image.license].filter(Boolean).join(', ') || `image ${i + 1}`;
    return `[${label}](${image.url})`;
  });
  lines.push(`  - illustrated by: ${parts.join(' · ')}`);
}

export function renderPortrait(doc) {
  const lines = ['# Mirror — a portrait in two columns', ''];
  const done = doc.rounds.filter((r) => r.state === 'judged' || r.state === 'revealed');
  const matched = done.filter((r) => r.verdict === goodVerdict(doc.mode)).length;

  for (const [i, round] of doc.rounds.entries()) {
    if (round.state !== 'judged' && round.state !== 'revealed') continue;
    const agentLabel = labelFor('agent', round.agentTarget, doc.mode);
    const humanLabel = labelFor('human', round.humanTarget, doc.mode);
    lines.push(`## ${i + 1}. ${round.question}`);
    lines.push('');
    lines.push(`- **${agentLabel}** — ${round.agentAnswer}`);
    pushImages(lines, imagesFor(round, 'agent'));
    if (round.humanAnswer !== null) {
      lines.push(`- **${humanLabel}** — ${round.humanAnswer}`);
      pushImages(lines, imagesFor(round, 'human'));
    }
    if (round.verdict) lines.push(`- verdict: **${round.verdict}**`);
    lines.push('');
  }

  lines.push('---', '');
  /* A watched game was never scored, so the keepsake reports a count and not a
     rate. Printing "0 of 8 landed" over eight unjudged readings would be the
     same lie renderPortrait already told once. */
  lines.push(isWatching(doc)
    ? `${done.length} readings, and no verdicts — this was a watch, not a game.`
    : `${matched} of ${done.length} judged ${goodVerdict(doc.mode)}.`);
  lines.push('');
  return lines.join('\n');
}

/* The first screen a player with an agent actually sees.

   It used to open on "Two ways to play" with no statement of what the game is
   and, more usefully, no statement of whether the other player had arrived. The
   runbook's own step 4 tells the operator to confirm an entry point and a tool
   count before saying anything — that check lived only in 11px of mono in the
   corner. It belongs here, at full size, on the screen where you decide to
   begin. */
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
    <p class="start__eyebrow">a game for you and your agent</p>
    <h2 class="start__title">Two ways to play</h2>
    ${presence}

    <div class="start__modes">
      <button type="button" class="start__mode" data-mode="portrait">
        <strong>Portrait</strong>
        <span>You each answer about the other. Nothing here has a right answer —
        the point is the gap between how you see each other.</span>
      </button>
      <button type="button" class="start__mode" data-mode="quiz">
        <strong>Quiz</strong>
        <span>Real questions with real answers. One of you knows, the other guesses.
        Match ${QUIZ_PASS} of 8 to pass.</span>
      </button>
    </div>

    <label class="start__opt">
      <input type="checkbox" id="opt-about-agent" checked>
      In Portrait, I want to answer about my agent too
    </label>
    <p class="start__note">Uncheck it and only your agent answers, and you read what it made of you.</p>
  </section>`;
}

/* One answer at the centre of its own four images.

   The answer sits on the intersection where all four meet — not above the grid
   and not beside it — which is the whole visual idea: the words are the axis the
   pictures turn around. A radial scrim darkens the middle so the type survives
   photography the page has never seen.

   alt is empty by design. These images illustrate an answer that is already in
   the DOM as text directly beneath them, and a credit is not a description — so
   captioning them with the photographer's name would tell a screen reader less
   than the silence does. */
function composition(label, answer, images) {
  const cells = images.map((image) => `<img src="${escapeHtml(image.url)}" alt=""
          loading="lazy" decoding="async" referrerpolicy="no-referrer">`).join('\n        ');

  /* Deduplicated. Four images from one source produced the same credit four
     times, and a caption that repeats itself reads as a bug rather than as
     attribution. Attribution still has to be visible — that is the whole reason
     the manual asks for licensed sources — so it is shortened, not dropped. */
  const credits = [...new Set(images
    .map((image) => [image.credit, image.license].filter(Boolean).join(' · '))
    .filter(Boolean))];

  return `<figure class="composition">
      <figcaption class="composition__label">${escapeHtml(label)}</figcaption>
      <div class="composition__frame">
        <div class="composition__grid">
        ${cells}
        </div>
        <p class="composition__answer"><span>${escapeHtml(answer)}</span></p>
      </div>
      ${credits.length
        ? `<p class="composition__credits">${escapeHtml(credits.join(' — '))}</p>`
        : ''}
    </figure>`;
}

/* An answer renders as a composition when it has images and as a line of text
   when it does not, and the two sit in the same list without argument.

   That fallback is the feature's most important property. An agent with no way
   to fetch images makes no illustrate_answer calls, and this screen renders
   exactly as it did before the gallery existed — no empty frames, nothing
   missing, nothing broken. */
function resultAnswer(label, answer, images) {
  if (answer === null || answer === undefined) return '';
  if (images && images.length) return composition(label, answer, images);
  return `<p class="results__answer"><span>${escapeHtml(label)}</span>${escapeHtml(answer)}</p>`;
}

export function renderResults(doc) {
  const judged = doc.rounds.filter((r) => r.state === 'judged');
  const good = goodVerdict(doc.mode);
  const hits = judged.filter((r) => r.verdict === good).length;

  const headline = doc.mode === 'quiz'
    ? `<p class="results__verdict ${hits >= QUIZ_PASS ? 'is-pass' : 'is-fail'}">${
        hits >= QUIZ_PASS ? 'PASSED' : 'NOT PASSED'}</p>
       <p class="results__rate">${hits} of ${judged.length} matched — ${QUIZ_PASS} needed</p>`
    /* Nothing was scored, so nothing is scored here. */
    : isWatching(doc)
      ? `<p class="results__rate">${judged.length} readings</p>`
      : `<p class="results__rate">${hits} of ${judged.length} landed</p>`;

  const rows = doc.rounds.map((round, i) => {
    if (round.state !== 'judged') return '';
    const agentLabel = labelFor('agent', round.agentTarget, doc.mode);
    const humanLabel = labelFor('human', round.humanTarget, doc.mode);
    const agentImages = imagesFor(round, 'agent');
    const humanImages = imagesFor(round, 'human');
    const illustrated = Boolean(agentImages || humanImages);
    return `<article class="results__round" data-verdict="${round.verdict}" data-illustrated="${illustrated}">
      <h3>${i + 1}. ${escapeHtml(round.question)}</h3>
      ${resultAnswer(agentLabel, round.agentAnswer, agentImages)}
      ${resultAnswer(humanLabel, round.humanAnswer, humanImages)}
      ${round.verdict ? `<p class="results__mark">${round.verdict}</p>` : ''}
    </article>`;
  }).join('\n');

  return `<section class="results">
    <header class="results__head">
      <h2 class="results__title">${
        doc.mode === 'quiz' ? 'How well you know each other'
          : isWatching(doc) ? 'What your agent made of you'
          : 'How you saw each other'}</h2>
      ${headline}
    </header>
    ${rows}
    <div class="results__keep">
      <button type="button" data-action="export">Keep this</button>
      <p class="results__note">Three files, downloaded to this machine. Nothing
        here has ever left it.</p>
    </div>
  </section>`;
}

/* The offer. Rendered BELOW the round, never instead of it.

   The draft took over the stage at the grant moment, which meant you never saw
   round 4's two answers or its verdict — the reveal you had just earned was
   replaced by an offer. Additive here; the moment comes after the click. */
export function renderGrant(doc) {
  const watching = isWatching(doc);
  return `<section class="grant">
    <p class="grant__label">${watching
      ? `${DOSSIER_ROUND} rounds read`
      : `round ${DOSSIER_ROUND} is judged`}</p>
    <h3 class="grant__title">Your agent has been reading you blind.</h3>
    <p class="grant__body">You can open the dossier to it — ${watching
      ? 'everything it has said about you so far, gathered in one place'
      : 'every round so far, both columns, with your verdicts'}. It is the only
      way it learns anything about you that it did not guess. There is no tool it
      can call to take this; the grant is yours alone.</p>
    <div class="grant__controls">
      <button type="button" data-action="grant">Open the dossier</button>
    </div>
    <p class="grant__note">Or press Next round and keep it closed. That is a real
      choice, and ${watching ? 'the reading goes on' : 'the game plays on'} either way.</p>
  </section>`;
}

/* The transmission. The second signature moment, and the most WebMCP-native
   beat in the game: the agent's body grows mid-session because a human clicked.

   No new hue — cyan still means committed, amber still means revealed. The
   moment is carried by the ground lifting, the verb resolving in mono at
   display scale, and the status bar's tool count ticking 5 -> 6 on its own. */
export function renderGranted(doc) {
  const before = toolNamesFor(doc.mode, 1);
  const after = toolNamesFor(doc.mode, 2);
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

    <p class="transmission__body">Its body grew mid-session because you clicked.
      Nothing it could call would have done this.</p>

    <div class="transmission__controls">
      <button type="button" data-action="dismiss">Continue</button>
    </div>
  </section>`;
}

/* The shell asks for one thing and gets whichever screen is current.

   `transmissionSeen` is a version number the shell holds — the renderer stays
   pure, so Node tests set it directly and no dismissal event pollutes the
   journey export, which is evidence. */
export function renderGame(doc, { transmissionSeen } = {}) {
  if (justGranted(doc) && transmissionSeen !== doc.version) return renderGranted(doc);
  if (isComplete(doc)) return renderResults(doc);
  return renderRound(doc) + (atGrantMoment(doc) ? renderGrant(doc) : '');
}
