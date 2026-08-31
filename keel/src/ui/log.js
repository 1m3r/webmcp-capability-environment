/* Governance has to be visible in the page, not buried in an API — otherwise
   every strengthening move drains value out of WebMCP and into a backend that
   a hosted MCP server would do equally well. The human watches the gate bite. */

const esc = (s) => String(s).replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));

export function renderLog(el, events) {
  if (!events.length) { el.innerHTML = '<p class="empty">nothing yet</p>'; return; }
  el.innerHTML = events.slice().reverse().slice(0, 60).map((e) => `
    <div class="ev ev-${esc(e.actor)}">
      <span class="who">${esc(e.actor)}</span>
      <span class="what">${esc(e.kind)}</span>
      <span class="v">v${esc(e.version)}</span>
      ${e.detail ? `<div class="detail">${esc(e.detail)}</div>` : ''}
    </div>`).join('');
}
