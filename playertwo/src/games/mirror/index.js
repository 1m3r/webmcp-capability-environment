import {
  createDoc, reduce, isComplete, inSitting, isPerspective, justGranted, tierFor, MODES
} from './game.js';
import { renderGame, renderPortrait, renderStart } from './render.js';
import { buildTools } from './tools.js';
import { renderLanding } from './landing.js';

/* One portrait per game, so switching games never overwrites one. The active
   key names the game last played, which is what a reload resumes. */
const STORAGE_PREFIX = 'p2.mirror.v2.';

export const mirror = {
  id: 'mirror',
  title: 'Mirror',
  modes: MODES,
  storageKey: STORAGE_PREFIX + 'active',
  storageKeyFor: (mode) => STORAGE_PREFIX + mode,
  createDoc,
  reduce,
  isComplete,
  inSitting,
  isPerspective,
  justGranted,
  tierFor,
  buildTools,
  render: renderGame,
  renderStart,
  renderLanding,
  renderPortrait,
  exportBase: 'mirror'
};
