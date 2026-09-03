/* What an agent finds when it ARRIVES, before a game exists.

   The runbook's step 4 says: confirm the status bar names an entry point and a
   tool count BEFORE saying anything. The video's opening beat is that status bar
   reading five tools — the agent's whole body, none of which can reveal, judge
   or advance.

   Both assume tools register on arrival. A fresh page has no saved game, so
   `doc` is null until the human picks a mode on the start screen, and every
   tool reads through ctx.getDoc(). These tests pin the arrival path. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTools } from '../src/games/mirror/tools.js';
import { registerTools } from '../src/webmcp.js';
import { createWaitRegistry } from '../src/waiters.js';
import { createDoc } from '../src/games/mirror/game.js';

/* shell.js's ctx, in the state boot() finds it in on a fresh page. */
function arrivingCtx() {
  let doc = null;
  return {
    getDoc: () => doc,
    setDoc: (next) => { doc = next; },
    start: (mode) => { doc = createDoc(0, { mode }); },
    now: () => 0,
    waits: createWaitRegistry()
  };
}

test('the tool surface builds before a game exists', () => {
  const tools = buildTools(arrivingCtx());
  assert.equal(tools.length, 5,
    'an arriving agent must find its whole body, not an exception');
  assert.deepEqual(tools.map((t) => t.name),
    ['get_round', 'wait_for_game_update', 'submit_answer', 'say', 'get_field_manual']);
});

test('registration reports five tools on arrival', async () => {
  const registered = [];
  const mc = { registerTool: async (t) => { registered.push(t.name); } };
  const result = await registerTools(mc, buildTools(arrivingCtx()));

  assert.deepEqual(result.errors, [], 'registration must not error on a fresh page');
  assert.equal(result.registered, 5,
    'the status bar reads this number, and the video opens on it');
});

/* Every tool is reachable the moment it is registered, so every tool must have
   an answer for "there is no game yet" that is not a crash. */
test('every tool answers helpfully before a game exists', async () => {
  const ctx = arrivingCtx();
  for (const tool of buildTools(ctx)) {
    if (tool.name === 'wait_for_game_update') continue;   // covered below
    const input = tool.name === 'submit_answer' || tool.name === 'say'
      ? { text: 'anything' }
      : {};
    const out = await tool.execute(input, {});
    const body = out.content.map((c) => c.text).join('');
    assert.ok(body.length > 0, `${tool.name} returned nothing`);
    assert.match(body, /no game|not started|pick|chooses|mode/i,
      `${tool.name} should say a game has not started, and said: ${body.slice(0, 120)}`);
  }
});

test('an agent that arrives early can wait for the game to start', async () => {
  const ctx = arrivingCtx();
  const wait = buildTools(ctx).find((t) => t.name === 'wait_for_game_update');

  const pending = wait.execute({ since: 0, timeout_ms: 2000 }, {});
  /* The human picks a mode on the start screen; shell.js notifies the registry. */
  setTimeout(() => { ctx.start('portrait'); ctx.waits.notify(ctx.getDoc().version); }, 20);

  const out = await pending;
  const body = out.content.map((c) => c.text).join('');
  assert.doesNotMatch(body, /timedOut/,
    'the wait must wake when the game starts, not sit until its timeout');
  assert.match(body, /"round": 1/, 'and it must return the first round');
});

test('the manual is readable before a game exists', async () => {
  const manual = buildTools(arrivingCtx()).find((t) => t.name === 'get_field_manual');
  const body = (await manual.execute({}, {})).content.map((c) => c.text).join('');
  assert.match(body, /YOU ANSWER FIRST/,
    'an agent reading the manual on arrival must still learn the ordering');
});
