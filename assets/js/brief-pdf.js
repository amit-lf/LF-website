// "We can send you the brief as a PDF."
//
// Not a gate. The whole brief is on the page above this form and nothing is held back, so the
// form is an offer: give us an address and the PDF arrives there. A form that pretends to
// unlock free content teaches the reader the content was not worth much.
//
// It posts to api.semitrical.ai, which records the request and sends the mail. Separate from
// semitricalSend because that one posts to Formspree, which can notify us but cannot email
// the person who asked.
(function () {
  'use strict';

  var form = document.getElementById('pdf-form');
  if (!form) return;

  var API = 'https://api.semitrical.ai/api/public/brief-pdf';
  var btn = document.getElementById('pdf-send');
  var note = document.getElementById('pdf-note');
  var done = document.getElementById('pdf-done');
  var label = btn ? btn.textContent : 'Send it to me';

  function say(msg) { if (note) { note.textContent = msg; note.hidden = false; } }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (note) note.hidden = true;

    var email = (form.email.value || '').trim();
    if (email.indexOf('@') < 1) { form.email.focus(); say('We need an address to send it to.'); return; }

    btn.disabled = true;
    btn.textContent = 'Sending…';

    fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brief: form.getAttribute('data-brief'),
        email: email,
        name: (form.name_.value || '').trim(),
        company: (form.company.value || '').trim(),
        role: (form.role.value || '').trim(),
        website: (form.website.value || '').trim(),
      }),
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        // The server answers 200 with a spoken reason rather than a status code, because the
        // page cannot explain a 429 better than the server can.
        if (d && d.ok) {
          form.hidden = true;
          if (done) done.hidden = false;
          return;
        }
        say((d && d.reason) || 'That did not go through. Email contact@semitrical.ai and we will send it.');
        btn.disabled = false;
        btn.textContent = label;
      })
      .catch(function () {
        say('That did not go through. Email contact@semitrical.ai and we will send it.');
        btn.disabled = false;
        btn.textContent = label;
      });
  });
})();
