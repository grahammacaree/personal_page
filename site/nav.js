/** Top bar: pin to visual viewport on mobile; homepage solidifies on scroll. */
(function () {
  const nav = document.querySelector(".site-top");
  if (!nav) return;

  const vv = window.visualViewport;

  function syncTop() {
    if (!vv) return;
    nav.style.top = `${vv.offsetTop}px`;
  }

  if (vv) {
    vv.addEventListener("resize", syncTop);
    vv.addEventListener("scroll", syncTop);
    syncTop();
  }

  if (!document.body.classList.contains("body--home")) return;

  function syncScrolled() {
    nav.classList.toggle("site-top--scrolled", window.scrollY > 0);
  }

  window.addEventListener("scroll", syncScrolled, { passive: true });
  syncScrolled();
})();
