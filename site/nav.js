/** Top bar: pin to visual viewport on mobile (iOS URL-bar shift). */
(function () {
  const nav = document.querySelector(".site-top");
  if (!nav) return;

  const vv = window.visualViewport;
  if (!vv) return;

  function syncTop() {
    nav.style.top = `${vv.offsetTop}px`;
  }

  vv.addEventListener("resize", syncTop);
  vv.addEventListener("scroll", syncTop);
  syncTop();
})();
