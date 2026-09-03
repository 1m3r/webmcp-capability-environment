/* A journey that has never closed end to end is not a demo, it is a hope.

   A stub agent plays a whole sitting through the tools alone, the human closes
   it, the agent's body grows, and the second sitting is played with the dossier
   in hand. Every agent move goes through a tool, exactly as a live agent's
   would; every human move is a reducer action, exactly as a click is. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDoc, reduce, isComplete, inSitting } from '../src/games/mirror/game.js';
import { buildTools } from '../src/games/mirror/tools.js';
import { createWaitRegistry } from '../src/waiters.js';
import { QUIZ_PASS } from '../src/games/mirror/questions.js';
import { four } from './helpers.js';

function table(doc) {
  const box = { doc };
  const waits = createWaitRegistry();
  const ctx = {
    getDoc: () => box.doc,
    setDoc: (d) => { box.doc = d; waits.notify(d.version); },
    now: () => 0,
    waits
  };
  const human = (action) => {
    const result = reduce(box.doc, action);
    assert.ok(result.ok, `the human move ${action.type} was refused: ${result.message}`);
    ctx.setDoc(result.doc);
  };
  return { box, ctx, human };
}

/* A stub agent. It knows only what the tools tell it: it reads the manual once,
   reads the round, reads the dossier whenever the dossier exists, and answers
   with what the round's mode asks for. */
function stubAgent(ctx) {
  const seen = { manual: 0, dossier: [], rounds: [] };

  const call = async (name, args = {}) => {
    const tool = buildTools(ctx).find((t) => t.name === name);
    if (!tool) throw new Error(`the agent reached for ${name}, which is not registered`);
    return (await tool.execute(args, { signal: new AbortController().signal })).content[0].text;
  };

  return {
    seen,
    hasTool: (name) => buildTools(ctx).some((t) => t.name === name),
    async playRound() {
      if (seen.manual === 0) { await call('get_field_manual'); seen.manual++; }
      if (this.hasTool('get_dossier')) seen.dossier.push(await call('get_dossier'));
      const round = JSON.parse(await call('get_round'));
      seen.rounds.push(`${round.sitting}.${round.round}`);
      assert.ok(!('teammateAnswer' in round), 'the agent could see its teammate before answering');
      await call('say', { text: `thinking about round ${round.round}` });
      const args = { text: `agent answer ${round.sitting}.${round.round}`, because: 'a reason' };
      if (round.mode === 'perspective') args.images = four(`s${round.sitting}r${round.round}`);
      return call('submit_answer', args);
    },
    async wait(since) {
      return JSON.parse(await call('wait_for_game_update', { since, timeout_ms: 1000 }));
    }
  };
}

async function playSitting(agent, human, box, verdictFor) {
  const perspective = box.doc.mode === 'perspective';
  for (let i = 0; i < box.doc.rounds.length; i++) {
    const out = await agent.playRound();
    assert.match(out, /Committed/, out);
    if (!perspective) human({ type: 'human_submit', text: `human answer ${i + 1}` });
    human({ type: 'reveal' });
    human({ type: 'judge', verdict: verdictFor(i), correction: perspective ? `correction ${i + 1}` : '' });
    if (i + 1 < box.doc.rounds.length) human({ type: 'next' });
  }
  assert.equal(isComplete(box.doc), true);
}

test('two perspective sittings: the body grows at the first close, and the dossier carries what was opened', async () => {
  const { box, ctx, human } = table(createDoc(0, { mode: 'perspective' }));
  const agent = stubAgent(ctx);

  assert.equal(agent.hasTool('get_dossier'), false, 'the dossier must be closed at the start');
  human({ type: 'open_sitting', deckId: 'first-light' });

  await playSitting(agent, human, box, (i) => (i % 2 === 0 ? 'me' : 'not'));
  assert.equal(agent.hasTool('get_dossier'), false, 'finishing a sitting does not open the dossier');

  human({ type: 'close_sitting', grant: 'open' });
  assert.equal(agent.hasTool('get_dossier'), true, 'the human click must open it');
  assert.equal(inSitting(box.doc), false);

  human({ type: 'open_sitting', deckId: 'deep-water' });
  await playSitting(agent, human, box, () => 'me');

  assert.deepEqual(agent.seen.rounds, ['1.1', '1.2', '1.3', '1.4', '1.5', '2.1', '2.2', '2.3', '2.4', '2.5']);
  assert.equal(agent.seen.manual, 1);
  assert.equal(agent.seen.dossier.length, 5, 'the dossier was read before each round of sitting 2');
  for (const dossier of agent.seen.dossier) {
    assert.ok(dossier.includes('correction 2'), 'sitting 1 was opened, so its corrections are there');
    assert.ok(dossier.includes('agent answer 1.1'));
    assert.ok(!dossier.includes('agent answer 2.'), 'nothing from the sitting in play, ever');
  }

  human({ type: 'close_sitting', grant: 'sealed' });
  assert.equal(box.doc.level, 3);
  assert.ok(box.doc.rounds.length === 0);
});

