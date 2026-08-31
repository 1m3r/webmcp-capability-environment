import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDoc } from '../src/games/mirror/game.js';
import { buildTools, TOOL_NAMES_BY_TIER } from '../src/games/mirror/tools.js';

function harness(doc = createDoc()) {
  const box = { doc };
  const ctx = {
    getDoc: () => box.doc,
    setDoc: (d) => { box.doc = d; },
    now: () => 0
  };
  return { box, ctx, tools: () => buildTools(ctx) };
}

function byName(tools, name) {
  const tool = tools.find((t) => t.name === name);
  assert.ok(tool, `no tool named ${name}`);
  return tool;
}

function textOf(result) {
  return result.content[0].text;
}

test('tier 1 registers four tools and the dossier is not among them', () => {
  const h = harness();
  const names = h.tools().map((t) => t.name);
  assert.deepEqual(names, TOOL_NAMES_BY_TIER[1]);
  assert.ok(!names.includes('get_dossier'),
    'a locked verb is absent from the surface, not present and refusing');
});

test('every tool carries the shape a WebMCP client expects', () => {
  for (const tool of harness().tools()) {
    assert.equal(typeof tool.name, 'string');
    assert.ok(tool.description.length > 20, `${tool.name} needs a description an agent can act on`);
    assert.equal(tool.inputSchema.type, 'object');
    assert.equal(typeof tool.execute, 'function');
  }
});

test('submit_answer commits and the store is updated', async () => {
  const h = harness();
  const out = await byName(h.tools(), 'submit_answer').execute({ text: 'a lighthouse' });
  assert.match(textOf(out), /committed/i);
  assert.equal(h.box.doc.rounds[0].agentAnswer, 'a lighthouse');
  assert.equal(h.box.doc.rounds[0].state, 'agent_committed');
});

test('execute unwraps a client that nests arguments', async () => {
  const h = harness();
  await byName(h.tools(), 'submit_answer').execute({ arguments: { text: 'nested' } });
  assert.equal(h.box.doc.rounds[0].agentAnswer, 'nested');
});

test('a refused call returns the cause AND is persisted to the log', async () => {
  const h = harness();
  await byName(h.tools(), 'submit_answer').execute({ text: 'first' });
  const out = await byName(h.tools(), 'submit_answer').execute({ text: 'second' });
  assert.match(textOf(out), /^refused: /);
  assert.match(textOf(out), /already committed/i);
  assert.equal(h.box.doc.rounds[0].agentAnswer, 'first');
  const last = h.box.doc.log.at(-1);
  assert.equal(last.outcome, 'refused');
  assert.equal(last.actor, 'agent');
});

test('get_round returns the projection and hides the answers', async () => {
  const h = harness();
  await byName(h.tools(), 'submit_answer').execute({ text: 'zzsecretzz' });
  const out = textOf(await byName(h.tools(), 'get_round').execute({}));
  assert.ok(!out.includes('zzsecretzz'));
  const parsed = JSON.parse(out);
  assert.equal(parsed.youHaveAnswered, true);
  assert.equal(parsed.of, 8);
  assert.equal(h.box.doc.log.at(-1).action, 'read');
  assert.equal(h.box.doc.log.at(-1).detail, 'get_round');
});

test('say reaches the log with the agent as actor', async () => {
  const h = harness();
  const out = await byName(h.tools(), 'say').execute({ text: 'this one is hard' });
  assert.match(textOf(out), /this one is hard/);
  assert.equal(h.box.doc.log.at(-1).action, 'say');
  assert.equal(h.box.doc.log.at(-1).actor, 'agent');
});

test('get_field_manual returns the tier the document is on', async () => {
  const h = harness();
  const one = textOf(await byName(h.tools(), 'get_field_manual').execute({}));
  assert.doesNotMatch(one, /get_dossier/);

  h.box.doc = { ...h.box.doc, tier: 2 };
  const two = textOf(await byName(h.tools(), 'get_field_manual').execute({}));
  assert.match(two, /get_dossier/);
});

test('tier 2 adds get_dossier and nothing else', () => {
  const h = harness({ ...createDoc(), tier: 2 });
  const names = h.tools().map((t) => t.name);
  assert.deepEqual(names, TOOL_NAMES_BY_TIER[2]);
  assert.equal(names.length, TOOL_NAMES_BY_TIER[1].length + 1);
});

test('there is no tool that reveals, judges, advances, or grants', () => {
  const h = harness({ ...createDoc(), tier: 2 });
  const names = h.tools().map((t) => t.name);
  for (const forbidden of ['reveal', 'judge', 'next', 'next_round', 'grant_tier', 'unlock', 'answer_for_human']) {
    assert.ok(!names.includes(forbidden), `${forbidden} must never be a tool — it is the human's move`);
  }
});
