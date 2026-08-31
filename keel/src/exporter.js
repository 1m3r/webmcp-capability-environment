/* What leaves the machine, and only when a human presses a button. */

import { renderNarrative, renderGraph } from './views.js';

export function buildExport(doc) {
  return {
    md: renderNarrative(doc),
    json: renderGraph(doc),
    journey: {
      exportedAt: new Date().toISOString(),
      version: (doc && doc.version) || 0,
      phase: (doc && doc.phase) || null,
      events: (doc && doc.events) || [],
    },
  };
}
