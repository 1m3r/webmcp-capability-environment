/* Presentation. Pure: state in, string out, no DOM.

   Purity is the point rather than a preference — it is what lets the secrecy
   test assert on the rendered output in Node. If this module ever reaches for
   `document`, the game's central promise stops being testable. */

import { isExcused, readyToReveal } from './game.js';

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
  if (round.state === 'revealed') {
    controls.push('<button type="button" data-action="judge" data-verdict="match">Match</button>');
    controls.push('<button type="button" data-action="judge" data-verdict="miss">Miss</button>');
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
  const matched = done.filter((r) => r.verdict === 'match').length;

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

  lines.push('---', '', `${matched} of ${done.length} judged a match.`, '');
  return lines.join('\n');
}
