/* WebMCP entry-point detection and registration.

   Order is deliberate and is copied from the frozen probe, which is the version
   verified against live clients: registerTool/unregisterTool is the current
   surface, and provideContext was removed from the spec in March 2026 but older
   clients may still ship it.

   The difference matters at tier unlock: registerTool is ADDITIVE, so only the
   new tool is registered, while provideContext REPLACES the set and must be
   handed everything. reregister() is the only place that distinction lives. */

export function detect(scope = globalThis) {
  try {
    if (scope.document && scope.document.modelContext) {
      return { mc: scope.document.modelContext, entry: 'document.modelContext' };
    }
  } catch { /* a scope that throws on property access is a scope with no context */ }
  try {
    if (scope.navigator && scope.navigator.modelContext) {
      return { mc: scope.navigator.modelContext, entry: 'navigator.modelContext' };
    }
  } catch { /* as above */ }
  return null;
}

export async function registerTools(mc, tools) {
  const result = { method: 'none', registered: 0, errors: [] };
  try {
    if (typeof mc.registerTool === 'function') {
      result.method = 'registerTool';
      for (const tool of tools) {
        try {
          await mc.registerTool(tool);
          result.registered++;
        } catch (e) {
          result.errors.push(`${tool.name}: ${e && e.message ? e.message : String(e)}`);
        }
      }
    } else if (typeof mc.provideContext === 'function') {
      result.method = 'provideContext';
      await mc.provideContext({ tools });
      result.registered = tools.length;
    } else {
      result.errors.push('model context exposes neither registerTool nor provideContext');
    }
  } catch (e) {
    result.errors.push(`registration failed: ${e && e.message ? e.message : String(e)}`);
  }
  return result;
}

export async function reregister(mc, allTools, previousNames = []) {
  if (typeof mc.registerTool === 'function') {
    return registerTools(mc, allTools.filter((t) => !previousNames.includes(t.name)));
  }
  return registerTools(mc, allTools);
}
