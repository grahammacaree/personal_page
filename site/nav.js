/** Homepage only — hide nav while the intro sentinel (100lvh) is on screen. */
(function () {
  const nav = document.querySelector(".site-top");
  const sentinel = document.querySelector(".intro-nav-sentinel");
  if (!nav || !sentinel) return;

  let hidden = nav.classList.contains("site-top--hidden");

  const observer = new IntersectionObserver(
    ([entry]) => {
      const nextHidden = entry.isIntersecting;
      if (hidden === nextHidden) return;
      hidden = nextHidden;
      nav.classList.toggle("site-top--hidden", nextHidden);
    },
    { threshold: 0 }
  );

  observer.observe(sentinel);
})();
