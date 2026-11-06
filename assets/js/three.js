// "Name your three suppliers." The one ask, and the page it lands on.
//
// Posts through window.semitricalSend like every other form here, tagged
// source=three-suppliers so these are tellable apart in the inbox from a general enquiry or a
// PDF request. The subject carries the supplier names, because which three they named is the
// whole content of the lead -- an inbox full of "Semitrical enquiry" tells you nothing.
(function () {
  'use strict';

  var form = document.getElementById('three-form');
  if (!form) return;

  var cta = document.getElementById('three-cta');
  var err = document.getElementById('three-err');
  var done = document.getElementById('three-done');
  var label = cta ? cta.textContent : 'Send me the read';

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (err) err.hidden = true;

    var names = ['supplier_1', 'supplier_2', 'supplier_3']
      .map(function (n) { return (form[n] && form[n].value || '').trim(); })
      .filter(Boolean);
    var email = (form.email.value || '').trim();

    // One supplier is a real answer; the page asks for three because that is the shape of a
    // buying position, not because fewer is invalid.
    if (!names.length) { form.supplier_1.focus(); return; }
    if (email.indexOf('@') < 1) { form.email.focus(); return; }
    if (!window.semitricalSend) { if (err) err.hidden = false; return; }

    cta.disabled = true;
    cta.textContent = 'Sending…';

    var data = new FormData(form);
    data.append('suppliers', names.join(', '));
    data.append('_subject', 'Three suppliers — ' + names.join(', '));

    window.semitricalSend(data, { source: 'three-suppliers' })
      .then(function () {
        form.hidden = true;
        if (done) done.hidden = false;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
      .catch(function () {
        if (err) err.hidden = false;
        cta.disabled = false;
        cta.textContent = label;
      });
  });
})();
