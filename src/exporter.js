/* The export. Three files, matching the runs/ convention the probe set:
   the state, something a human wants to read, and the event journey.

   The journey is separate from the state on purpose — it is what lets a run be
   reconstructed without the recording, and it is the file that answers "who
   actually did that". The portrait renderer is passed in rather than imported,
   so this module knows nothing about any particular game. */

export function buildExport(doc, renderPortrait, exportedAt = new Date().toISOString()) {
  return [
    {
      name: 'mirror.json',
      type: 'application/json',
      body: JSON.stringify({ exportedAt, ...doc }, null, 2)
    },
    {
      name: 'portrait.md',
      type: 'text/markdown',
      body: renderPortrait(doc)
    },
    {
      name: 'journey.json',
      type: 'application/json',
      body: JSON.stringify({ exportedAt, gameId: doc.gameId, log: doc.log }, null, 2)
    }
  ];
}
