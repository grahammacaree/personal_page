/**
 * Jupiter + Galilean moons on the footer rule.
 *
 * Places Io, Europa, Ganymede, and Callisto at their Earth-view positions
 * (Jupiter radii) for the time the page loads. Formulas: Meeus,
 * Astronomical Algorithms, ch.44 (low-accuracy). Docs: JOVIAN.md
 *
 * X = east–west on the hairline; Z = depth (negative = nearer Earth than
 * Jupiter). Moons with Z > 0 sit behind Jupiter; Z < 0 in front.
 */
(function () {
  const J2000 = 2451545.0;
  const D2R = Math.PI / 180;
  /** Callisto ≈ 26.4 Rj — leave margin so discs stay on the hairline. */
  const MAX_R = 27.5;
  const MOONS = ["io", "europa", "ganymede", "callisto"];

  function julianDay(date) {
    return date.getTime() / 86400000 + 2440587.5;
  }

  /**
   * Earth-view X/Z in Jupiter radii (Meeus ch.44), same moon order as MOONS.
   * Z > 0 farther than Jupiter; Z < 0 closer (in front).
   */
  function moonPositions(jde) {
    const d = jde - J2000;
    const V = (172.74 + 0.00111588 * d) * D2R;
    const M = (357.529 + 0.9856003 * d) * D2R;
    const sV = Math.sin(V);
    const N = (20.02 + 0.0830853 * d + 0.329 * sV) * D2R;
    const J = (66.115 + 0.9025179 * d - 0.329 * sV) * D2R;
    const sM = Math.sin(M);
    const cM = Math.cos(M);
    const sN = Math.sin(N);
    const cN = Math.cos(N);
    const s2M = Math.sin(2 * M);
    const c2M = Math.cos(2 * M);
    const s2N = Math.sin(2 * N);
    const c2N = Math.cos(2 * N);
    const A = (1.915 * sM + 0.02 * s2M) * D2R;
    const B = (5.555 * sN + 0.168 * s2N) * D2R;
    const K = J + A - B;
    const R = 1.00014 - 0.01671 * cM - 0.00014 * c2M;
    const r = 5.20872 - 0.25208 * cN - 0.00611 * c2N;
    const sK = Math.sin(K);
    const cK = Math.cos(K);
    const Δ = Math.sqrt(r * r + R * R - 2 * r * R * cK);
    const ψ = Math.asin((R / Δ) * sK);
    const λ = (34.35 + 0.083091 * d + 0.329 * sV) * D2R + B;
    const DS = 3.12 * D2R * Math.sin(λ + 42.8 * D2R);
    const DE =
      DS -
      2.22 * D2R * Math.sin(ψ) * Math.cos(λ + 22 * D2R) -
      1.3 * D2R * ((r - Δ) / Δ) * Math.sin(λ - 100.5 * D2R);
    const dd = d - Δ / 173;
    let u1 = (163.8069 + 203.4058646 * dd) * D2R + ψ - B;
    let u2 = (358.414 + 101.2916335 * dd) * D2R + ψ - B;
    let u3 = (5.7176 + 50.234518 * dd) * D2R + ψ - B;
    let u4 = (224.8092 + 21.48798 * dd) * D2R + ψ - B;
    const G = (331.18 + 50.310482 * dd) * D2R;
    const H = (87.45 + 21.569231 * dd) * D2R;
    const s212 = Math.sin(2 * (u1 - u2));
    const c212 = Math.cos(2 * (u1 - u2));
    const s223 = Math.sin(2 * (u2 - u3));
    const c223 = Math.cos(2 * (u2 - u3));
    const sG = Math.sin(G);
    const cG = Math.cos(G);
    const sH = Math.sin(H);
    const cH = Math.cos(H);
    u1 += 0.473 * D2R * s212;
    u2 += 1.065 * D2R * s223;
    u3 += 0.165 * D2R * sG;
    u4 += 0.843 * D2R * sH;
    const r1 = 5.9057 - 0.0244 * c212;
    const r2 = 9.3966 - 0.0882 * c223;
    const r3 = 14.9883 - 0.0216 * cG;
    const r4 = 26.3627 - 0.1939 * cH;
    const cDE = Math.cos(DE);

    function xz(u, rr) {
      return {
        x: rr * Math.sin(u),
        z: -rr * Math.cos(u) * cDE,
      };
    }

    return [xz(u1, r1), xz(u2, r2), xz(u3, r3), xz(u4, r4)];
  }

  function placeMoons(group, items, midY) {
    group.replaceChildren();
    for (const item of items) {
      item.el.setAttribute("cx", String(item.cx));
      item.el.setAttribute("cy", String(midY));
      item.el.removeAttribute("visibility");
      group.appendChild(item.el);
    }
  }

  function boot(footer) {
    const svg = footer.querySelector(".site-footer-jovian");
    if (!svg) return;

    const orbit = svg.querySelector(".site-footer-jovian-orbit");
    const back = svg.querySelector(".site-footer-jovian-back");
    const jupiter = svg.querySelector(".site-footer-jovian-jupiter");
    const front = svg.querySelector(".site-footer-jovian-front");
    const moons = MOONS.map((name) =>
      svg.querySelector(`.site-footer-jovian-moon[data-moon="${name}"]`)
    );
    if (!orbit || !back || !front || !jupiter || moons.some((el) => !el)) return;

    function draw() {
      const width = footer.getBoundingClientRect().width || footer.clientWidth || 0;
      if (width < 32) return;
      const h = 14;
      const midY = h / 2;
      const centre = width / 2;
      const scale = (width * 0.46) / MAX_R;
      const positions = moonPositions(julianDay(new Date()));

      svg.setAttribute("viewBox", `0 0 ${width} ${h}`);
      svg.setAttribute("width", String(width));
      svg.setAttribute("height", String(h));
      orbit.setAttribute("x1", "0");
      orbit.setAttribute("x2", String(width));
      orbit.setAttribute("y1", String(midY));
      orbit.setAttribute("y2", String(midY));
      jupiter.setAttribute("cx", String(centre));
      jupiter.setAttribute("cy", String(midY));

      const behind = [];
      const inFront = [];
      for (let i = 0; i < MOONS.length; i += 1) {
        const item = {
          el: moons[i],
          z: positions[i].z,
          cx: centre + positions[i].x * scale,
        };
        if (item.z > 0) behind.push(item);
        else inFront.push(item);
      }

      behind.sort((a, b) => b.z - a.z);
      inFront.sort((a, b) => a.z - b.z);

      placeMoons(back, behind, midY);
      placeMoons(front, inFront, midY);
    }

    draw();
    window.addEventListener("resize", draw, { passive: true });
  }

  function init() {
    document.querySelectorAll(".site-footer").forEach(boot);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
