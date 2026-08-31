import { createDoc, reduce, isComplete, DOSSIER_ROUND } from './game.js';
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
  /* The only thing the shell needs to know about this game's unlock. */
  canGrant: (doc) =>
    doc.tier === 1 && doc.rounds.filter((r) => r.state === 'judged').length >= DOSSIER_ROUND,
  grantLabel: 'Open the dossier'
};
