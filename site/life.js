/**
 * Endmark terrarium — miniature Life + zoom-into-universe modal.
 * Shared wall-clock state via ./life-engine.mjs — see LIFE.md
 */
import {
  GENESIS_MS,
  SIZE,
  TICK_MS,
  boardAtGenerationAsync,
  commitState,
  generationAt,
  parseLifeState,
  startStateFor,
} from "./life-engine.mjs";

const MINI_CSS_PX = 11;
/** Terrarium palette: --text void, --bg life (resolved from CSS at paint time) */
function terrariumColors() {
  const styles = getComputedStyle(document.documentElement);
  return {
    bg: cssColorToRgb(styles.getPropertyValue("--text"), [26, 26, 26]),
    fg: cssColorToRgb(styles.getPropertyValue("--bg"), [250, 245, 244]),
  };
}

function cssColorToRgb(value, fallback) {
  const hex = String(value).trim();
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
    return [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ];
  }
  return fallback;
}
const ZOOM_MS = 720;
/** Open: ease-in — linger on the mark, then accelerate into the void. */
const ZOOM_EASE_IN = "cubic-bezier(0.64, 0, 0.78, 0)";
/** Close: ease-out — leave fast, settle into the mark. */
const ZOOM_EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Site-rooted asset URL from the life.js script’s data-life-base
 * (set at build time — stable if the module URL ever moves).
 */
function lifeAssetUrl(file) {
  const script = document.querySelector("script[data-life-base]");
  const base = script?.getAttribute("data-life-base") || "/";
  return new URL(file, new URL(base, document.baseURI)).href;
}

/** Offscreen 1:1 board buffer — paint once, scale with nearest-neighbor. */
const pixelCanvas = document.createElement("canvas");
pixelCanvas.width = SIZE;
pixelCanvas.height = SIZE;
const pixelCtx = pixelCanvas.getContext("2d");
const imageData = pixelCtx.createImageData(SIZE, SIZE);

function blitBoard(board) {
  const d = imageData.data;
  const { bg, fg } = terrariumColors();
  const [fr, fgC, fb] = fg;
  const [br, bgC, bb] = bg;
  for (let i = 0; i < board.length; i += 1) {
    const o = i << 2;
    const live = board[i];
    d[o] = live ? fr : br;
    d[o + 1] = live ? fgC : bgC;
    d[o + 2] = live ? fb : bb;
    d[o + 3] = 255;
  }
  pixelCtx.putImageData(imageData, 0, 0);
}

function paint(canvas, cellPx) {
  const w = SIZE * cellPx;
  const h = SIZE * cellPx;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(pixelCanvas, 0, 0, w, h);
}

function coverMetrics() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const side = Math.max(vw, vh);
  const cell = Math.max(1, Math.ceil(side / SIZE));
  const px = SIZE * cell;
  return { vw, vh, cell, px };
}

/** Canvas sits at viewport center; FLIP from the endmark’s screen rect. */
function transformFromRect(rect, px, vw, vh) {
  const fromCx = rect.left + rect.width / 2;
  const fromCy = rect.top + rect.height / 2;
  const dx = fromCx - vw / 2;
  const dy = fromCy - vh / 2;
  const scale = Math.max(rect.width / px, 0.001);
  return `translate(${dx}px, ${dy}px) translate(-50%, -50%) scale(${scale})`;
}

const TRANSFORM_SETTLED = "translate(-50%, -50%) scale(1)";

function ensureModal() {
  let dialog = document.querySelector(".life-lightbox");
  if (dialog) return dialog;

  dialog = document.createElement("dialog");
  dialog.className = "life-lightbox";
  dialog.innerHTML = `
    <button type="button" class="life-lightbox-close" aria-label="Close">Close</button>
    <canvas class="life-lightbox-canvas" aria-label="Game of Life universe"></canvas>
  `;
  document.body.appendChild(dialog);
  return dialog;
}

function msUntilNextTick(now = Date.now()) {
  const elapsed = Math.max(0, now - GENESIS_MS);
  const rem = elapsed % TICK_MS;
  return rem === 0 ? TICK_MS : TICK_MS - rem;
}

function runZoom(el, from, to, easing) {
  el.style.transform = from;
  // Force layout so the first keyframe isn’t skipped.
  el.getBoundingClientRect();
  const anim = el.animate([{ transform: from }, { transform: to }], {
    duration: ZOOM_MS,
    easing,
    fill: "forwards",
  });
  return anim.finished.then(() => {
    el.style.transform = to;
    anim.cancel();
  });
}

/** Daily-deployed checkpoint — resume candidate for startStateFor. */
async function fetchPublishedLifeState() {
  try {
    const res = await fetch(lifeAssetUrl("life-state.json"), {
      cache: "no-cache",
    });
    if (!res.ok) return null;
    return parseLifeState(await res.json());
  } catch {
    return null;
  }
}

/** No published tip — leave a static punctuation square. */
function degradeEndmarks(marks) {
  for (const btn of marks) {
    btn.disabled = true;
    btn.classList.add("endmark--inert");
    btn.setAttribute("aria-hidden", "true");
    btn.removeAttribute("aria-label");
    btn.replaceChildren();
  }
}

