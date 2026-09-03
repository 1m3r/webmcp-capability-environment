/* WebMCP entry-point detection and registration.

   Order is deliberate and is copied from the frozen probe, which is the version
   verified against live clients: registerTool/unregisterTool is the current
   surface, and provideContext was removed from the spec in March 2026 but older
   clients may still ship it.

   The difference matters whenever the surface changes: registerTool is ADDITIVE
   and keyed by name, while provideContext REPLACES the set and must be handed
   everything. reregister() is the only place that distinction lives. */

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

const message = (e) => (e && e.message ? e.message : String(e));

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
          result.errors.push(`${tool.name}: ${message(e)}`);
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
    result.errors.push(`registration failed: ${message(e)}`);
  }
  return result;
}

/* Everything about a tool an agent can see. A name is not enough to decide
   whether a registration is stale: this game shapes `submit_answer`'s schema
   from the mode, so the same name can carry a different body. */
export function signatureOf(tool) {
  return JSON.stringify({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: tool.annotations ?? null
  });
}

/* Bring the client's surface in line with `allTools`.

   `previous` is what was registered last time, as TOOL OBJECTS. Names are
   accepted for backwards compatibility and mean "assume unchanged".

   Three things happen, and the middle one is the reason this function was
   rewritten. A live run found it: tools register on arrival, before the human
   has picked a game, so `submit_answer` was built with no mode and carried only
   `text`. Picking Perspective rebuilt the surface correctly — and this function
   then skipped every tool whose NAME was already registered, so the agent went
   on holding a submit_answer with no image slot and could not commit a read.
   It said so, on the shared screen, and it was right.

     gone     a verb the game no longer offers is unregistered, because
              authority here is the absence of a tool and a stale verb is a
              verb the agent still has
     changed  a verb whose body changed is registered again, dropped first
              where the client allows it, since registerTool is keyed by name
     new      registered

   A client with no unregisterTool cannot have a verb taken away; that is
   reported as an error rather than passed over in silence, because the run
   record is the evidence. */
export async function reregister(mc, allTools, previous = []) {
  if (typeof mc.registerTool !== 'function') {
    /* provideContext replaces the whole set, so handing it everything is both
       the update and the removal. */
    return registerTools(mc, allTools);
  }

  const before = new Map(previous.map((p) => (typeof p === 'string'
    ? [p, null]                       // name only: assume unchanged
    : [p.name, signatureOf(p)])));
  const now = new Set(allTools.map((t) => t.name));
  const result = { method: 'registerTool', registered: 0, errors: [] };

  const drop = async (name) => {
    if (typeof mc.unregisterTool !== 'function') {
      result.errors.push(`${name}: this client cannot unregister a tool`);
      return false;
    }
    try {
      await mc.unregisterTool(name);
      return true;
    } catch (e) {
      result.errors.push(`${name}: ${message(e)}`);
      return false;
    }
  };

  for (const name of before.keys()) {
    if (!now.has(name)) await drop(name);
  }

  const stale = allTools.filter((tool) => {
    if (!before.has(tool.name)) return true;                 // new
    const was = before.get(tool.name);
    return was !== null && was !== signatureOf(tool);        // changed
  });

  for (const tool of stale) {
    if (before.has(tool.name)) await drop(tool.name);
  }

  const out = await registerTools(mc, stale);
  result.registered = out.registered;
  result.errors = result.errors.concat(out.errors);
  return result;
}