test('a sealed first sitting shows the agent nothing but its existence', async () => {
  const { box, ctx, human } = table(createDoc(0, { mode: 'perspective' }));
  const agent = stubAgent(ctx);
  human({ type: 'open_sitting', deckId: 'first-light' });
  await playSitting(agent, human, box, () => 'not');
  human({ type: 'close_sitting', grant: 'sealed' });
  human({ type: 'open_sitting', deckId: 'first-light' });
  await agent.playRound();
  const [dossier] = agent.seen.dossier;
  assert.match(dossier, /Sealed/);
  assert.ok(!dossier.includes('agent answer 1.'), 'a sealed read leaked');
  assert.ok(!dossier.includes('correction 1'), 'a sealed correction leaked');
});

test('across the whole journey the agent never moved the human', async () => {
  const { box, ctx, human } = table(createDoc(0, { mode: 'both' }));
  const agent = stubAgent(ctx);
  human({ type: 'open_sitting', deckId: 'voices' });
  const humanMovesBefore = box.doc.log.filter((e) => e.actor === 'human').length;
  await agent.playRound();
  const humanMoves = box.doc.log.filter((e) => e.actor === 'human');
  assert.equal(humanMoves.length, humanMovesBefore, 'nothing the agent did was recorded as a human move');
});

test('a quiz plays to a pass, with the agent waiting rather than being told', async () => {
  const { box, ctx, human } = table(createDoc(0, { mode: 'quiz' }));
  const agent = stubAgent(ctx);
  human({ type: 'open_sitting', deckId: 'daily' });

  let timeouts = 0;
  for (let i = 0; i < box.doc.rounds.length; i++) {
    await agent.playRound();
    const since = box.doc.version;
    const pending = agent.wait(since);
    human({ type: 'human_submit', text: `human answer ${i + 1}` });
    const woken = await pending;
    if (woken.timedOut) timeouts++;
    assert.ok(woken.version > since, 'the wait should have been woken by the human, not timed out');
    human({ type: 'reveal' });
    human({ type: 'judge', verdict: i < QUIZ_PASS ? 'match' : 'miss' });
    if (i + 1 < box.doc.rounds.length) human({ type: 'next' });
  }
  assert.equal(isComplete(box.doc), true);
  assert.equal(box.doc.rounds.filter((r) => r.verdict === 'match').length, QUIZ_PASS);
  assert.equal(timeouts, 0);
});

test('an agent waiting between sittings is woken by the open, and told where it is', async () => {
  const { box, ctx, human } = table(createDoc(0, { mode: 'both' }));
  const agent = stubAgent(ctx);
  const between = JSON.parse((await buildTools(ctx).find((t) => t.name === 'get_round').execute({})).content[0].text);
  assert.equal(between.state, 'between_sittings');
  const pending = agent.wait(box.doc.version);
  human({ type: 'open_sitting', deckId: 'voices' });
  const woken = await pending;
  assert.equal(woken.round, 1);
  assert.equal(woken.state, 'posed');
});

test('a restart while the agent is waiting tells it so', async () => {
  const { box, ctx, human } = table(createDoc(0, { mode: 'both' }));
  const agent = stubAgent(ctx);
  human({ type: 'open_sitting', deckId: 'voices' });
  await agent.playRound();
  const pending = agent.wait(box.doc.version);
  ctx.setDoc(createDoc(0, { mode: 'both' }));   // the human started over
  const out = await pending;
  assert.equal(out.reset, true, 'a restart must not leave the agent waiting for a version that will never come');
});
