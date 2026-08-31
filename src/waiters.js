/* The wait registry behind wait_for_game_update.

   Pure and DOM-free, so all four endings — moved, timed out, reset, disposed —
   are tested in Node rather than discovered during a live run.

   Nothing in here touches the game document. That is deliberate and it is the
   whole reason this module exists separately: every other read in this codebase
   logs through the reducer, and every reduce bumps the version. A wait that
   logged would change the version it is waiting on and wake itself instantly,
   forever. */

const DEFAULT_TIMEOUT = 25000;
const MIN_TIMEOUT = 1000;
const MAX_TIMEOUT = 60000;

function clampTimeout(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n)) return DEFAULT_TIMEOUT;
  return Math.min(Math.max(n, MIN_TIMEOUT), MAX_TIMEOUT);
}

export function createWaitRegistry() {
  const waiters = new Set();
  let disposed = false;

  function notify(version) {
    for (const waiter of [...waiters]) {
      if (version > waiter.since) waiter.settle({ moved: true, version });
      else if (version < waiter.since) waiter.settle({ reset: true, version });
      /* An equal version means nothing moved. Leave the waiter alone. */
    }
  }

  function dispose() {
    disposed = true;
    for (const waiter of [...waiters]) waiter.settle({ disposed: true });
  }

  function wait({ since, currentVersion, timeoutMs, signal }) {
    if (disposed) return Promise.resolve({ disposed: true });
    if (signal && signal.aborted) {
      return Promise.reject(signal.reason ?? new Error('the wait was cancelled'));
    }
    if (currentVersion > since) return Promise.resolve({ moved: true, version: currentVersion });
    if (currentVersion < since) return Promise.resolve({ reset: true, version: currentVersion });

    return new Promise((resolve, reject) => {
      const waiter = { since, settle: null };
      let timer = null;

      const cleanup = () => {
        waiters.delete(waiter);
        if (timer !== null) clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', onAbort);
      };

      function onAbort() {
        cleanup();
        reject(signal.reason ?? new Error('the wait was cancelled'));
      }

      waiter.settle = (outcome) => { cleanup(); resolve(outcome); };

      /* Nothing changed while we waited, so the version is still the one we
         came in with. */
      timer = setTimeout(
        () => waiter.settle({ timedOut: true, version: currentVersion }),
        clampTimeout(timeoutMs)
      );

      if (signal) signal.addEventListener('abort', onAbort);
      waiters.add(waiter);
    });
  }

  return { wait, notify, dispose, size: () => waiters.size };
}
