// One place that knows where forms are sent.
//
// The endpoint used to be typed into four pages. Moving it — which we have now done twice —
// meant finding all four and getting all four right, with nothing to tell you if you missed
// one. A missed page keeps posting to the old place and the site looks fine either way.
//
// So it lives here. The last move was one line.

// OUR OWN ENDPOINT, NOT FORMSPREE, since 2026-11-06.
//
// Formspree accepted a submission, returned {"ok": true}, and then silently dropped it — a spam
// heuristic we do not control, on a free tier with a monthly cap, delivering to a different
// inbox from everything else. Two real submissions vanished while the page said they had
// arrived. A capture that fails silently is worse than one that fails loudly, because nobody
// goes looking.
//
// /api/public/enquiry writes the row before it mails, so an enquiry survives a bad day at SES,
// and it lands in the same table and the same inbox as every other thing we capture.
window.SEMITRICAL_FORM = 'https://api.semitrical.ai/api/public/enquiry';

// Every submission carries `source`, so one endpoint serves every form and they stay sortable.
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
    return r.json().catch(function () { return { ok: true }; });
  }).then(function (d) {
    // The endpoint answers 200 with a spoken reason rather than a status code, because the
    // page cannot explain a rate limit better than the server can. Surfaced as a rejection so
    // every existing caller's .catch keeps doing the right thing.
    if (d && d.ok === false) throw new Error(d.reason || 'rejected');
    return d;
  });
};
