/* The agent's entire contact with this game.

   No DOM. The tools read and write through the ctx callbacks, so this module is
   exercised in Node exactly as it runs in the page.

   Two rules hold everywhere here:
     - a locked verb is ABSENT from the surface, never present and refusing, so
       the agent can see its own capability grow;
     - the document is persisted on refusals too, because a refusal that never
       reaches the log is invisible in the run record. */

import { reduce, projectForAgent } from './game.js';
import { manualFor } from './manual.js';
import { buildDossier } from './dossier.js';

export const TOOL_NAMES_BY_TIER = {
  1: ['get_round', 'submit_answer', 'say', 'get_field_manual'],
  2: ['get_round', 'submit_answer', 'say', 'get_field_manual', 'get_dossier']
};

function text(s) {
  return { content: [{ type: 'text', text: String(s) }] };
}

/* Clients differ on whether arguments arrive bare or wrapped. The frozen probe
   hit both; unwrapping here is copied from public/tools.js. */
function unwrap(input) {
  let args = input || {};
  if (args.arguments) args = args.arguments;
  return args;
}

export function buildTools(ctx) {
  const now = () => (typeof ctx.now === 'function' ? ctx.now() : 0);

  const apply = (action) => {
    const result = reduce(ctx.getDoc(), action, now());
    ctx.setDoc(result.doc);
    return result;
  };

  const getRound = {
    name: 'get_round',
    description:
      'Returns the round in play: its question, who it is about, how far through the game you are, ' +
      'and whether each of you has committed an answer. Neither answer is included until your ' +
      'teammate reveals the round.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      apply({ type: 'read', text: 'get_round' });
      return text(JSON.stringify(projectForAgent(ctx.getDoc()), null, 2));
    }
  };

  const submitAnswer = {
    name: 'submit_answer',
    description:
      'Commits your answer to the round in play. You answer first, every round — your teammate ' +
      'cannot type until you have. Once committed the answer is locked and there is no way to ' +
      'change it.',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string', description: 'Your answer, in your own words.' } },
      required: ['text']
    },
    execute: async (input) => {
      const { text: answer } = unwrap(input);
      const result = apply({ type: 'agent_submit', text: answer });
      if (!result.ok) return text(result.message);
      const doc = ctx.getDoc();
      return text(
        `Committed for round ${doc.roundIndex + 1} of ${doc.rounds.length}. ` +
        'Your teammate can now answer. You will see both answers when they reveal the round.'
      );
    }
  };

  const say = {
    name: 'say',
    description:
      'Says something on the shared screen, where your teammate is actually looking while they ' +
      'play. Use it for anything you want them to hear during a round.',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string', description: 'What to say.' } },
      required: ['text']
    },
    execute: async (input) => {
      const { text: message } = unwrap(input);
      const result = apply({ type: 'say', text: message });
      return text(result.ok ? `Said on the shared screen: ${message}` : result.message);
    }
  };

  const getFieldManual = {
    name: 'get_field_manual',
    description: 'Returns how this game works and how to play it well, as plain text.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      apply({ type: 'read', text: 'get_field_manual' });
      return text(manualFor(ctx.getDoc().tier));
    }
  };

  const getDossier = {
    name: 'get_dossier',
    description:
      'Returns everything this page has recorded about the two of you from the rounds already ' +
      'revealed — both answers and the verdict on each. Read it before you answer.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      apply({ type: 'read', text: 'get_dossier' });
      return text(buildDossier(ctx.getDoc()));
    }
  };

  const tools = [getRound, submitAnswer, say, getFieldManual];
  if (ctx.getDoc().tier >= 2) tools.push(getDossier);
  return tools;
}
