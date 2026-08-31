import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDoc, reduce, isComplete, DOSSIER_ROUND } from '../src/games/mirror/game.js';
import { buildTools } from '../src/games/mirror/tools.js';

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
  const ctx = { getDoc: () => box.doc, setDoc: (d) => { box.doc = d; }, now: () => 0 };
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
    human({ type: 'judge', verdict: i % 3 === 0 ? 'match' : 'miss' });

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
  const ctx = { getDoc: () => box.doc, setDoc: (d) => { box.doc = d; }, now: () => 0 };
  const agent = stubAgent(ctx);

  await agent.playRound();
  const humanMoves = box.doc.log.filter((e) => e.actor === 'human');
  assert.equal(humanMoves.length, 0, 'nothing the agent did was recorded as a human move');
});
