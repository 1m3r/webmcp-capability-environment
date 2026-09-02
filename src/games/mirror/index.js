import { createDoc, reduce, isComplete, canGrant, atGrantMoment } from './game.js';
import { renderGame, renderPortrait, renderStart } from './render.js';
import { buildTools } from './tools.js';

export const mirror = {
  id: 'mirror',
  title: 'Mirror',
  storageKey: 'p2.mirror.v1',
  createDoc,
  reduce,
  isComplete,
  buildTools,
  render: renderGame,
  renderStart,
  renderPortrait,
  exportBase: 'mirror',
  /* The only thing the shell needs to know about this game's unlock. Shared
     with the renderer so the sidebar button and the stage offer can never
     disagree about whether the dossier is available. */
  canGrant,
  atGrantMoment,
  grantLabel: 'Open the dossier'
};
