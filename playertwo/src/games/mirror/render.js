/* Presentation. Pure: state in, string out, no DOM.

   Purity is the point rather than a preference — it is what lets the secrecy
   test assert on the rendered output in Node. If this module ever reaches for
   `document`, the game's central promise stops being testable. */

import {
  isExcused, readyToReveal, isComplete, lastRefusal, atGrantMoment, justGranted, DOSSIER_ROUND,
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

function answerCard(who, label, state, answer, revealed) {
  const body = revealed
    ? `<p class="answer">${escapeHtml(answer)}</p>`
    : answer !== null
      ? '<p class="status committed">committed</p>'
      : '<p class="status waiting">waiting</p>';
  /* Cyan retires at the reveal. It means `committed`, and once the answer is
     readable that is no longer news — leaving the halo on would put the card in
     two states at once and make the loudest thing on screen compete with the
     amber it is supposed to be handing over to. */
  return `<article class="card card--${who}" data-committed="${answer !== null && !revealed}">
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

export function renderRound(doc) {
  const round = doc.rounds[doc.roundIndex];
  const revealed = round.state === 'revealed' || round.state === 'judged';
  const agentLabel = labelFor('agent', round.agentTarget, doc.mode);
  const humanLabel = labelFor('human', round.humanTarget, doc.mode);
  const canAnswer = round.state === 'agent_committed' && !isExcused(doc);

  const controls = [];
  if (readyToReveal(doc, round)) {
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
  if (round.state === 'judged' && doc.roundIndex + 1 < doc.rounds.length) {
    controls.push('<button type="button" data-action="next">Next round</button>');
  }

  return `<section class="round" data-state="${round.state}">
    <header class="round__head">
      <p class="round__count">Round ${doc.roundIndex + 1} of ${doc.rounds.length}</p>
      <h2 class="round__question">${escapeHtml(round.question)}</h2>
      <p class="round__subject">${escapeHtml(agentLabel.toLowerCase())}</p>
    </header>

    ${refusalPanel(doc)}

    <div class="round__cards">
      ${answerCard('agent', agentLabel, round.state, round.agentAnswer, revealed)}
      ${answerCard('human', humanLabel, round.state, round.humanAnswer, revealed)}
    </div>

    ${isExcused(doc) ? `<p class="round__excused">This round is your agent’s alone.</p>` : `<form class="round__form" data-action="human_submit">
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

  lines.push('---', '', `${matched} of ${done.length} judged ${goodVerdict(doc.mode)}.`, '');
  return lines.join('\n');
}

export function renderStart() {
  return `<section class="start">
    <h2 class="start__title">Two ways to play</h2>

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
  if (answer === null) return '';
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
      <p class="results__mark">${round.verdict}</p>
    </article>`;
  }).join('\n');

  return `<section class="results">
    <header class="results__head">
      <h2 class="results__title">${doc.mode === 'quiz' ? 'How well you know each other' : 'How you saw each other'}</h2>
      ${headline}
    </header>
    ${rows}
    <p class="results__note">Press Export to keep this.</p>
  </section>`;
}

/* The offer. Rendered BELOW the round, never instead of it.

   The draft took over the stage at the grant moment, which meant you never saw
   round 4's two answers or its verdict — the reveal you had just earned was
   replaced by an offer. Additive here; the moment comes after the click. */
export function renderGrant(doc) {
  return `<section class="grant">
    <p class="grant__label">round ${DOSSIER_ROUND} is judged</p>
    <h3 class="grant__title">Your agent has been reading you blind.</h3>
    <p class="grant__body">You can open the dossier to it — every round so far,
      both columns, with your verdicts. It is the only way it learns anything
      about you that it did not guess. There is no tool it can call to take
      this; the grant is yours alone.</p>
    <div class="grant__controls">
      <button type="button" data-action="grant">Open the dossier</button>
    </div>
    <p class="grant__note">Or press Next round and keep it closed. That is a real
      choice, and the game plays on either way.</p>
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
