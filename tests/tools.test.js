import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDoc, reduce } from '../src/games/mirror/game.js';
import { createWaitRegistry } from '../src/waiters.js';
import { buildTools, toolNamesFor } from '../src/games/mirror/tools.js';

function harness(doc = createDoc()) {
  const box = { doc };
  const waits = createWaitRegistry();
  const ctx = {
    getDoc: () => box.doc,
    setDoc: (d) => { box.doc = d; waits.notify(d.version); },
    now: () => 0,
    waits
  };
  return { box, ctx, waits, tools: () => buildTools(ctx) };
}

function byName(tools, name) {
  const tool = tools.find((t) => t.name === name);
  assert.ok(tool, `no tool named ${name}`);
  return tool;
}

function textOf(result) {
  return result.content[0].text;
}

test('tier 1 registers the tier-1 surface and the dossier is not among it', () => {
  const h = harness();
  const names = h.tools().map((t) => t.name);
  assert.deepEqual(names, toolNamesFor(h.box.doc.mode, 1));
  assert.ok(!names.includes('get_dossier'),
    'a locked verb is absent from the surface, not present and refusing');
});

/* The same rule, applied to mode rather than tier: illustrate_answer is a
   portrait verb, so a quiz game must not carry it refusing every call. */
test('the surface is gated by mode as well as by tier', () => {
  const portrait = harness(createDoc(0, { mode: 'portrait' })).tools().map((t) => t.name);
  const quiz = harness(createDoc(0, { mode: 'quiz' })).tools().map((t) => t.name);

  assert.ok(portrait.includes('illustrate_answer'));
  assert.ok(!quiz.includes('illustrate_answer'),
    'a quiz game must not register a verb whose every call it would refuse');
  assert.deepEqual(quiz, toolNamesFor('quiz', 1));
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
  assert.deepEqual(names, toolNamesFor(h.box.doc.mode, 2));
  assert.equal(names.length, toolNamesFor(h.box.doc.mode, 1).length + 1);
});

test('there is no tool that reveals, judges, advances, or grants', () => {
  const h = harness({ ...createDoc(), tier: 2 });
  const names = h.tools().map((t) => t.name);
  for (const forbidden of ['reveal', 'judge', 'next', 'next_round', 'grant_tier', 'unlock', 'answer_for_human']) {
    assert.ok(!names.includes(forbidden), `${forbidden} must never be a tool — it is the human's move`);
  }
});

const sig = () => ({ signal: new AbortController().signal });

test('the projection carries the version, so the agent knows what to wait on', async () => {
  const h = harness();
  const out = JSON.parse(textOf(await byName(h.tools(), 'get_round').execute({}, sig())));
  assert.equal(typeof out.version, 'number');
});

test('wait_for_game_update is declared read-only to the client', () => {
  const tool = byName(harness().tools(), 'wait_for_game_update');
  assert.equal(tool.annotations.readOnlyHint, true);
});

test('THE BUSY-LOOP TEST: waiting does not itself change the version', async () => {
  const h = harness();
  const before = h.box.doc.version;
  const logBefore = h.box.doc.log.length;
  const pending = byName(h.tools(), 'wait_for_game_update')
    .execute({ since: before, timeout_ms: 1000 }, sig());
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(h.box.doc.version, before, 'the wait bumped the version and would wake itself');
  assert.equal(h.box.doc.log.length, logBefore, 'the wait wrote to the log');
  const out = JSON.parse(textOf(await pending));
  assert.equal(out.timedOut, true);
});

test('wait_for_game_update returns the new round when the human moves', async () => {
  const h = harness();
  await byName(h.tools(), 'submit_answer').execute({ text: 'first' }, sig());
  const since = h.box.doc.version;
  const pending = byName(h.tools(), 'wait_for_game_update').execute({ since }, sig());
  h.ctx.setDoc(reduce(h.box.doc, { type: 'human_submit', text: 'mine' }).doc);
  const out = JSON.parse(textOf(await pending));
  assert.ok(out.version > since);
  assert.equal(out.state, 'both_committed');
});

test('wait_for_game_update reports a restart rather than hanging', async () => {
  const h = harness();
  const out = JSON.parse(textOf(await byName(h.tools(), 'wait_for_game_update')
    .execute({ since: 999 }, sig())));
  assert.equal(out.reset, true);
});

test('wait_for_game_update refuses a missing since, naming the cause', async () => {
  const h = harness();
  const out = textOf(await byName(h.tools(), 'wait_for_game_update').execute({}, sig()));
  assert.match(out, /^refused: /);
  assert.match(out, /version/i);
});

test('every tool accepts the spec signature and survives a missing options object', async () => {
  const h = harness();
  for (const tool of h.tools()) {
    assert.ok(tool.execute.length >= 1, `${tool.name} must accept the input object`);
  }
  const out = await byName(h.tools(), 'get_round').execute({});
  assert.ok(textOf(out).length > 0, 'a client that omits options must not crash the tool');
});
