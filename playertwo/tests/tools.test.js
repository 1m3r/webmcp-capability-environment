import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDoc, reduce, MODES } from '../src/games/mirror/game.js';
import { createWaitRegistry } from '../src/waiters.js';
import { buildTools, toolNamesFor } from '../src/games/mirror/tools.js';
import { open, afterOne } from './helpers.js';

function harness(doc = open(createDoc(0, { mode: 'both' }))) {
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

test('tier 1 registers five verbs in every game, and the dossier is not among them', () => {
  for (const mode of MODES) {
    const names = harness(createDoc(0, { mode })).tools().map((t) => t.name);
    assert.deepEqual(names, toolNamesFor(mode, 1));
    assert.equal(names.length, 5, `${mode}: the status bar reads 5 tools on arrival`);
    assert.ok(!names.includes('get_dossier'), 'a locked verb is absent from the surface, not present and refusing');
    assert.ok(!names.includes('illustrate_answer'), 'the gallery verb is gone — images travel with the answer');
  }
});

test('tier 2 adds get_dossier and nothing else, in every game', () => {
  for (const mode of MODES) {
    const names = harness(afterOne(mode)).tools().map((t) => t.name);
    assert.deepEqual(names, toolNamesFor(mode, 2));
    assert.equal(names.length, 6);
  }
});

test('the body has at most eight verbs, and the ladder is one verb per tier', () => {
  for (const mode of MODES) {
    assert.deepEqual(toolNamesFor(mode, 1).length, 5);
    assert.deepEqual(toolNamesFor(mode, 3).slice(5), ['get_dossier', 'propose_question']);
    assert.deepEqual(toolNamesFor(mode, 4).slice(5), ['get_dossier', 'propose_question', 'get_portrait_history']);
    assert.deepEqual(toolNamesFor(mode, 9), toolNamesFor(mode, 4));
  }
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
  assert.equal(parsed.of, 5);
  assert.equal(h.box.doc.log.at(-1).action, 'read');
  assert.equal(h.box.doc.log.at(-1).detail, 'get_round');
});

test('between sittings, get_round says so and names the wait', async () => {
  const h = harness(createDoc(0, { mode: 'both' }));
  const parsed = JSON.parse(textOf(await byName(h.tools(), 'get_round').execute({})));
  assert.equal(parsed.state, 'between_sittings');
  assert.match(parsed.yourMove, /wait_for_game_update/);
});

test('say reaches the log with the agent as actor', async () => {
  const h = harness();
  const out = await byName(h.tools(), 'say').execute({ text: 'this one is hard' });
  assert.match(textOf(out), /this one is hard/);
  assert.equal(h.box.doc.log.at(-1).action, 'say');
  assert.equal(h.box.doc.log.at(-1).actor, 'agent');
});

test('get_field_manual returns the tier the portrait is on', async () => {
  const one = textOf(await byName(harness().tools(), 'get_field_manual').execute({}));
  assert.doesNotMatch(one, /get_dossier/);
  const two = textOf(await byName(harness(afterOne('both')).tools(), 'get_field_manual').execute({}));
  assert.match(two, /get_dossier/);
});

test('get_dossier reads granted history', async () => {
  const h = harness(afterOne('both', 'open'));
  const out = textOf(await byName(h.tools(), 'get_dossier').execute({}));
  assert.match(out, /agent 0/);
  assert.equal(h.box.doc.log.at(-1).detail, 'get_dossier');
});

test('there is no tool that reveals, judges, advances, opens, closes or grants', () => {
  const names = harness(afterOne('both')).tools().map((t) => t.name);
  for (const forbidden of [
    'reveal', 'judge', 'next', 'next_round', 'grant_tier', 'unlock', 'answer_for_human',
    'open_sitting', 'close_sitting', 'abandon_sitting', 'restart'
  ]) {
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

/* ---- what the page CLAIMS each verb does --------------------------------

   The second thing the first live run found. MCP takes destructiveHint as TRUE
   by default for any tool not marked read-only, so a page that declares nothing
   is telling the client that committing an answer might destroy something. A
   careful client then asks its human to confirm, every round — and the run
   stalled with the agent holding a finished read, four licensed images, and a
   question nobody needed to answer.

   Every test in this file asserted the SHAPE of the surface. None asserted what
   the surface says about itself. These do. */

const READS = ['get_round', 'wait_for_game_update', 'get_field_manual', 'get_dossier', 'get_portrait_history'];
const WRITES = ['submit_answer', 'say', 'propose_question'];

/* Every verb the game can ever register, in every game. */
function wholeSurface(mode) {
  return harness({ ...createDoc(0, { mode }), level: 4 }).tools();
}

test('every verb declares what it does — none is left to the client default', () => {
  for (const mode of MODES) {
    for (const tool of wholeSurface(mode)) {
      assert.ok(tool.annotations, `${mode}/${tool.name} declares no annotations at all`);
      assert.equal(typeof tool.annotations.readOnlyHint, 'boolean',
        `${mode}/${tool.name} does not say whether it writes`);
    }
  }
});

test('a read is marked read-only, and a write is marked NOT destructive', () => {
  for (const mode of MODES) {
    for (const tool of wholeSurface(mode)) {
      if (READS.includes(tool.name)) {
        assert.equal(tool.annotations.readOnlyHint, true, `${mode}/${tool.name} reads and should say so`);
        continue;
      }
      assert.ok(WRITES.includes(tool.name), `${mode}/${tool.name} is neither a known read nor a known write`);
      assert.equal(tool.annotations.readOnlyHint, false);
      assert.equal(tool.annotations.destructiveHint, false,
        `${mode}/${tool.name} is not destructive, and leaving this unsaid makes a client ask ` +
        'its human for permission on every call');
      assert.equal(tool.annotations.idempotentHint, false,
        `${mode}/${tool.name}: a second identical call is refused, not repeated`);
    }
  }
});

test('committing is described as the expected move rather than a hazard', () => {
  const submit = byName(harness(open(createDoc(0, { mode: 'perspective' }))).tools(), 'submit_answer');
  assert.match(submit.description, /expected move/);
  assert.match(submit.description, /destroys nothing/);
  assert.match(submit.description, /without asking/i,
    'the agent stopped to ask permission it did not need, so the surface says not to');
  assert.equal(submit.annotations.title, 'Commit your read');
});

test('only the perspective commit reaches the open web, because only it loads images', () => {
  assert.equal(byName(harness(open(createDoc(0, { mode: 'perspective' }))).tools(), 'submit_answer')
    .annotations.openWorldHint, true);
  for (const mode of ['both', 'quiz']) {
    assert.equal(byName(harness(open(createDoc(0, { mode }))).tools(), 'submit_answer')
      .annotations.openWorldHint, false, `${mode} commits touch nothing outside the page`);
  }
});
