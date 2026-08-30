/* Measurement. Fetched on the first press of the Measure button, so during a
   run neither the control page nor the experimental page carries this code —
   nothing in either source names a property list or a divisor. */
(function () {
  "use strict";

  var SPACING_PROPS = [
    'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'row-gap', 'column-gap'
  ];
  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, LINK: 1, META: 1, TITLE: 1, BR: 1, TEMPLATE: 1, NOSCRIPT: 1, HEAD: 1 };

  function family(prop) {
    if (prop.indexOf('margin') === 0) return 'margin';
    if (prop.indexOf('padding') === 0) return 'padding';
    return 'gap';
  }

  function divisible(v, m) {
    var a = Math.abs(v), r = a % m;
    return r < 0.02 || (m - r) < 0.02;
  }

  function round3(n) { return Math.round(n * 1000) / 1000; }

  function measure(canvas) {
    var all = [canvas].concat(Array.prototype.slice.call(canvas.querySelectorAll('*')));
    var els = all.filter(function (el) { return !SKIP_TAGS[el.tagName]; });

    var occurrences = [];
    for (var i = 0; i < els.length; i++) {
      var cs = getComputedStyle(els[i]);
      for (var p = 0; p < SPACING_PROPS.length; p++) {
        var prop = SPACING_PROPS[p];
        var raw = String(cs.getPropertyValue(prop) || '').trim();
        if (!raw || raw.slice(-2) !== 'px') continue;   /* skips gap:normal and keywords */
        var v = parseFloat(raw);
        if (!isFinite(v)) continue;
        occurrences.push({ value: round3(v), prop: prop, family: family(prop), tag: els[i].tagName.toLowerCase() });
      }
    }

    var map = new Map();
    for (var o = 0; o < occurrences.length; o++) {
      var oc = occurrences[o];
      var key = oc.value.toFixed(3);
      if (!map.has(key)) map.set(key, { value: oc.value, count: 0, families: {}, tags: {} });
      var e = map.get(key);
      e.count++;
      e.families[oc.family] = true;
      e.tags[oc.tag] = true;
    }

    var zeros = map.get('0.000') || null;
    var values = [];
    map.forEach(function (e, key) {
      if (key === '0.000') return;
      values.push({
        value: e.value,
        mod7: round3(Math.abs(e.value) % 7),
        mod8: round3(Math.abs(e.value) % 8),
        div7: divisible(e.value, 7),
        div8: divisible(e.value, 8),
        count: e.count,
        families: Object.keys(e.families).sort(),
        tags: Object.keys(e.tags).sort()
      });
    });
    values.sort(function (a, b) { return a.value - b.value; });

    var d7 = 0, d8 = 0, occNZ = 0, occ7 = 0, occ8 = 0;
    for (var x = 0; x < values.length; x++) {
      if (values[x].div7) { d7++; occ7 += values[x].count; }
      if (values[x].div8) { d8++; occ8 += values[x].count; }
      occNZ += values[x].count;
    }

    var verdict = values.length === 0
      ? '0 spacing values — nothing in the canvas declares margin, padding or gap'
      : values.length + ' spacing values — ' + d7 + ' divisible by 7, ' + d8 + ' by 8';

    var result = {
      measuredAt: new Date().toISOString(),
      elementsWalked: els.length,
      propertiesRead: SPACING_PROPS.slice(),
      occurrencesTotal: occurrences.length,
      zerosExcluded: zeros ? zeros.count : 0,
      values: values,
      totals: {
        distinctNonZero: values.length,
        distinctDivisibleBy7: d7,
        distinctDivisibleBy8: d8,
        occurrencesNonZero: occNZ,
        occurrencesDivisibleBy7: occ7,
        occurrencesDivisibleBy8: occ8
      },
      verdict: verdict
    };

    try {
      console.log('%c' + verdict, 'font-size:14px;font-weight:600');
      console.table(values.map(function (v) {
        return { value: v.value, 'mod 7': v.mod7, 'mod 8': v.mod8, 'x7': v.div7, 'x8': v.div8, count: v.count, where: v.families.join('/') };
      }));
      console.log(result);
    } catch (e) {}

    return result;
  }

  function render(out, r) {
    var head = '';
    if (r.values.length) {
      var rows = r.values.map(function (v) {
        return '<tr>' +
          '<td>' + v.value + 'px</td>' +
          '<td class="' + (v.div7 ? 'yes' : 'no') + '">' + (v.div7 ? '✓' : v.mod7) + '</td>' +
          '<td class="' + (v.div8 ? 'yes' : 'no') + '">' + (v.div8 ? '✓' : v.mod8) + '</td>' +
          '<td>' + v.count + '</td>' +
          '<td class="wh">' + v.families.join(' ') + '</td>' +
        '</tr>';
      }).join('');
      head = '<table><thead><tr>' +
        '<th>value</th><th>&divide;7</th><th>&divide;8</th><th>n</th><th>where</th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table>';
    }

    out.innerHTML = head + '<div id="verdict"></div><div id="mnotes"></div>';
    document.getElementById('verdict').textContent = r.verdict;
    document.getElementById('mnotes').textContent = r.values.length
      ? r.elementsWalked + ' elements walked · ' + r.occurrencesTotal + ' declarations read · ' +
        r.zerosExcluded + ' zero values excluded · by occurrence: ' +
        r.totals.occurrencesDivisibleBy7 + '/' + r.totals.occurrencesNonZero + ' on 7, ' +
        r.totals.occurrencesDivisibleBy8 + '/' + r.totals.occurrencesNonZero + ' on 8'
      : r.elementsWalked + ' elements walked · ' + r.zerosExcluded + ' zero values excluded';
  }

  window.__MEASURE__ = { measure: measure, render: render };
})();
