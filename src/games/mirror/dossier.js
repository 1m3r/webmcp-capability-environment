/* The portrait the page assembles and hands to the agent at tier 2.

   Filed by TARGET, not by who wrote it: in portrait mode the agent's answer
   describes the human and the human's answer describes the agent, so a round
   contributes one line to each section.

   This is a second channel onto the same answers, so it obeys the same rule as
   the projection and the renderer: a round that has not been revealed is not in
   here. */

import { labelFor } from './render.js';

function entriesFor(doc, target) {
  const lines = [];
  for (const round of doc.rounds) {
    if (round.state !== 'revealed' && round.state !== 'judged') continue;
    const written = [];
    if (round.agentTarget === target && round.agentAnswer !== null) {
      written.push(`    ${labelFor('agent', round.agentTarget, doc.mode)}: ${round.agentAnswer}`);
    }
    if (round.humanTarget === target && round.humanAnswer !== null) {
      written.push(`    ${labelFor('human', round.humanTarget, doc.mode)}: ${round.humanAnswer}`);
    }
    if (written.length === 0) continue;
    lines.push(`  ${round.question}`, ...written);
    if (round.verdict) lines.push(`    -> judged a ${round.verdict}`);
  }
  return lines;
}

function section(title, lines) {
  return lines.length === 0 ? [`${title}\n  nothing recorded yet.`] : [title, ...lines];
}

export function buildDossier(doc) {
  const seen = doc.rounds.filter((r) => r.state === 'revealed' || r.state === 'judged');
  if (seen.length === 0) {
    return 'DOSSIER\n\nNothing has been revealed yet, so there is nothing here to learn from. ' +
           'Play a round and it will fill in.';
  }

  const judged = seen.filter((r) => r.verdict !== null);
  const good = doc.mode === 'quiz' ? 'match' : 'landed';
  const hits = judged.filter((r) => r.verdict === good).length;

  return [
    'DOSSIER — what this page has recorded so far',
    '',
    ...section('About your teammate (the human)', entriesFor(doc, 'human')),
    '',
    ...section('About you (the agent)', entriesFor(doc, 'agent')),
    '',
    `${hits} of ${judged.length} ${doc.mode === 'quiz' ? 'matched' : 'landed'}.`,
    '',
    'Use this. A miss tells you more than a hit does: it is the shape of a wrong assumption.'
  ].join('\n');
}
