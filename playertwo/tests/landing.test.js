/* The landing screen.

   The hackathon requires a working live app. This one is static files, so
   deploying it is minutes — but a judge opening the deployed URL in ordinary
   Chrome has no model context, and every round begins with a tool call they
   cannot make. Without this screen their first impression is a start screen
   leading to a game that will not take its first turn.

   A solo mode was offered and refused, correctly: needing a second player IS
   the claim, and staging it would refute it. So the screen explains instead. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderLanding } from '../src/games/mirror/landing.js';
import { CORE_TOOLS } from '../src/games/mirror/game.js';
import { createDoc, reduce } from '../src/games/mirror/game.js';

test('it names every tier-1 tool the page would actually register', () => {
  const html = renderLanding();
  for (const name of CORE_TOOLS) {
    assert.ok(html.includes(name), `the landing screen should name ${name}`);
  }
  assert.ok(!html.includes('get_dossier'),
    'the sixth verb is granted mid-game and must not be listed as given');
});

test('it says plainly why the game will not start', () => {
  const html = renderLanding();
  assert.match(html, /no model context/i);
  assert.match(html, /enable-webmcp-testing/);
});

test('it offers no way to play alone', () => {
  const html = renderLanding().toLowerCase();
  for (const tempting of ['solo', 'practice mode', 'play by yourself', 'demo mode']) {
    assert.ok(!html.includes(tempting),
      `the landing screen must not offer ${tempting} — needing a second player is the claim`);
  }
  assert.match(renderLanding(), /\?play=1/, 'but looking around must stay possible');
});

test('links are dropped rather than rendered empty', () => {
  const bare = renderLanding();
  assert.ok(!bare.includes('href=""'), 'an unset link must not render as an empty href');

  const linked = renderLanding({ repoUrl: 'https://example.test/repo', videoUrl: 'https://example.test/v' });
  assert.match(linked, /https:\/\/example\.test\/repo/);
  assert.match(linked, /https:\/\/example\.test\/v/);
});

test('a supplied link cannot inject markup', () => {
  const html = renderLanding({ repoUrl: '" onmouseover="alert(1)' });
  assert.ok(!html.includes('onmouseover="alert(1)"'));
  assert.match(html, /&quot;/);
});

test('it spends neither load-bearing colour', () => {
  assert.doesNotMatch(renderLanding(), /--signal|--reveal/,
    'nothing on this screen is committed or revealed');
});

/* The screen describes a boundary. If the boundary ever moved, the description
   would quietly become a lie, so it is checked against the reducer. */
test('every verb it calls impossible really has no tool', () => {
  const ctx = { getDoc: () => createDoc(), setDoc: () => {}, now: () => 0 };
  return import('../src/games/mirror/tools.js').then(({ buildTools }) => {
    const names = buildTools(ctx).map((t) => t.name).join(' ');
    for (const forbidden of ['reveal', 'judge', 'next', 'grant']) {
      assert.ok(!names.includes(forbidden),
        `the landing screen claims the agent cannot ${forbidden}, but a tool mentions it`);
    }
  });
});

test('the human-only actions it lists are all real page actions', () => {
  /* Each is refused for the agent only because no tool reaches it — but the
     reducer must still know them, or the list is describing nothing. */
  let doc = createDoc();
  doc = reduce(doc, { type: 'agent_submit', text: 'a' }).doc;
  doc = reduce(doc, { type: 'human_submit', text: 'h' }).doc;
  for (const type of ['reveal', 'judge', 'next', 'grant_tier']) {
    const result = reduce(doc, { type, verdict: 'landed' });
    assert.notEqual(result.code, 'UNKNOWN_ACTION',
      `${type} is listed on the landing screen but the reducer does not know it`);
  }
});
