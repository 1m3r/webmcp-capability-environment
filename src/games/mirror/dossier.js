/* The portrait the page assembles and hands to the agent at tier 2.

   This is a second channel onto the same answers, so it obeys the same rule as
   the projection and the renderer: a round that has not been revealed is not in
   here. A leak through the dossier would be exactly as fatal and much easier to
   miss, which is why dossier.test.js probes it directly. */

import { subjectLabels } from './render.js';

function section(title, rounds) {
  if (rounds.length === 0) return [`${title}\n  nothing recorded yet.`];
  const lines = [title];
  for (const round of rounds) {
    const labels = subjectLabels(round.subject);
    lines.push(`  ${round.question}`);
    lines.push(`    ${labels.human}: ${round.humanAnswer}`);
    lines.push(`    ${labels.agent}: ${round.agentAnswer}`);
    if (round.verdict) lines.push(`    -> judged a ${round.verdict}`);
  }
  return lines;
}

export function buildDossier(doc) {
  const seen = doc.rounds.filter((r) => r.state === 'revealed' || r.state === 'judged');
  if (seen.length === 0) {
    return 'DOSSIER\n\nNothing has been revealed yet, so there is nothing here to learn from. ' +
           'Play a round and it will fill in.';
  }

  const judged = seen.filter((r) => r.verdict !== null);
  const matched = judged.filter((r) => r.verdict === 'match').length;

  return [
    'DOSSIER — what this page has recorded so far',
    '',
    ...section('About your teammate (the human)', seen.filter((r) => r.subject === 'human')),
    '',
    ...section('About you (the agent)', seen.filter((r) => r.subject === 'agent')),
    '',
    `${matched} of ${judged.length} judged a match.`,
    '',
    'Use this. A miss tells you more than a match does: it is the shape of a wrong assumption.'
  ].join('\n');
}
