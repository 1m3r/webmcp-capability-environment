/* The agent's entire contact with this game.

   No DOM. The tools read and write through the ctx callbacks, so this module is
   exercised in Node exactly as it runs in the page.

   Three rules hold everywhere here:
     - a locked verb is ABSENT from the surface, never present and refusing, so
       the agent can see its own capability grow;
     - the document is persisted on refusals too, because a refusal that never
       reaches the log is invisible in the run record;
     - anything the agent hands the page is checked at this boundary, not
       trusted and discovered broken on the results screen. */

import {
  reduce, projectForAgent, toolNamesFor, tierFor, inSitting, normaliseImage, COMPOSITION_SIZE
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

   A fresh page has no saved portrait, and the game is chosen by the human on the
   start screen — so between registration and that click, ctx.getDoc() is null
   while every tool is already callable. The answer names the next call rather
   than just reporting the state: an agent told to wait will wait; an agent told
   nothing will ask its teammate, which is the behaviour v2 exists to remove. */
const NO_GAME =
  'No game has started yet. Your teammate picks the game on the shared screen — Perspective, ' +
  'Both ways or Quiz — and then opens a sitting. Do not reply in chat and wait to be started: ' +
  'they are looking at the page, not at this conversation. Call wait_for_game_update with ' +
  '`since: 0` now, and it returns the instant they choose. If it returns timedOut, call it again.';

/* Loads every image through the page's loader and returns the urls that did
   not load. Absent loader: everything passes, which is what lets this run in
   Node with no DOM. A loader that throws is a loader that failed. */
async function rejectedBy(load, images) {
  if (typeof load !== 'function') return [];
  const outcomes = await Promise.all(images.map(async (image) => {
    try { return await load(image.url); } catch { return false; }
  }));
  return images.filter((_, i) => !outcomes[i]).map((image) => image.url);
}

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

  const doc = ctx.getDoc();
  const mode = doc ? doc.mode : null;

  const getRound = {
    name: 'get_round',
    description:
      'Returns the round in play: its question, who it is about, how far through the sitting you ' +
      'are, and whether each of you has committed an answer. Neither answer is included until your ' +
      'teammate reveals the round. Between sittings it says so.',
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
      'Pass the version you last saw as `since`. This is how you stay in the game: call it after ' +
      'every move of yours, and again every time it returns, from arrival until the sitting closes. ' +
      'Your teammate is looking at the page and will not type here to restart you between rounds. ' +
      'timedOut means nothing has happened yet, not that the game is over — call it again with the ' +
      'same version.',
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
          note: 'Your teammate started over. Call get_round and carry on from what it says.'
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

  /* One verb, shaped by the game. In Perspective the images are a slot in the
     call the agent has to make anyway — there is no second verb to forget, and
     the schema marks the slot required so the client enforces it before the
     page ever sees the call. */
  const imageSlot = {
    type: 'array',
    minItems: COMPOSITION_SIZE,
    maxItems: COMPOSITION_SIZE,
    description:
      `Exactly ${COMPOSITION_SIZE} images that illustrate your ANSWER, not the question. They are shown ` +
      'as a 2x2 behind your answer the moment your teammate sees it. Direct http(s) links to the image ' +
      'file itself; the page loads each one before accepting your answer and refuses any that fail. ' +
      'Use sources whose licence allows reuse — Wikimedia Commons, Openverse, Unsplash, Pexels — and ' +
      'pass the credit and licence. Roughly square images sit best; four that agree in tone beat four ' +
      'good pictures that do not.',
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
  };

  const becauseSlot = {
    type: 'string',
    description: 'One line on why — what about them made you answer this. Shown beside the answer at the reveal.'
  };

  const submitProperties = { text: { type: 'string', description: 'Your answer, in your own words.' } };
  const submitRequired = ['text'];
  if (mode === 'perspective') {
    submitProperties.because = becauseSlot;
    submitProperties.images = imageSlot;
    submitRequired.push('images');
  } else if (mode === 'both') {
    submitProperties.because = becauseSlot;
  }

  const submitAnswer = {
    name: 'submit_answer',
    description:
      (mode === 'perspective'
        ? 'Commits your read of your teammate for the round in play: the answer, why, and the four ' +
          'images that show it. '
        : 'Commits your answer to the round in play. ') +
      'You answer first, every round — the page does not move until you have. Once committed the ' +
      'answer is locked and there is no way to change it.',
    inputSchema: {
      type: 'object',
      properties: submitProperties,
      required: submitRequired
    },
    execute: needsGame(async (input) => {
      const args = unwrap(input);
      const current = ctx.getDoc();

      let images;
      let rejected = [];
      if (current.mode === 'perspective') {
        images = Array.isArray(args.images) ? args.images.map(normaliseImage).filter(Boolean) : [];
        /* Only a full set is worth loading; a wrong count is refused by the
           reducer without a single request. */
        if (images.length === COMPOSITION_SIZE) rejected = await rejectedBy(ctx.loadImage, images);
      }

      const result = apply({
        type: 'agent_submit', text: args.text, because: args.because, images, rejected
      });
      if (!result.ok) return text(result.message);

      const after = ctx.getDoc();
      return text(
        `Committed for round ${after.roundIndex + 1} of ${after.rounds.length}. ` +
        (after.mode === 'perspective'
          ? 'Your teammate is about to see it. Now call wait_for_game_update.'
          : 'Your teammate can now answer. You will see both answers when they reveal the round.')
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
      const current = ctx.getDoc();
      /* Deliberately NOT gated behind needsGame. Whether the agent reaches for
         the manual unprompted on arrival is the measurement this repository has
         taken at every level, and on arrival there is no game — refusing it here
         would refuse the exact call the whole experiment is watching for. */
      if (!current) return text(manualFor(1, null));
      apply({ type: 'read', text: 'get_field_manual' });
      return text(manualFor(tierFor(current), current.mode));
    }
  };

  const getDossier = {
    name: 'get_dossier',
    description:
      'Returns what your teammate has opened to you from the sittings already closed: the reads, ' +
      'their responses, and their corrections. Nothing from the sitting in play is ever in it. Read ' +
      'it before you answer.',
    annotations: { readOnlyHint: true },
    inputSchema: { type: 'object', properties: {} },
    execute: needsGame(async () => {
      apply({ type: 'read', text: 'get_dossier' });
      return text(buildDossier(ctx.getDoc()));
    })
  };

  const tools = [getRound, waitForGameUpdate, submitAnswer, say, getFieldManual];
  if (tierFor(doc) >= 2) tools.push(getDossier);
  return tools;
}

export { inSitting };
