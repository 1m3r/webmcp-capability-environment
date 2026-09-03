/* The dossier: what the page hands the agent at tier 2.

   It reads GRANTED HISTORY and nothing else. The sitting in play is never in
   it — not revealed rounds, not judged rounds, nothing — because the thing that
   keeps a perspective honest is that the agent gets no feedback until the
   human closes the sitting and decides what to open. That property lives in
   the shape of this function, not in a sentence asking the agent to look away.

   Three grants:
     open    every round: the read, the response, the correction
     kept    only the rounds the human marked as landing
     sealed  the sitting's existence and nothing more */

import { labelFor } from './render.js';
import { goodVerdict } from './game.js';

function roundLines(round, mode) {
  const lines = [`  ${round.question}`];
  if (round.agentAnswer !== null) {
    lines.push(`    ${labelFor('agent', round.agentTarget, mode)}: ${round.agentAnswer}`);
    if (round.agentBecause) lines.push(`      because: ${round.agentBecause}`);
  }
  if (round.humanAnswer !== null) {
    lines.push(`    ${labelFor('human', round.humanTarget, mode)}: ${round.humanAnswer}`);
  }
  if (round.verdict) {
    lines.push(mode === 'perspective'
      ? `    -> ${round.verdict === 'me' ? 'they said: that’s me' : 'they said: not quite'}`
      : `    -> judged a ${round.verdict}`);
  }
  if (round.correction) lines.push(`    -> their correction: ${round.correction}`);
  return lines;
}

function sittingLines(sitting) {
  const head = `SITTING ${sitting.n} — ${sitting.title}`;
  if (sitting.grant === 'sealed') {
    return [head, '  Sealed by your teammate. It happened; nothing from it is open to you.'];
  }
  const rounds = sitting.grant === 'kept'
    ? sitting.rounds.filter((r) => r.verdict === goodVerdict(sitting.mode))
    : sitting.rounds;
  const lines = [head + (sitting.grant === 'kept' ? ' — only the reads they kept' : '')];
  if (rounds.length === 0) {
    lines.push('  They kept none of it.');
  }
  for (const round of rounds) lines.push(...roundLines(round, sitting.mode));
  return lines;
}

export function buildDossier(doc) {
  if (doc.history.length === 0) {
    return 'DOSSIER\n\nNo sitting has been closed yet, so there is nothing here to learn from. ' +
           'It fills in when your teammate closes a sitting and chooses what to open to you.';
  }

  const out = ['DOSSIER — what your teammate has opened to you', ''];
  for (const sitting of doc.history) {
    out.push(...sittingLines(sitting), '');
  }

  const openCount = doc.history.filter((s) => s.grant !== 'sealed').length;
  out.push(
    `${doc.history.length} ${doc.history.length === 1 ? 'sitting' : 'sittings'} closed, ` +
    `${openCount} open to you. The sitting in play is not here and will not be until they close it.`,
    '',
    doc.mode === 'perspective'
      ? 'Use this. A correction is worth more than a read that landed: it is the exact place your ' +
        'model of them was wrong, in their own words. Do not repeat a read they have already kept; ' +
        'go further from it.'
      : 'Use this. A miss tells you more than a hit does: it is the shape of a wrong assumption.'
  );
  return out.join('\n');
}
