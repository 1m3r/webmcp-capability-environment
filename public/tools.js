/* Tool surface. Loaded under ?tools=exec and ?tools=on, never under ?tools=off.

   This file is served to BOTH Level 1 conditions, so it must name nothing that
   only the experimental condition has. It defines the execution tool, which
   both conditions get, and nothing else. Anything mode-specific lives in a
   module whose name is derived from the mode at runtime, so the control's byte
   stream carries no literal naming it. */
(function () {
  "use strict";

  var P = window.PROBE;
  if (!P) return;

  var found = P.getContext();
  if (!found || !found.mc) {
    P.registration.errors.push('no model context at tool-registration time');
    P.refreshStatus();
    return;
  }
  var mc = found.mc;

  function text(s) { return { content: [{ type: 'text', text: String(s) }] }; }
  P.text = text;

  /* ---- the execution tool ----------------------------------------------
     Permissive by design: every operation is applied as given. No checking,
     no rejection, no advisory text in the response. */

  var applyLayout = {
    name: 'apply_layout',
    description:
      'Applies layout operations to the canvas on this page. Operations are applied in order. ' +
      'Use set_html to replace the canvas contents, append_html to add to them, add_css to add a ' +
      'stylesheet, set_style to set inline styles on elements matching a CSS selector, remove to ' +
      'delete matching elements, and clear to empty the canvas.',
    inputSchema: {
      type: 'object',
      properties: {
        ops: {
          type: 'array',
          description: 'Operations to apply, in order.',
          items: {
            type: 'object',
            properties: {
              op: {
                type: 'string',
                enum: ['set_html', 'append_html', 'add_css', 'set_style', 'remove', 'clear'],
                description: 'Which operation to perform.'
              },
              html: { type: 'string', description: 'HTML, for set_html and append_html.' },
              css: { type: 'string', description: 'CSS text, for add_css.' },
              selector: {
                type: 'string',
                description: 'CSS selector scoped to the canvas, for set_style and remove. Omit to target the canvas itself.'
              },
              styles: {
                type: 'object',
                description: 'CSS property/value pairs, for set_style.',
                additionalProperties: { type: 'string' }
              }
            },
            required: ['op']
          }
        }
      },
      required: ['ops']
    },
    execute: async function (input) {
      var args = input || {};
      if (args.arguments) args = args.arguments;
      var ops = Array.isArray(args) ? args : (args.ops || args.operations || []);

      var entry = P.logCall('apply_layout', { ops: ops });
      var r = P.applyOps(ops);
      var msg = 'Applied ' + r.applied + ' of ' + r.total + ' operations. ' +
                'The canvas contains ' + r.elements + ' elements.';
      if (r.skipped.length) msg += ' Not applied: ' + r.skipped.join(', ') + '.';
      P.finishCall(entry, true, 'applied ' + r.applied + '/' + r.total + ', ' + r.elements + ' elements', msg);
      return text(msg);
    }
  };

  /* ---- collection ------------------------------------------------------
     A mode module, if there is one for this mode, prepends to this list
     before registration runs. */

  window.__PROBE_TOOLS__ = [applyLayout];

  /* ---- registration ----------------------------------------------------
     registerTool/unregisterTool is the current surface; provideContext was
     removed from the spec in March 2026 but older clients may still ship it. */

  async function register() {
    var tools = window.__PROBE_TOOLS__;
    try {
      if (typeof mc.registerTool === 'function') {
        P.registration.method = 'registerTool';
        for (var i = 0; i < tools.length; i++) {
          try {
            await mc.registerTool(tools[i]);
            P.registration.registered++;
            P.refreshStatus();
          } catch (e) {
            P.registration.errors.push(tools[i].name + ': ' + (e && e.message ? e.message : String(e)));
          }
        }
      } else if (typeof mc.provideContext === 'function') {
        P.registration.method = 'provideContext';
        await mc.provideContext({ tools: tools });
        P.registration.registered = tools.length;
      } else {
        P.registration.method = 'none';
        P.registration.errors.push('model context exposes neither registerTool nor provideContext');
      }
    } catch (e) {
      P.registration.errors.push('registration failed: ' + (e && e.message ? e.message : String(e)));
    }
    P.refreshStatus();
    try {
      console.log('[probe] ' + P.registration.registered + ' tools registered via ' +
                  P.registration.method + ' on ' + found.entry);
      if (P.registration.errors.length) console.warn('[probe]', P.registration.errors);
    } catch (e) {}
  }

  /* Modes that have their own module load it here. The filename is built from
     the mode, so no mode this page is not running is named in this file. */

  var MODES_WITH_MODULE = { on: 1 };

  if (MODES_WITH_MODULE[P.tools]) {
    var s = document.createElement('script');
    s.src = 'tools.' + P.tools + '.js';
    s.onload = function () { register(); };
    s.onerror = function () {
      P.registration.errors.push('tool module failed to load');
      register();
    };
    document.head.appendChild(s);
  } else {
    register();
  }
})();
