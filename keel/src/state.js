/* The document, and the only module that writes to it.

   Optimistic concurrency is ENFORCED here, not merely reported. The human
   answers questions in the UI while the agent works, so a stale write is a
   certainty rather than a hazard: an agent that read version 12, thought for
   forty seconds and then wrote, must be told what moved underneath it. */

export const EMPTY_DOC = {
  version: 0,
  phase: 'intake',
  concept: null,
  intake: null,
  questions: [],
  claims: [],
  decisions: [],
  tasks: [],
  findings: [],
  narrative: {},
  events: [],
  pendingAdvance: null,
  confirmedPhases: [],
};

const KEY = 'keel.doc.v1';

function clone(value) {
  return structuredClone(value);
}

export function createStore({ initial = EMPTY_DOC, storage = null } = {}) {
  let doc = clone(initial);
  /* touched paths per version, so a stale writer learns what moved rather than
     only that something did */
  let history = [];
  const listeners = new Set();

  if (storage) {
    const raw = storage.getItem(KEY);
    if (raw) {
      try {
        const saved = JSON.parse(raw);
        doc = { ...clone(EMPTY_DOC), ...saved };
        history = Array.isArray(saved.__history) ? saved.__history : [];
        delete doc.__history;
      } catch {
        /* a corrupt save must not brick the app; start clean */
        doc = clone(EMPTY_DOC);
      }
    }
  }

  function persist() {
    if (!storage) return;
    storage.setItem(KEY, JSON.stringify({ ...doc, __history: history }));
  }

  function notify() {
    for (const fn of listeners) fn(doc.version);
  }

  return {
    get version() { return doc.version; },

    get() { return clone(doc); },

    mutate(meta, fn) {
      const { expectedVersion, actor, kind, detail = '', touched = [] } = meta;

      if (expectedVersion !== undefined && expectedVersion !== doc.version) {
        const changed = [];
        for (const h of history) {
          if (h.version > expectedVersion) {
            for (const p of h.touched) if (!changed.includes(p)) changed.push(p);
          }
        }
        return {
          ok: false,
          error: 'STALE_STATE',
          currentVersion: doc.version,
          changed,
          message:
            'The workspace changed since you last read it. Call get_state and ' +
            'redo this write against version ' + doc.version + '. Changed: ' +
            (changed.join(', ') || 'unknown') + '.',
        };
      }

      /* Apply to a draft. Only a clean run is committed, so a handler that
         throws halfway cannot leave a half-written document behind. */
      const draft = clone(doc);
      fn(draft);

      draft.version = doc.version + 1;
      draft.events = draft.events.concat([{
        version: draft.version,
        at: new Date().toISOString(),
        actor,
        kind,
        detail,
      }]);

      doc = draft;
      history = history.concat([{ version: doc.version, touched }]).slice(-200);
      persist();
      notify();
      return { ok: true, version: doc.version };
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
