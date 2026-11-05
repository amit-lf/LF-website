// The picker's submit. The selection itself is built by hub.js from the API roster; this is
// only the send.
//
// It goes through window.semitricalSend like every other form on the site, so there is still
// one place that knows where forms are posted. `source` separates these from a contact
// enquiry in the inbox, and the subject carries the count so a one-supplier ask and a
// thirteen-supplier ask are tellable apart without opening either.
(function () {
  'use strict';

  var form = document.getElementById('pick-form');
  if (!form) return;

  var cta = document.getElementById('pick-cta');
  var err = document.getElementById('pick-err');
  var done = document.getElementById('pick-done');
  var field = document.getElementById('pick-field');

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var picked = (field && field.value || '').trim();
    var email = (form.email && form.email.value || '').trim();
    // The button is disabled with nothing picked, but a submit can still arrive by keyboard,
    // so the guard is here too rather than only in the disabled attribute.
    if (!picked) return;
    if (!email || email.indexOf('@') < 1) { form.email.focus(); return; }
    if (!window.semitricalSend) { if (err) err.hidden = false; return; }

    if (err) err.hidden = true;
    cta.disabled = true;
    cta.textContent = 'Sending…';

    var n = picked.split(',').length;
    var data = new FormData(form);
    data.append('_subject', 'Semitrical Pro enquiry — ' + n +
                            (n === 1 ? ' supplier' : ' suppliers') + ' — ' + picked);

    window.semitricalSend(data, { source: 'choose-suppliers' })
      .then(function () {
        form.hidden = true;
        if (done) done.hidden = false;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
      .catch(function () {
        if (err) err.hidden = false;
        cta.disabled = false;
        cta.textContent = 'Ask for pricing on these ' + n;
      });
  });
})();
