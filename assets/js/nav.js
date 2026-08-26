// Mobile navigation.
//
// The nav links were simply hidden below 720px and nothing replaced them, so a phone had no
// way to reach Markets, Evidence or About at all. This adds the button that opens them.
//
// Deliberately plain: no dependency, no animation library, and it degrades to a visible menu
// if the script never loads — the CSS only collapses the links once this file has run and
// marked the document, so a failed script leaves navigation working rather than gone.
(function () {
  var btn = document.getElementById('nav-toggle');
  var links = document.getElementById('nav-links');
  if (!btn || !links) return;

  document.documentElement.classList.add('has-js-nav');

  function set(open) {
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    links.classList.toggle('is-open', open);
    btn.classList.toggle('is-open', open);
  }

  btn.addEventListener('click', function () {
    set(btn.getAttribute('aria-expanded') !== 'true');
  });

  // Escape closes it, and so does following a link — otherwise the menu stays open behind
  // the next page on browsers that restore scroll position.
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') set(false);
  });
  links.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') set(false);
  });
})();
