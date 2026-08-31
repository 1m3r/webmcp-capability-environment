/* Experimental-condition tool module. Requested only when the page is opened
   with ?tools=on, so the control run's byte stream contains neither this tool's
   name nor the path it reads. The rule text itself is never in any page source
   — it is fetched from disk at call time. */
(function () {
  "use strict";

  var P = window.PROBE;
  if (!P || !window.__PROBE_TOOLS__) return;

  var houseRules = {
    name: 'get_house_rules',
    description: 'Returns the house rules that apply to work on this page, as plain text.',
    inputSchema: { type: 'object', properties: {} },
    execute: async function () {
      var entry = P.logCall('get_house_rules', {});
      try {
        var res = await fetch('house-rules.txt', { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        var body = await res.text();
        P.finishCall(entry, true, 'returned ' + body.length + ' chars', body);
        return P.text(body);
      } catch (e) {
        P.finishCall(entry, false, 'error: ' + e.message, null);
        return P.text('House rules could not be read: ' + e.message);
      }
    }
  };

  /* Prepended, so registration order matches Level 0. */
  window.__PROBE_TOOLS__.unshift(houseRules);
})();
