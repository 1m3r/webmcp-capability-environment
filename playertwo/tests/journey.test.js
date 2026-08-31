import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDoc, reduce, isComplete, DOSSIER_ROUND } from '../src/games/mirror/game.js';
import { buildTools } from '../src/games/mirror/tools.js';
import { createWaitRegistry } from '../src/waiters.js';

/* A stub agent. It knows only what the tools tell it: it reads the manual once,
   reads the round, answers, and reads the dossier when the dossier appears.
   It never touches the document directly — every agent move goes through a
   tool, exactly as a live agent's would. */
function stubAgent(ctx) {
  const seen = { manual: 0, dossier: 0, rounds: [] };

  const call = async (name, args = {}) => {
    const tool = buildTools(ctx).find((t) => t.name === name);
    if (!tool) throw new Error(`the agent reached for ${name}, which is not registered`);
    return (await tool.execute(args)).content[0].text;
  };

  return {
    seen,
    hasTool: (name) => buildTools(ctx).some((t) => t.name === name),
    async playRound() {
      if (seen.manual === 0) { await call('get_field_manual'); seen.manual++; }
      if (this.hasTool('get_dossier')) { await call('get_dossier'); seen.dossier++; }
      const round = JSON.parse(await call('get_round'));
      seen.rounds.push(round.round);
      assert.ok(!('teammateAnswer' in round), 'the agent could see its teammate before answering');
      await call('say', { text: `thinking about round ${round.round}` });
      return call('submit_answer', { text: `agent answer ${round.round}` });
    }
  };
}