/** Adopt published tip, then async-step any gap to target. */
function boardAtGenerationFromTip(target, published) {
  const from = startStateFor(target, published ? [published] : []);
  if (from.n === target) return Promise.resolve(commitState(from));
  return boardAtGenerationAsync(target);
}

async function boot() {
  const marks = document.querySelectorAll("button.endmark");
  if (!marks.length) return;

  // Require the build artifact — never cold-start the timeline in-browser.
  const published = await fetchPublishedLifeState();
  if (!published) {
    degradeEndmarks(marks);
    return;
  }

  const dialog = ensureModal();
  const modalCanvas = dialog.querySelector(".life-lightbox-canvas");
  const closeBtn = dialog.querySelector(".life-lightbox-close");
  const minis = [];

  marks.forEach((btn) => {
    btn.replaceChildren();
    const canvas = document.createElement("canvas");
    canvas.className = "endmark-life";
    canvas.setAttribute("aria-hidden", "true");
    btn.appendChild(canvas);
    minis.push(canvas);
  });

  let board = null;
  let boardGen = -1;
  let ready = null;
  let sourceBtn = null;
  let busy = false;

  function renderMinis() {
    if (!board) return;
    for (const canvas of minis) {
      paint(canvas, 1);
      canvas.style.width = `${MINI_CSS_PX}px`;
      canvas.style.height = `${MINI_CSS_PX}px`;
      canvas.style.imageRendering = "pixelated";
    }
  }

  function layoutModalCanvas() {
    if (!board) return null;
    const metrics = coverMetrics();
    paint(modalCanvas, metrics.cell);
    modalCanvas.style.width = `${metrics.px}px`;
    modalCanvas.style.height = `${metrics.px}px`;
    return metrics;
  }

  function renderModal() {
    if (!dialog.open || !board || busy) return;
    layoutModalCanvas();
    modalCanvas.style.transform = TRANSFORM_SETTLED;
  }

  async function ensureBoard() {
    const n = generationAt();
    if (board && boardGen === n) return board;
    if (ready) {
      await ready;
      if (board && boardGen === generationAt()) return board;
    }

    const target = generationAt();
    ready = boardAtGenerationFromTip(target, published).then((b) => {
      board = b;
      boardGen = target;
      blitBoard(board);
      ready = null;
      return board;
    });
    return ready;
  }

  async function refresh() {
    await ensureBoard();
    renderMinis();
    renderModal();
  }

  async function openFrom(btn) {
    if (dialog.open || busy) return;
    busy = true;
    sourceBtn = btn;

    await ensureBoard();
    renderMinis();

    const fromRect = btn.getBoundingClientRect();
    btn.classList.add("is-zoomed-away");

    const metrics = layoutModalCanvas();
    if (!metrics) {
      btn.classList.remove("is-zoomed-away");
      busy = false;
      return;
    }

    if (prefersReducedMotion()) {
      modalCanvas.style.transform = TRANSFORM_SETTLED;
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
      dialog.classList.add("is-settled");
      busy = false;
      closeBtn?.focus();
      return;
    }

    // Place the canvas on the endmark *before* the dialog paints, so we never
    // flash a full-bleed black frame.
    const start = transformFromRect(fromRect, metrics.px, metrics.vw, metrics.vh);
    dialog.classList.remove("is-settled");
    modalCanvas.style.transform = start;

    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");

    try {
      await runZoom(modalCanvas, start, TRANSFORM_SETTLED, ZOOM_EASE_IN);
    } catch {
      modalCanvas.style.transform = TRANSFORM_SETTLED;
    }

    dialog.classList.add("is-settled");
    busy = false;
    closeBtn?.focus();
  }

  async function closeToSource() {
    if (!dialog.open || busy) return;
    busy = true;

    const btn = sourceBtn;
    const fromRect = btn?.getBoundingClientRect();

    // Drop the void behind the canvas first so the page can reappear around
    // the shrinking square (same path as zoom-in, reversed).
    dialog.classList.remove("is-settled");

    if (prefersReducedMotion() || !fromRect || fromRect.width < 1) {
      dialog.close();
      btn?.classList.remove("is-zoomed-away");
      sourceBtn = null;
      busy = false;
      return;
    }

    const metrics = layoutModalCanvas() || coverMetrics();
    const end = transformFromRect(fromRect, metrics.px, metrics.vw, metrics.vh);

    try {
      await runZoom(modalCanvas, TRANSFORM_SETTLED, end, ZOOM_EASE_OUT);
    } catch {
      /* aborted */
    }

    dialog.close();
    btn?.classList.remove("is-zoomed-away");
    sourceBtn = null;
    busy = false;
  }

  refresh();

  marks.forEach((btn) => {
    btn.addEventListener("click", () => {
      openFrom(btn);
    });
  });

  closeBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    closeToSource();
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeToSource();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !dialog.open) return;
    event.preventDefault();
    closeToSource();
  });
  // Prevent native dialog close from skipping the zoom-out.
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeToSource();
  });

  window.addEventListener("resize", () => {
    if (dialog.open) renderModal();
  });

  if (!prefersReducedMotion()) {
    const tick = async () => {
      await refresh();
      window.setTimeout(tick, msUntilNextTick() + 20);
    };
    window.setTimeout(tick, msUntilNextTick() + 20);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
