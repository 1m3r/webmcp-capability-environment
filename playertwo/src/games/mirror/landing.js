/* What a visitor sees when the page has no second player.

   The hackathon requires a working live app, and this one is static files that
   deploy in minutes — but a judge opening the deployed URL in ordinary Chrome
   sees `no model context` and a game that cannot move, because every round
   begins with a tool call they cannot make. There is no solo mode and there
   should not be one: needing a second player IS the claim, and staging it with
   a scripted opponent would refute it.

   So this screen does the one honest thing available. It explains what the page
   is, says plainly why it will not start, and shows the tool surface the page
   would hand an agent that arrived — which is the whole architecture, legible
   without playing.

   It drives no second visual system: same ground, same faces, same tokens as
   the game, and nothing here animates that the game does not already animate. */

import { escapeHtml } from './render.js';
import { CORE_TOOLS } from './game.js';

const HUMAN_ONLY = ['reveal a round', 'judge a match', 'move to the next round', 'open the dossier'];

export function renderLanding({ repoUrl = '', videoUrl = '' } = {}) {
  const tools = CORE_TOOLS
    .map((name) => `<li><code>${escapeHtml(name)}</code></li>`)
    .join('\n        ');

  const humanOnly = HUMAN_ONLY
    .map((what) => `<li>${escapeHtml(what)}</li>`)
    .join('\n        ');

  const links = [
    repoUrl ? `<a class="landing__link" href="${escapeHtml(repoUrl)}">the code</a>` : '',
    videoUrl ? `<a class="landing__link" href="${escapeHtml(videoUrl)}">the demo</a>` : ''
  ].filter(Boolean).join('\n      ');

  return `<section class="landing">
    <p class="landing__eyebrow">this page is waiting for a second player</p>

    <h2 class="landing__title">Mirror is a game you cannot play alone.</h2>

    <p class="landing__lede">Two players answer the same question about each
      other, in the dark, and then find out. One of them is you. The other is
      your agent, and it moves by calling tools this page registers in your
      browser.</p>

    <div class="landing__cols">
      <div class="landing__col">
        <h3 class="landing__h">What your agent gets</h3>
        <ul class="landing__tools">
        ${tools}
        </ul>
        <p class="landing__note">Five verbs in every game. Portrait adds a sixth
          for the gallery, and a seventh arrives mid-game when you decide to add
          it.</p>
      </div>

      <div class="landing__col">
        <h3 class="landing__h">What it never gets</h3>
        <ul class="landing__denied">
        ${humanOnly}
        </ul>
        <p class="landing__note">Not locked behind a permission. There is simply
          no tool for any of them, so authority is the shape of the surface
          rather than a rule anyone has to keep.</p>
      </div>
    </div>

    <div class="landing__gate">
      <h3 class="landing__h">Why nothing is happening</h3>
      <p>Your browser exposes no model context, so the page has nobody to
        register its tools with. The agent answers first every round — that
        ordering is the only reason the secret is real rather than decorative —
        so with no agent there is no first move and the game will not start.</p>
      <p class="landing__how">To play, open this page in a browser an agent can
        reach: Chrome with <code>chrome://flags/#enable-webmcp-testing</code>,
        or a desktop assistant with a built-in WebMCP browser. Then say
        <em>let's play this</em> and do nothing else.</p>
    </div>

    <p class="landing__links">
      ${links}
      <a class="landing__link" href="?play=1">look around without an agent</a>
    </p>
    <p class="landing__caveat">That last one is a walkthrough of the furniture.
      The game still will not move, because it still has nobody to move it.</p>
  </section>`;
}