test('the stub agent plays all eight rounds and the game closes', async () => {
  const box = { doc: createDoc() };
  const waits = createWaitRegistry();
  const ctx = {
    getDoc: () => box.doc,
    setDoc: (d) => { box.doc = d; waits.notify(d.version); },
    now: () => 0,
    waits
  };
  const agent = stubAgent(ctx);

  const human = (action) => {
    const result = reduce(box.doc, action);
    assert.ok(result.ok, `the human move ${action.type} was refused: ${result.message}`);
    box.doc = result.doc;
  };

  assert.equal(agent.hasTool('get_dossier'), false, 'the dossier must be closed at the start');

  for (let i = 0; i < 8; i++) {
    await agent.playRound();
    human({ type: 'human_submit', text: `human answer ${i + 1}` });
    human({ type: 'reveal' });
    human({ type: 'judge', verdict: i % 3 === 0 ? 'landed' : 'missed' });

    if (i + 1 === DOSSIER_ROUND) {
      assert.equal(agent.hasTool('get_dossier'), false, 'the tier must not open by itself');
      human({ type: 'grant_tier' });
      assert.equal(agent.hasTool('get_dossier'), true, 'the human click must open it');
    }

    if (i < 7) human({ type: 'next' });
  }

  assert.equal(isComplete(box.doc), true);
  assert.equal(box.doc.tier, 2);
  assert.deepEqual(agent.seen.rounds, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(agent.seen.manual, 1);
  assert.equal(agent.seen.dossier, 4, 'the dossier should have been read on each of the last four rounds');
  assert.ok(box.doc.rounds.every((r) => r.agentAnswer && r.humanAnswer && r.verdict));
});

test('across the whole journey the agent never moved the human', async () => {
  const box = { doc: createDoc() };
  const waits = createWaitRegistry();
  const ctx = {
    getDoc: () => box.doc,
    setDoc: (d) => { box.doc = d; waits.notify(d.version); },
    now: () => 0,
    waits
  };
  const agent = stubAgent(ctx);

  await agent.playRound();
  const humanMoves = box.doc.log.filter((e) => e.actor === 'human');
  assert.equal(humanMoves.length, 0, 'nothing the agent did was recorded as a human move');
});

import { QUIZ_PASS } from '../src/games/mirror/questions.js';

/* An agent that drives itself: it commits, then waits for its teammate rather
   than being told to continue. */
function selfDrivingAgent(ctx) {
  const seen = { waits: 0, timeouts: 0, resets: 0 };

  const call = async (name, args = {}) => {
    const tool = buildTools(ctx).find((t) => t.name === name);
    if (!tool) throw new Error(`the agent reached for ${name}, which is not registered`);
    return (await tool.execute(args, { signal: new AbortController().signal })).content[0].text;
  };

  return {
    seen,
    async answerCurrentRound() {
      const round = JSON.parse(await call('get_round'));
      assert.ok(!('teammateAnswer' in round), 'the agent saw its teammate before answering');
      await call('submit_answer', { text: `agent answer ${round.round}` });
      return round.version;
    },
    async waitForTeammate(since) {
      seen.waits++;
      const out = JSON.parse(await call('wait_for_game_update', { since, timeout_ms: 1000 }));
      if (out.timedOut) seen.timeouts++;
      if (out.reset) seen.resets++;
      return out;
    }
  };
}

test('a quiz plays to a pass, with the agent waiting rather than being told', async () => {
  const box = { doc: createDoc(0, { mode: 'quiz' }) };
  const waits = createWaitRegistry();
  const ctx = {
    getDoc: () => box.doc,
    setDoc: (d) => { box.doc = d; waits.notify(d.version); },
    now: () => 0,
    waits
  };
  const agent = selfDrivingAgent(ctx);

  const human = (action) => {
    const result = reduce(box.doc, action);
    assert.ok(result.ok, `the human move ${action.type} was refused: ${result.message}`);
    ctx.setDoc(result.doc);
  };

  for (let i = 0; i < 8; i++) {
    await agent.answerCurrentRound();
    const since = box.doc.version;

    /* The agent is waiting while the human moves — exactly the live shape. */
    const pending = agent.waitForTeammate(since);
    human({ type: 'human_submit', text: `human answer ${i + 1}` });
    const woken = await pending;
    assert.ok(woken.version > since, 'the wait should have been woken by the human, not timed out');

    human({ type: 'reveal' });
    human({ type: 'judge', verdict: i < QUIZ_PASS ? 'match' : 'miss' });
    if (i + 1 === DOSSIER_ROUND) human({ type: 'grant_tier' });
    if (i < 7) human({ type: 'next' });
  }

  assert.equal(isComplete(box.doc), true);
  assert.equal(box.doc.mode, 'quiz');
  const matched = box.doc.rounds.filter((r) => r.verdict === 'match').length;
  assert.equal(matched, QUIZ_PASS);
  assert.equal(agent.seen.timeouts, 0, 'every wait should have been woken by a real move');
});

test('quiz rounds alternate who knows the answer', () => {
  const doc = createDoc(0, { mode: 'quiz' });
  assert.equal(doc.rounds[0].agentTarget, 'human', 'round 1 asks about the human, so the agent guesses');
  assert.equal(doc.rounds[1].agentTarget, 'agent', 'round 2 asks about the agent, so the agent knows');
  assert.equal(doc.rounds.filter((r) => r.agentTarget === 'human').length, 4);
  assert.equal(doc.rounds.filter((r) => r.agentTarget === 'agent').length, 4);
  assert.ok(doc.rounds.every((r) => r.agentTarget === r.humanTarget),
    'in quiz both answer about the same person');
});

test('a restart while the agent is waiting tells it so', async () => {
  const box = { doc: createDoc() };
  const waits = createWaitRegistry();
  const ctx = {
    getDoc: () => box.doc,
    setDoc: (d) => { box.doc = d; waits.notify(d.version); },
    now: () => 0,
    waits
  };
  const agent = selfDrivingAgent(ctx);
  await agent.answerCurrentRound();
  const since = box.doc.version;

  const pending = agent.waitForTeammate(since);
  ctx.setDoc(createDoc(0));            // the human pressed Restart
  const out = await pending;
  assert.equal(out.reset, true, 'a restart must not leave the agent waiting for a version that will never come');
});
