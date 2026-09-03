/* The portrait history: how the agent's reads of one question changed across
   sittings. Handed to the agent at tier 4.

   It obeys the same rule as the dossier, because it is the same channel seen
   lengthwise: GRANTED history only, kept sittings contribute only the reads
   the human kept, sealed sittings contribute nothing, and the sitting in play
   is never here. */

import { goodVerdict } from './game.js';

function grantedRounds(doc) {
  const out = [];
  for (const sitting of doc.history) {
    if (sitting.grant === 'sealed') continue;
    const good = goodVerdict(sitting.mode);
    for (const round of sitting.rounds) {
      if (sitting.grant === 'kept' && round.verdict !== good) continue;
      out.push({ sitting: sitting.n, title: sitting.title, round });
    }
  }
  return out;
}

function responseLine(round, mode) {
  if (!round.verdict) return '';
  const said = mode === 'perspective'
    ? (round.verdict === 'me' ? 'that’s me' : 'not quite')
    : round.verdict;
  return round.correction ? `${said} — "${round.correction}"` : said;
}

export function buildHistory(doc) {
  const granted = grantedRounds(doc);
  if (granted.length === 0) {
    return 'HISTORY\n\nNothing has been opened to you yet, so there is no history to read. ' +
           'It fills in as your teammate closes sittings and opens them.';
  }

  /* Group by question, in order of first appearance; questions asked more than
     once come first, because a change is what this tool is for. */
  const byQuestion = new Map();
  for (const entry of granted) {
    const key = entry.round.questionId;
    if (!byQuestion.has(key)) byQuestion.set(key, { question: entry.round.question, entries: [] });
    byQuestion.get(key).entries.push(entry);
  }
  const groups = [...byQuestion.values()].sort((a, b) => b.entries.length - a.entries.length);

  const out = ['HISTORY — how your reads of them have moved, by question', ''];
  for (const group of groups) {
    out.push(`${group.question}${group.entries.length > 1 ? `  (asked ${group.entries.length} times)` : ''}`);
    for (const { sitting, round } of group.entries) {
      out.push(`  sitting ${sitting}: ${round.agentAnswer}`);
      if (round.agentBecause) out.push(`    because: ${round.agentBecause}`);
      const response = responseLine(round, doc.mode);
      if (response) out.push(`    -> ${response}`);
    }
    out.push('');
  }
  out.push(
    'Use this. Where a read moved and then landed, you learned something; where it moved ' +
    'and still missed, you are guessing. The sitting in play is not here.'
  );
  return out.join('\n');
}
