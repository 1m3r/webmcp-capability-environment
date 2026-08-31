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
  1: ['get_round', 'wait_for_game_update', 'submit_answer', 'say', 'get_field_manual'],
  2: ['get_round', 'wait_for_game_update', 'submit_answer', 'say', 'get_field_manual', 'get_dossier']
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
    annotations: { readOnlyHint: true },
    inputSchema: { type: 'object', properties: {} },
    execute: async (_input, _options = {}) => {
      apply({ type: 'read', text: 'get_round' });
      return text(JSON.stringify(projectForAgent(ctx.getDoc()), null, 2));
    }
  };

  /* The one tool in this codebase that touches no state.

     Every other read goes through apply(), and every reduce bumps the version.
     If this one did the same, its own log entry would change the version it is
     waiting on and it would wake itself instantly, on every call, forever —
     a long poll that is really a busy loop. Do not "tidy" this into
     consistency with its neighbours. */
  const waitForGameUpdate = {
    name: 'wait_for_game_update',
    description:
      'Waits until your teammate does something, then returns the round exactly as get_round would. ' +
      'Pass the version you last saw as `since`. Use this after you commit an answer instead of ' +
      'asking your teammate whether they are done — they are looking at the page, not at this ' +
      'conversation. Returns early with timedOut if nothing happened; just call it again.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        since: {
          type: 'number',
          description: 'The version number you last saw, from get_round or a previous wait.'
        },
        timeout_ms: {
          type: 'number',
          description: 'How long to wait before returning timedOut. Default 25000, maximum 60000.'
        }
      },
      required: ['since']
    },
    execute: async (input, options = {}) => {
      const args = unwrap(input);
      const since = Number(args.since);
      if (!Number.isFinite(since)) {
        return text(
          'refused: `since` must be the version number you last saw — call get_round first and ' +
          'pass its `version` back here.'
        );
      }

      const outcome = await ctx.waits.wait({
        since,
        currentVersion: ctx.getDoc().version,
        timeoutMs: args.timeout_ms,
        signal: options.signal
      });

      if (outcome.disposed) {
        return text(JSON.stringify({ disposed: true, note: 'The page closed. The game is over.' }));
      }
      if (outcome.reset) {
        return text(JSON.stringify({
          reset: true,
          version: outcome.version,
          note: 'Your teammate restarted the game. Call get_round and start again.'
        }, null, 2));
      }
      if (outcome.timedOut) {
        return text(JSON.stringify({
          timedOut: true,
          version: outcome.version,
          note: 'Nothing changed while waiting. Call wait_for_game_update again with this version.'
        }, null, 2));
      }
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
    execute: async (input, _options = {}) => {
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
    execute: async (input, _options = {}) => {
      const { text: message } = unwrap(input);
      const result = apply({ type: 'say', text: message });
      return text(result.ok ? `Said on the shared screen: ${message}` : result.message);
    }
  };

  const getFieldManual = {
    name: 'get_field_manual',
    description: 'Returns how this game works and how to play it well, as plain text.',
    annotations: { readOnlyHint: true },
    inputSchema: { type: 'object', properties: {} },
    execute: async (_input, _options = {}) => {
      apply({ type: 'read', text: 'get_field_manual' });
      const doc = ctx.getDoc();
      return text(manualFor(doc.tier, doc.mode));
    }
  };

  const getDossier = {
    name: 'get_dossier',
    description:
      'Returns everything this page has recorded about the two of you from the rounds already ' +
      'revealed — both answers and the verdict on each. Read it before you answer.',
    annotations: { readOnlyHint: true },
    inputSchema: { type: 'object', properties: {} },
    execute: async (_input, _options = {}) => {
      apply({ type: 'read', text: 'get_dossier' });
      return text(buildDossier(ctx.getDoc()));
    }
  };

  const tools = [getRound, waitForGameUpdate, submitAnswer, say, getFieldManual];
  if (ctx.getDoc().tier >= 2) tools.push(getDossier);
  return tools;
}
