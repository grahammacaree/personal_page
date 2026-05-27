/** Top bar: pin to visual viewport on mobile; homepage hides until intro scrolls. */
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

  const sentinel = document.querySelector(".intro-nav-sentinel");
  if (!sentinel) return;

  let hidden = nav.classList.contains("site-top--hidden");

  function setHidden(nextHidden) {
    hidden = nextHidden;
    nav.classList.toggle("site-top--hidden", nextHidden);
    if (nextHidden) {
      nav.setAttribute("inert", "");
    } else {
      nav.removeAttribute("inert");
    }
  }

  const observer = new IntersectionObserver(
    ([entry]) => {
      const nextHidden = entry.isIntersecting;
      if (hidden === nextHidden) return;
      setHidden(nextHidden);
    },
    { threshold: 0 }
  );

  observer.observe(sentinel);
})();
