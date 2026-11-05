// The free supplier read, from the API. Nothing on the page is typed in.
//
// The page used to carry STMicroelectronics' figures as literal HTML. That is wrong the moment
// the rotation moves, and the line above them says "this week" -- so a static page is a page
// that lies on a schedule. Everything here comes from one request.
//
// api.semitrical.ai, never app.legalforensics.ai: a visitor must not see the old brand, and
// the fetch shows in the network tab.
(function () {
  'use strict';

  var API = 'https://api.semitrical.ai/api/public/hub';

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // ── formatting ───────────────────────────────────────────────────────────────────────
  // The API's money unit is $M, so a four-digit figure is billions to a reader.
  function fmt(v, unit) {
    if (v == null) return '–';
    if (unit === '$M') {
      return Math.abs(v) >= 1000 ? '$' + (v / 1000).toFixed(1) + 'B'
                                 : '$' + Math.round(v) + 'M';
    }
    if (unit === '%') return v.toFixed(1) + '%';
    if (unit === '×') return v.toFixed(1) + '×';
    return String(Math.round(v));
  }

  // "Q2-26" sorts after "Q3-25" by date and before it alphabetically, which is how a quarter
  // list ends up in the wrong order. Sort on the pair, never on the label.
  function quarterKey(p) {
    var m = /^Q(\d)-(\d\d)$/.exec(p || '');
    return m ? (2000 + +m[2]) * 10 + +m[1] : -1;
  }
  function latestPeriod(periods) {
    if (!periods || !periods.length) return null;
    return periods.slice().sort(function (a, b) { return quarterKey(a) - quarterKey(b); }).pop();
  }

  // ── the rotation line ────────────────────────────────────────────────────────────────
  function rotation(d) {
    var box = $('rotation');
    if (!box) return;
    var n = d.rotation_size || 0;
    box.textContent = '';
    box.appendChild(el('span', 'rot-now', '● This week'));
    box.appendChild(el('span', 'rot-name', (d.supplier && d.supplier.name) || '—'));
    if (d.next && d.next.name) {
      box.appendChild(el('span', 'rot-sep', '|'));
      box.appendChild(el('span', null, 'Next week'));
      box.appendChild(el('span', 'rot-next', d.next.name));
    }
    if (n) {
      // Said in weeks, from the real rotation size. "Every few months" was a guess that was
      // wrong while the rotation was six, and would be wrong again the moment it changes.
      box.appendChild(el('span', 'rot-note',
        '· ' + n + ' suppliers, so yours comes round every ' + n + ' weeks'));
    }
  }

  // ── what management said ─────────────────────────────────────────────────────────────
  function said(d) {
    var box = $('said');
    if (!box) return;
    var s = d.supplier || {};
    var rows = s.said || [];
    box.textContent = '';

    if (!rows.length) {
      // The absence has to say why. Absent from our corpus is not absent from the record.
      var note = el('p', 'said-absent', s.said_note ||
        'We hold no earnings calls for this supplier yet, so there is no reading of what ' +
        'management said. That is a gap in our coverage, not a finding about the supplier.');
      box.appendChild(note);
      box.className = 'said is-empty';
      return;
    }
    box.className = 'said';

    rows.forEach(function (r) {
      var bad = r.for_buyer === 'bad';
      var card = el('div', 'said-card ' + (bad ? 'is-against' : 'is-favour'));
      card.appendChild(el('h4', null, r.label || r.topic));
      card.appendChild(el('p', 'said-verdict', bad ? 'Against you' : 'In your favour'));

      var q = (r.quotes || [])[0];
      var meta = 'as stated in ' + ((q && q.period) || '—') +
                 ' · ' + (r.statements || 0) + ' findings';
      card.appendChild(el('p', 'said-meta', meta));
      card.appendChild(el('p', 'said-means', r.means || ''));

      if (q && q.sentence) {
        var bq = el('blockquote', 'said-quote');
        bq.appendChild(el('p', null, '“' + q.sentence + '”'));
        bq.appendChild(el('footer', null, q.citation || ''));
        card.appendChild(bq);
      }
      box.appendChild(card);
    });
  }

  // ── charts ───────────────────────────────────────────────────────────────────────────
  // Two shapes come back. A bar chart's rows carry the series key directly and one row is the
  // trailing total; a line chart's annual rows carry `annual_<key>` and its quarter rows carry
  // `q_<key>`, which is the one thing you cannot guess from looking at a bar chart.
  function value(row, key, chart) {
    if (chart === 'line') {
      return row.section === 'quarter' ? row['q_' + key] : row['annual_' + key];
    }
    return row[key];
  }

  function barChart(c, key) {
    var rows = (c.data || []).filter(function (r) { return value(r, key, c.chart) != null; });
    var vals = rows.map(function (r) { return value(r, key, c.chart); });
    var top = Math.max.apply(null, vals.concat([0])) || 1;

    var bars = el('div', 'bars');
    var years = el('div', 'bar-years');
    rows.forEach(function (r) {
      var v = value(r, key, c.chart);
      var h = Math.max(6, Math.round((v / top) * 104));
      var col = el('div', 'bar-col');
      col.appendChild(el('span', 'bar-val', fmt(v, c.unit)));
      var bar = el('span', 'bar' + (r.isTTM || r.section === 'ttm' ? ' is-trailing' : ''));
      bar.style.height = h + 'px';
      col.appendChild(bar);
      bars.appendChild(col);

      // The trailing bar names itself. An unlabelled seventh bar beside six years reads as a
      // seventh year, which is the one reading that would be wrong.
      var lab = r.isTTM || r.section === 'ttm' ? 'TTM' : String(r.label).replace(/^FY/, '');
      var yr = el('span', null, lab);
      var growth = c.value_label_key ? r[c.value_label_key] : null;
      if (growth) yr.appendChild(el('span', 'bar-growth', growth));
      years.appendChild(yr);
    });
    return [bars, years];
  }

  var NS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }

  function lineChart(c, key) {
    var rows = (c.data || []).filter(function (r) { return value(r, key, c.chart) != null; });
    if (rows.length < 2) return [];

    var W = 300, H = 130, padL = 6, padR = 6, padT = 14, padB = 20;
    var vals = rows.map(function (r) { return value(r, key, c.chart); });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (hi === lo) { hi = lo + 1; }
    var span = hi - lo;
    // A little headroom so the top point is not welded to the frame.
    lo -= span * 0.12; hi += span * 0.12;

    function x(i) { return padL + (i * (W - padL - padR)) / (rows.length - 1); }
    function y(v) { return padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB); }

    var svg = svgEl('svg', {
      viewBox: '0 0 ' + W + ' ' + H, role: 'img', class: 'linechart',
      'aria-label': c.title + ': ' + fmt(vals[0], c.unit) + ' in ' + rows[0].label +
                    ' to ' + fmt(vals[vals.length - 1], c.unit) + ' in ' + rows[rows.length - 1].label
    });

    // Annual and trailing are different bases, so they are drawn as different lines rather
    // than one continuous series that implies they are the same measurement.
    var annual = [], quarters = [];
    rows.forEach(function (r, i) {
      (r.section === 'quarter' ? quarters : annual).push([x(i), y(value(r, key, c.chart)), r]);
    });
    function poly(pts, cls) {
      if (pts.length < 2) return;
      svg.appendChild(svgEl('polyline', {
        class: cls, fill: 'none',
        points: pts.map(function (p) { return p[0] + ',' + p[1]; }).join(' ')
      }));
    }
    // Join the two runs so the eye follows one reading, with the trailing run dashed.
    if (annual.length && quarters.length) {
      poly([annual[annual.length - 1], quarters[0]], 'ln-trailing');
    }
    poly(annual, 'ln-annual');
    poly(quarters, 'ln-trailing');

    annual.concat(quarters).forEach(function (p) {
      var r = p[2];
      svg.appendChild(svgEl('circle', {
        cx: p[0], cy: p[1], r: 3,
        class: 'pt' + (r.section === 'quarter' ? ' is-quarter' : '') +
               (r.covered ? ' is-covered' : '')
      }));
    });

    var first = rows[0], last = rows[rows.length - 1];
    var caption = el('div', 'bar-years');
    caption.appendChild(el('span', null, String(first.label).replace(/^FY/, '')));
    var mid = el('span', 'ln-mid', fmt(value(last, key, c.chart), c.unit));
    caption.appendChild(mid);
    caption.appendChild(el('span', null, String(last.label).replace(/^FY/, '')));
    return [svg, caption];
  }

  function charts(d) {
    var box = $('charts');
    if (!box) return;
    var s = d.supplier || {};
    var list = s.charts || [];
    box.textContent = '';
    if (!list.length) {
      box.appendChild(el('p', 'said-absent',
        'We hold no filed accounts for this supplier yet.'));
      return;
    }
    list.forEach(function (c) {
      var key = ((c.series || [])[0] || {}).key;
      if (!key) return;
      var card = el('div', 'chart');
      var head = el('div', 'chart-head');
      head.appendChild(el('h4', null, c.title));
      var rows = (c.data || []).filter(function (r) { return value(r, key, c.chart) != null; });
      var last = rows[rows.length - 1];
      if (last) {
        head.appendChild(el('p', 'chart-latest',
          fmt(value(last, key, c.chart), c.unit) + ' · ' + last.label));
      }
      card.appendChild(head);
      var parts = c.chart === 'line' ? lineChart(c, key) : barChart(c, key);
      parts.forEach(function (n) { card.appendChild(n); });
      box.appendChild(card);
    });
  }

  // ── the report header ────────────────────────────────────────────────────────────────
  function header(d) {
    var s = d.supplier || {};
    var name = $('rep-name'), tick = $('rep-ticker'), asat = $('rep-asat');
    if (name) name.textContent = s.name || '—';
    if (tick) tick.textContent = s.ticker || '';
    if (asat) {
      var bits = [];
      var q = latestPeriod((s.corpus || {}).periods);
      if (q) bits.push('As at ' + q);
      if ((s.filed || {}).fiscal_year) bits.push('FY' + s.filed.fiscal_year + ' accounts');
      bits.push('free this week');
      asat.textContent = bits.join(' · ');
    }
    var cov = $('coverage-note');
    if (cov && d.coverage_note) cov.textContent = d.coverage_note;
  }

  // ── the picker, on the Pro page ──────────────────────────────────────────────────────
  var GROUPS = [
    { key: 'analog', name: 'Analog and power' },
    { key: 'memory', name: 'Memory and storage' }
  ];

  function picker(d) {
    var box = $('picker');
    if (!box) return;
    var roster = d.roster || [];
    box.textContent = '';
    var picked = [];

    function summary() {
      var n = picked.length;
      var total = $('pick-total'), line = $('pick-count'), cta = $('pick-cta'),
          chips = $('pick-chips'), field = $('pick-field');
      if (total) {
        total.textContent = n === 0 ? 'Nothing picked yet' : String(n);
        total.className = n === 0 ? 'pick-total is-empty' : 'pick-total';
      }
      if (line) line.textContent = n === 0 ? 'Tick the suppliers you buy from'
                                           : (n === 1 ? 'supplier picked' : 'suppliers picked');
      if (cta) {
        cta.textContent = n === 0 ? 'Pick at least one supplier'
                                  : 'Ask for pricing on these ' + n;
        cta.disabled = n === 0;
      }
      if (chips) {
        chips.textContent = '';
        picked.forEach(function (t) { chips.appendChild(el('span', 'pick-chip', t)); });
        chips.hidden = n === 0;
      }
      if (field) field.value = picked.join(', ');
    }

    GROUPS.forEach(function (g) {
      var items = roster.filter(function (r) { return (r.category || '') === g.key; });
      if (!items.length) return;
      var wrap = el('div', 'pick-group');
      wrap.appendChild(el('h3', null, g.name));
      var grid = el('div', 'pick-grid');
      items.forEach(function (r) {
        var id = 'sup-' + r.ticker;
        var label = el('label', 'pick-item');
        label.setAttribute('for', id);
        var cb = document.createElement('input');
        cb.type = 'checkbox'; cb.id = id; cb.className = 'pick-cb'; cb.value = r.ticker;
        var tick = el('span', 'pick-tick');
        tick.setAttribute('aria-hidden', 'true');
        var text = el('span', 'pick-text');
        text.appendChild(el('span', 'pick-name', r.name));
        // The second line earns its place or it is not there: for Samsung, Kioxia, Nanya and
        // Winbond the ticker IS the name, so printing it underneath says the same word twice.
        if (r.name.toLowerCase().indexOf(r.ticker.toLowerCase()) === -1) {
          text.appendChild(el('span', 'pick-ticker', r.ticker));
        }
        cb.addEventListener('change', function () {
          var i = picked.indexOf(r.ticker);
          if (cb.checked && i === -1) picked.push(r.ticker);
          if (!cb.checked && i !== -1) picked.splice(i, 1);
          label.classList.toggle('is-on', cb.checked);
          summary();
        });
        label.appendChild(cb);
        label.appendChild(tick);
        label.appendChild(text);
        grid.appendChild(label);
      });
      wrap.appendChild(grid);
      box.appendChild(wrap);
    });

    var cov = $('coverage-note');
    if (cov && d.coverage_note) cov.textContent = d.coverage_note;
    summary();
  }

  // ── go ───────────────────────────────────────────────────────────────────────────────
  function fail(msg) {
    ['rotation', 'said', 'charts', 'picker'].forEach(function (id) {
      var n = $(id);
      if (!n) return;
      n.textContent = '';
      n.appendChild(el('p', 'said-absent', msg));
    });
  }

  fetch(API, { headers: { Accept: 'application/json' } })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (d) {
      if (!d || !d.supplier) {
        fail('No supplier is featured this week.');
        if (d && d.roster) picker(d);
        return;
      }
      header(d); rotation(d); said(d); charts(d); picker(d);
    })
    .catch(function (e) {
      // Say that the figures could not be loaded. A page that quietly shows nothing reads as
      // a supplier with nothing to report, which is the one thing it must never imply.
      fail('We could not load this week’s figures just now. Please try again shortly, ' +
           'or email contact@semitrical.ai.');
      if (window.console) console.error('hub:', e);
    });
})();
