/** Homepage only — hide nav while intro copy (`.intro-nav-sentinel`) is on screen. */
(function () {
  const nav = document.querySelector(".site-top");
  const sentinel = document.querySelector(".intro-nav-sentinel");
  if (!nav || !sentinel) return;

  const observer = new IntersectionObserver(
    ([entry]) => {
      nav.classList.toggle("site-top--hidden", entry.isIntersecting);
    },
    { threshold: 0 }
  );

  observer.observe(sentinel);
})();
