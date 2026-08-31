// One place that knows where forms are sent.
//
// The endpoint used to be typed into four pages. Moving it — which we have now done once —
// meant finding all four and getting all four right, with nothing to tell you if you missed
// one. A missed page keeps posting to the old account and the site looks fine either way.
//
// So it lives here. Next move is one line.

window.SEMITRICAL_FORM = 'https://formspree.io/f/mwlklprv';

// Every submission carries `source`, so one form can serve four places and still be sorted.
// The free plan allows a single form, and `_subject` alone is fragile — it is prose, and prose
// gets edited. `source` is a key nobody has a reason to reword.
window.semitricalSend = function (data, opts) {
  opts = opts || {};
  if (opts.source) data.append('source', opts.source);
  return fetch(window.SEMITRICAL_FORM, {
    method: 'POST',
    body: data,
    headers: { Accept: 'application/json' },
    // The download gates navigate to the PDF the instant they submit, and a normal fetch is
    // cancelled when the page unloads. keepalive lets the request outlive the navigation,
    // which is the difference between capturing that lead and losing it.
    keepalive: true,
  }).then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r;
  });
};
