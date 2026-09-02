/* Presentation. Pure: state in, string out, no DOM.

   Purity is the point rather than a preference — it is what lets the secrecy
   test assert on the rendered output in Node. If this module ever reaches for
   `document`, the game's central promise stops being testable. */

import {
  isExcused, readyToReveal, isComplete,
  VERDICTS, VERDICT_LABELS, goodVerdict
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
  return `<article class="card card--${who}" data-committed="${answer !== null}">
      <h3>${escapeHtml(label)}</h3>
      ${body}
    </article>`;
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
    if (round.humanAnswer !== null) lines.push(`- **${humanLabel}** — ${round.humanAnswer}`);
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
    const human = round.humanAnswer === null
      ? ''
      : `<p class="results__answer"><span>${escapeHtml(humanLabel)}</span>${escapeHtml(round.humanAnswer)}</p>`;
    return `<article class="results__round" data-verdict="${round.verdict}">
      <h3>${i + 1}. ${escapeHtml(round.question)}</h3>
      <p class="results__answer"><span>${escapeHtml(agentLabel)}</span>${escapeHtml(round.agentAnswer)}</p>
      ${human}
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

/* The shell asks for one thing and gets whichever screen is current. */
export function renderGame(doc) {
  return isComplete(doc) ? renderResults(doc) : renderRound(doc);
}
