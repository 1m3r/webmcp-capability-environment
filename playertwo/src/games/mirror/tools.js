/* The agent's entire contact with this game.

   No DOM. The tools read and write through the ctx callbacks, so this module is
   exercised in Node exactly as it runs in the page.

   Two rules hold everywhere here:
     - a locked verb is ABSENT from the surface, never present and refusing, so
       the agent can see its own capability grow;
     - the document is persisted on refusals too, because a refusal that never
       reaches the log is invisible in the run record. */

import {
  reduce, projectForAgent, toolNamesFor, unillustrated, COMPOSITION_SIZE
} from './game.js';
import { manualFor } from './manual.js';
import { buildDossier } from './dossier.js';

export { toolNamesFor };

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

/* An agent can arrive before the game exists.

   A fresh page has no saved document, and the mode is chosen by the human on the
   start screen — so between registration and that click, ctx.getDoc() is null
   while every tool is already callable. This used to throw a TypeError out of
   buildTools during boot, which meant no tools registered at all: the status bar
   read `0 tools` on arrival, the runbook's own pre-run check was unsatisfiable,
   and the video's opening beat did not exist.

   The answer names the next call rather than just reporting the state. An agent
   told to wait will wait; an agent told nothing will ask its teammate, which is
   the behaviour v2 exists to remove. */
const NO_GAME =
  'No game has started yet. Your teammate picks the mode on the shared screen — ' +
  'Portrait or Quiz — and round 1 is posed the moment they do. Call ' +
  'wait_for_game_update with `since: 0` and it will return as soon as the game begins.';

export function buildTools(ctx) {
  const now = () => (typeof ctx.now === 'function' ? ctx.now() : 0);

  const apply = (action) => {
    const result = reduce(ctx.getDoc(), action, now());
    ctx.setDoc(result.doc);
    return result;
  };

  /* Wraps an execute so it answers instead of throwing before there is a game. */
  const needsGame = (run) => async (input, options = {}) => {
    if (!ctx.getDoc()) return text(NO_GAME);
    return run(input, options);
  };

  const getRound = {
    name: 'get_round',
    description:
      'Returns the round in play: its question, who it is about, how far through the game you are, ' +
      'and whether each of you has committed an answer. Neither answer is included until your ' +
      'teammate reveals the round.',
    annotations: { readOnlyHint: true },
    inputSchema: { type: 'object', properties: {} },
    execute: needsGame(async () => {
      apply({ type: 'read', text: 'get_round' });
      return text(JSON.stringify(projectForAgent(ctx.getDoc()), null, 2));
    })
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
        currentVersion: ctx.getDoc()?.version ?? 0,
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
      if (!ctx.getDoc()) return text(NO_GAME);
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
    execute: needsGame(async (input) => {
      const { text: answer } = unwrap(input);
      const result = apply({ type: 'agent_submit', text: answer });
      if (!result.ok) return text(result.message);
      const doc = ctx.getDoc();
      return text(
        `Committed for round ${doc.roundIndex + 1} of ${doc.rounds.length}. ` +
        'Your teammate can now answer. You will see both answers when they reveal the round.'
      );
    })
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
    execute: needsGame(async (input) => {
      const { text: message } = unwrap(input);
      const result = apply({ type: 'say', text: message });
      return text(result.ok ? `Said on the shared screen: ${message}` : result.message);
    })
  };

  const getFieldManual = {
    name: 'get_field_manual',
    description: 'Returns how this game works and how to play it well, as plain text.',
    annotations: { readOnlyHint: true },
    inputSchema: { type: 'object', properties: {} },
    execute: async (_input, _options = {}) => {
      const doc = ctx.getDoc();
      /* Deliberately NOT gated behind needsGame. Whether the agent reaches for
         the manual unprompted on arrival is the measurement this repository has
         taken at every level, and on arrival there is no game — refusing it here
         would refuse the exact call the whole experiment is watching for. */
      if (!doc) return text(manualFor(1, null));
      apply({ type: 'read', text: 'get_field_manual' });
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
    execute: needsGame(async () => {
      apply({ type: 'read', text: 'get_dossier' });
      return text(buildDossier(ctx.getDoc()));
    })
  };

  /* The page cannot do this and the agent can.

     Every other tool here is the page lending the agent a way to act inside a
     world the page owns. This one is the opposite: the page describes a
     capability it does not have — it is static, offline, dependency-free and
     holds no key — and leaves the agent to supply it. How the images are found,
     with subagents or search or anything else, is the agent's business and the
     page never asks. */
  const illustrateAnswer = {
    name: 'illustrate_answer',
    description:
      'Attaches four images to one revealed answer, yours or your teammate’s. At the end of the ' +
      'game every answer is shown at the centre of its own four, so the two of you can see what ' +
      'you each meant. Find images that match the ANSWER, not the question. Use sources whose ' +
      'licence allows reuse — Openverse, Wikimedia Commons, Unsplash, Pexels — because this is ' +
      'meant to be shareable, and pass the credit and licence with each one. Roughly square ' +
      'images sit best. You can only illustrate a round your teammate has already revealed.',
    inputSchema: {
      type: 'object',
      properties: {
        round: { type: 'number', description: 'Which round, from 1.' },
        whose: {
          type: 'string',
          enum: ['agent', 'human'],
          description: '"agent" for your own answer, "human" for your teammate’s.'
        },
        images: {
          type: 'array',
          minItems: COMPOSITION_SIZE,
          maxItems: COMPOSITION_SIZE,
          description: `Exactly ${COMPOSITION_SIZE} images, arranged as a 2x2 behind the answer.`,
          items: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'Direct http(s) link to the image itself.' },
              credit: { type: 'string', description: 'Who made it, as it should be shown.' },
              license: { type: 'string', description: 'e.g. CC BY 4.0, Unsplash License.' },
              source: { type: 'string', description: 'The page the image was found on.' }
            },
            required: ['url']
          }
        }
      },
      required: ['round', 'whose', 'images']
    },
    execute: needsGame(async (input) => {
      const args = unwrap(input);
      const result = apply({
        type: 'illustrate',
        round: args.round,
        whose: args.whose,
        images: args.images
      });
      if (!result.ok) return text(result.message);

      const left = unillustrated(ctx.getDoc());
      if (left.length === 0) {
        return text(
          `Round ${args.round} illustrated. Every revealed answer now has its four images — ` +
          'the gallery is complete.'
        );
      }
      const next = left.map((a) => `round ${a.round} (${a.whose})`).join(', ');
      return text(
        `Round ${args.round} illustrated. Still waiting on: ${next}.`
      );
    })
  };

  const tools = [getRound, waitForGameUpdate, submitAnswer, say, getFieldManual];
  const doc = ctx.getDoc();
  /* Mode-gated, not refusing: a verb this game does not offer is absent. With no
     game yet the mode is unchosen, so the portrait-only verb waits for it — and
     syncTools() re-registers the moment the human picks. */
  if (doc && doc.mode === 'portrait') tools.push(illustrateAnswer);
  if ((doc?.tier ?? 1) >= 2) tools.push(getDossier);
  return tools;
}
