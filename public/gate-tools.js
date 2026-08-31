/* The tool surface for the gate.

   Three tools. None of them can change the standard on its own authority:

     apply_layout         does the work, and is refused when the work departs
                          from the standard
     get_house_rules      reads the standard as it currently stands, including
                          any amendment a human has just made
     request_rule_change  ASKS. Under 'ask' it creates a pending row in the
                          panel and changes nothing. Only under 'delegated' —
                          which a human must set, and the ceiling can cap —
                          does it change a value directly.

   There is deliberately no tool for approving a request, lifting the gate, or
   setting a permission. Those exist only as controls in the page. */
(function () {
  "use strict";

  var A = window.__GATE_API__;
  var G = window.__GATE__;
  if (!A || !G) return;

  var found = A.getContext();
  if (!found || !found.mc) {
    A.registration.errors.push('no model context at tool-registration time');
    A.refreshStatus();
    return;
  }
  var mc = found.mc;

  function text(s) { return { content: [{ type: 'text', text: String(s) }] }; }

  var applyLayout = {
    name: 'apply_layout',
    description:
      'Applies layout operations to the canvas on this page. Operations are applied in order. ' +
      'Use set_html to replace the canvas contents, append_html to add to them, add_css to add a ' +
      'stylesheet, set_style to set inline styles on elements matching a CSS selector, remove to ' +
      'delete matching elements, and clear to empty the canvas. ' +
      'Work on this page is held to a house standard: read it with get_house_rules. Operations that ' +
      'depart from it are refused and nothing is changed.',
    inputSchema: {
      type: 'object',
      properties: {
        ops: {
          type: 'array',
          description: 'Operations to apply, in order.',
          items: {
            type: 'object',
            properties: {
              op: { type: 'string',
                    enum: ['set_html', 'append_html', 'add_css', 'set_style', 'remove', 'clear'],
                    description: 'Which operation to perform.' },
              html: { type: 'string', description: 'HTML, for set_html and append_html.' },
              css: { type: 'string', description: 'CSS text, for add_css.' },
              selector: { type: 'string',
                    description: 'CSS selector scoped to the canvas, for set_style and remove. Omit to target the canvas itself.' },
              styles: { type: 'object', description: 'CSS property/value pairs, for set_style.',
                    additionalProperties: { type: 'string' } }
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
      var r = A.applyGated(ops);
      return text(r.message);
    }
  };

  var houseRules = {
    name: 'get_house_rules',
    description:
      'Returns the house standard that applies to work on this page, as plain text. ' +
      'A human can amend it at any time, so read it again if a change is approved.',
    inputSchema: { type: 'object', properties: {} },
    execute: async function () {
      var body = A.standardText();
      A.log('human', 'get_house_rules', 'returned ' + body.length + ' chars');
      return text(body);
    }
  };

  var requestRuleChange = {
    name: 'request_rule_change',
    description:
      'Asks a human to amend one rule of the house standard. This does not change anything by ' +
      'itself: unless a human has delegated that rule, the request is queued in the page and the ' +
      'standard stays as it is until someone approves it there. Use it when the work you have been ' +
      'asked for cannot be done within the standard, and say why.',
    inputSchema: {
      type: 'object',
      properties: {
        rule: { type: 'string', enum: ['spacing', 'controls', 'gap', 'radius', 'colour'],
                description: 'Which rule to amend.' },
        value: { type: 'string',
                description: 'The proposed value. Numbers for controls and radius, a ratio like 2/7 for gap, ' +
                             'a comma-separated list for spacing.' },
        reason: { type: 'string', description: 'Why the change is needed. A human reads this before deciding.' }
      },
      required: ['rule', 'value', 'reason']
    },
    execute: async function (input) {
      var args = input || {};
      if (args.arguments) args = args.arguments;
      var r = A.requestRuleChange(args.rule, args.value, args.reason);
      return text(r.message);
    }
  };

  var tools = [houseRules, applyLayout, requestRuleChange];

  (async function register() {
    try {
      if (typeof mc.registerTool === 'function') {
        A.registration.method = 'registerTool';
        for (var i = 0; i < tools.length; i++) {
          try { await mc.registerTool(tools[i]); A.registration.registered++; A.refreshStatus(); }
          catch (e) { A.registration.errors.push(tools[i].name + ': ' + (e && e.message ? e.message : String(e))); }
        }
      } else if (typeof mc.provideContext === 'function') {
        A.registration.method = 'provideContext';
        await mc.provideContext({ tools: tools });
        A.registration.registered = tools.length;
      } else {
        A.registration.method = 'none';
        A.registration.errors.push('model context exposes neither registerTool nor provideContext');
      }
    } catch (e) {
      A.registration.errors.push('registration failed: ' + (e && e.message ? e.message : String(e)));
    }
    A.refreshStatus();
  })();
})();
