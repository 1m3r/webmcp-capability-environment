/* Finding the model context, and registering into it.

   Two entry points are in the wild — document.modelContext and
   navigator.modelContext — and registration can appear after page load, so a
   single check at startup misses it. The probe learned both of these the
   expensive way; this is the same logic, generalised. */

export function detect(scope) {
  try { if (scope && scope.document && scope.document.modelContext) return { mc: scope.document.modelContext, entry: 'document.modelContext' }; } catch {}
  try { if (scope && scope.navigator && scope.navigator.modelContext) return { mc: scope.navigator.modelContext, entry: 'navigator.modelContext' }; } catch {}
  return null;
}

export async function registerTools(mc, tools) {
  const result = { method: 'none', registered: 0, errors: [] };
  try {
    if (mc && typeof mc.provideContext === 'function') {
      /* preferred: it REPLACES the set, which is what a phase swap needs */
      result.method = 'provideContext';
      await mc.provideContext({ tools });
      result.registered = tools.length;
    } else if (mc && typeof mc.registerTool === 'function') {
      result.method = 'registerTool';
      for (const tool of tools) {
        try { await mc.registerTool(tool); result.registered++; }
        catch (e) { result.errors.push(tool.name + ': ' + (e && e.message ? e.message : String(e))); }
      }
    } else {
      result.errors.push('the model context exposes neither registerTool nor provideContext');
    }
  } catch (e) {
    result.errors.push('registration failed: ' + (e && e.message ? e.message : String(e)));
  }
  return result;
}

export function watchForContext(scope, onFound, { tries = 30, interval = 200 } = {}) {
  const found = detect(scope);
  if (found) { onFound(found); return () => {}; }
  let n = 0;
  const id = setInterval(() => {
    n++;
    const f = detect(scope);
    if (f) { clearInterval(id); onFound(f); }
    else if (n >= tries) clearInterval(id);
  }, interval);
  return () => clearInterval(id);
}
