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

function coverMetrics(size) {
  const vw = size?.width ?? window.innerWidth;
  const vh = size?.height ?? window.innerHeight;
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

function settledCanvasTransform(panX = 0, panY = 0) {
  return `translate(-50%, -50%) translate(${panX}px, ${panY}px) scale(1)`;
}

/** SVG markup from the build-injected `#life-chrome` template (assets/). */
function lifeIcon(name) {
  const node = document
    .getElementById("life-chrome")
    ?.content?.querySelector(`[data-life-icon="${name}"]`);
  return node?.innerHTML?.trim() ?? "";
}

function ensureModal() {
  let dialog = document.querySelector(".life-lightbox");
  if (dialog) return dialog;

  dialog = document.createElement("dialog");
  dialog.className = "life-lightbox";
  dialog.innerHTML = `
    <button type="button" class="life-lightbox-close" aria-label="Back">
      ${lifeIcon("back")}
      <span>Back</span>
    </button>
    <button
      type="button"
      class="life-lightbox-info"
      aria-label="About this universe"
      aria-expanded="false"
      aria-controls="life-lightbox-about"
      hidden
    >
      ${lifeIcon("info")}
    </button>
    <canvas class="life-lightbox-canvas" aria-hidden="true"></canvas>
    <aside
      id="life-lightbox-about"
      class="life-lightbox-about"
      aria-label="Notes"
      tabindex="-1"
      hidden
    >
      <div class="life-lightbox-about-inner"></div>
    </aside>
    <div class="life-lightbox-progress" aria-hidden="true">
      <div class="life-lightbox-progress-fill"></div>
    </div>
  `;
  document.body.appendChild(dialog);
  return dialog;
}

function msUntilNextTick(now = Date.now()) {
  const elapsed = Math.max(0, now - GENESIS_MS);
  const rem = elapsed % TICK_MS;
  return rem === 0 ? TICK_MS : TICK_MS - rem;
}

/** 0–1 progress through the current generation interval. */
function tickProgress(now = Date.now()) {
  if (now <= GENESIS_MS) return 0;
  return ((now - GENESIS_MS) % TICK_MS) / TICK_MS;
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

/** Synced Conway Doc fragment — about copy for the expanded terrarium. */
async function fetchLifeAboutHtml() {
  try {
    const res = await fetch(lifeAssetUrl("life-about.html"), {
      cache: "no-cache",
    });
    if (!res.ok) return "";
    return (await res.text()).trim();
  } catch {
    return "";
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

  // Mount canvases before the network round-trip so the mark isn’t an empty
  // inline-block on first paint (WebKit baseline / used-box quirks).
  const minis = [];
  marks.forEach((btn) => {
    btn.replaceChildren();
    const canvas = document.createElement("canvas");
    canvas.className = "endmark-life";
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.imageRendering = "pixelated";
    btn.appendChild(canvas);
    minis.push(canvas);
  });

  // Require the build artifact — never cold-start the timeline in-browser.
  const published = await fetchPublishedLifeState();
  if (!published) {
    degradeEndmarks(marks);
    return;
  }

  const dialog = ensureModal();
  const modalCanvas = dialog.querySelector(".life-lightbox-canvas");
  const closeBtn = dialog.querySelector(".life-lightbox-close");
  const infoBtn = dialog.querySelector(".life-lightbox-info");
  const aboutEl = dialog.querySelector(".life-lightbox-about");
  const aboutInner = dialog.querySelector(".life-lightbox-about-inner");
  const progressEl = dialog.querySelector(".life-lightbox-progress");
  const progressFill = dialog.querySelector(".life-lightbox-progress-fill");

  // Info control is available once chrome icons exist; about HTML loads on demand.
  const canShowInfo = Boolean(infoBtn && aboutEl && aboutInner && lifeIcon("info"));
  if (canShowInfo) {
    infoBtn.hidden = false;
    aboutEl.hidden = false;
    aboutEl.setAttribute("inert", "");
  }

  let aboutHtml = null;
  let aboutLoad = null;

  function loadAboutHtml() {
    if (aboutHtml !== null) return Promise.resolve(aboutHtml);
    if (aboutLoad) return aboutLoad;
    aboutLoad = fetchLifeAboutHtml().then((html) => {
      aboutHtml = html;
      aboutLoad = null;
      if (!html && infoBtn) {
        infoBtn.hidden = true;
        aboutEl.hidden = true;
      }
      return html;
    });
    return aboutLoad;
  }

  let board = null;
  let boardGen = -1;
  let ready = null;
  let sourceBtn = null;
  let busy = false;
  let aboutOpen = false;
  let progressRaf = 0;
  let scrollLockY = 0;
  /** Pan of the cover board (CSS px); chrome stays fixed. */
  let panX = 0;
  let panY = 0;
  /** @type {{ id: number, x: number, y: number, originX: number, originY: number, moved: boolean } | null} */
  let panDrag = null;

  function syncAboutScrollable() {
    if (!aboutEl || !aboutInner) return;
    // Measure with overflow hidden so scrollHeight is the content size.
    aboutEl.classList.remove("is-scrollable");
    const overflows = aboutInner.scrollHeight > aboutInner.clientHeight + 1;
    aboutEl.classList.toggle("is-scrollable", overflows);
  }

  function setAboutChromeInert(open) {
    // While notes are open, only ⓘ + the panel stay in the tab order.
    closeBtn?.toggleAttribute("inert", open);
    modalCanvas?.toggleAttribute("inert", open);
    progressEl?.toggleAttribute("inert", open);
  }

  function setAboutOpen(open) {
    aboutOpen = open;
    dialog.classList.toggle("is-about-open", open);
    infoBtn?.setAttribute("aria-expanded", open ? "true" : "false");
    setAboutChromeInert(open);
    if (aboutEl) {
      if (open) {
        aboutEl.removeAttribute("inert");
        // After paint so max-height / visibility apply before measuring.
        requestAnimationFrame(() => {
          syncAboutScrollable();
          const focusTarget =
            aboutInner.querySelector("a[href], button") || aboutEl;
          focusTarget.focus?.();
        });
      } else {
        aboutEl.setAttribute("inert", "");
        aboutEl.classList.remove("is-scrollable");
      }
    }
  }

  function closeAbout() {
    if (!aboutOpen) return false;
    setAboutOpen(false);
    infoBtn?.focus();
    return true;
  }

  async function toggleAbout() {
    if (!canShowInfo) return;
    if (aboutOpen) {
      closeAbout();
      return;
    }
    const html = await loadAboutHtml();
    if (!html) return;
    if (!aboutInner.dataset.ready) {
      aboutInner.innerHTML = html;
      aboutInner.dataset.ready = "1";
    }
    setAboutOpen(true);
  }

  function lockBodyScroll() {
    scrollLockY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollLockY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
  }

  function unlockBodyScroll() {
    const y = scrollLockY;
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    // Defer scroll restore so iOS applies the unlocked layout first.
    requestAnimationFrame(() => {
      window.scrollTo(0, y);
    });
  }

  /** True when the page itself is pinch-zoomed (not just browser chrome). */
  function pagePinchZoomed() {
    const scale = window.visualViewport?.scale ?? 1;
    return scale > 1.02 || scale < 0.98;
  }

  /**
   * Keep the dialog on the *visual* viewport. After pinch-zoom, layout-viewport
   * fullscreen leaves Back / ⓘ off-screen; counter-scale restores usable chrome.
   */
  function pinDialogToVisualViewport() {
    if (!dialog.open) {
      unpinDialogFromVisualViewport();
      return;
    }
    const vv = window.visualViewport;
    const scale = vv?.scale || 1;
    const width = vv ? vv.width * scale : window.innerWidth;
    const height = vv ? vv.height * scale : window.innerHeight;
    const left = vv?.offsetLeft ?? 0;
    const top = vv?.offsetTop ?? 0;

    dialog.style.inset = "auto";
    dialog.style.left = "0";
    dialog.style.top = "0";
    dialog.style.right = "auto";
    dialog.style.bottom = "auto";
    dialog.style.margin = "0";
    dialog.style.width = `${width}px`;
    dialog.style.height = `${height}px`;
    dialog.style.maxWidth = "none";
    dialog.style.maxHeight = "none";
    dialog.style.transformOrigin = "0 0";
    dialog.style.transform = `translate(${left}px, ${top}px) scale(${1 / scale})`;
  }

  function unpinDialogFromVisualViewport() {
    dialog.style.inset = "";
    dialog.style.left = "";
    dialog.style.top = "";
    dialog.style.right = "";
    dialog.style.bottom = "";
    dialog.style.margin = "";
    dialog.style.width = "";
    dialog.style.height = "";
    dialog.style.maxWidth = "";
    dialog.style.maxHeight = "";
    dialog.style.transform = "";
    dialog.style.transformOrigin = "";
  }

  function modalViewportSize() {
    if (dialog.open && dialog.clientWidth > 0 && dialog.clientHeight > 0) {
      return { width: dialog.clientWidth, height: dialog.clientHeight };
    }
    return { width: window.innerWidth, height: window.innerHeight };
  }

  function syncProgress() {
    if (!progressFill) return;
    progressFill.style.transform = `scaleX(${tickProgress()})`;
  }

  function startProgressLoop() {
    stopProgressLoop();
    const frame = () => {
      if (!dialog.open) {
        progressRaf = 0;
        return;
      }
      syncProgress();
      progressRaf = requestAnimationFrame(frame);
    };
    syncProgress();
    progressRaf = requestAnimationFrame(frame);
  }

  function stopProgressLoop() {
    if (progressRaf) {
      cancelAnimationFrame(progressRaf);
      progressRaf = 0;
    }
  }

  function renderMinis() {
    if (!board) return;
    for (const canvas of minis) {
      paint(canvas, 1);
    }
  }

  function revealEndmark(btn) {
    if (!btn) return;
    btn.classList.remove("is-zoomed-away");
    // Drop sticky :hover / focus from the opening tap (esp. iOS).
    btn.blur();
  }

  function layoutModalCanvas() {
    if (!board) return null;
    const metrics = coverMetrics(modalViewportSize());
    paint(modalCanvas, metrics.cell);
    modalCanvas.style.width = `${metrics.px}px`;
    modalCanvas.style.height = `${metrics.px}px`;
    return metrics;
  }

  function panLimits(metrics) {
    const m = metrics || coverMetrics(modalViewportSize());
    return {
      maxX: Math.max(0, (m.px - m.vw) / 2),
      maxY: Math.max(0, (m.px - m.vh) / 2),
    };
  }

  function clampPan(x, y, metrics) {
    const { maxX, maxY } = panLimits(metrics);
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  }

  function applySettledCanvasTransform() {
    modalCanvas.style.transform = settledCanvasTransform(panX, panY);
  }

  function resetPan() {
    panX = 0;
    panY = 0;
    panDrag = null;
    modalCanvas.classList.remove("is-panning");
  }

  function renderModal() {
    if (!dialog.open || !board || busy) return;
    const metrics = layoutModalCanvas();
    if (!metrics) return;
    const clamped = clampPan(panX, panY, metrics);
    panX = clamped.x;
    panY = clamped.y;
    applySettledCanvasTransform();
  }

  function onVisualViewportChange() {
    if (!dialog.open) return;
    pinDialogToVisualViewport();
    if (!busy) renderModal();
    if (aboutOpen) syncAboutScrollable();
  }

  /** clientΔ → dialog-local px when the dialog is counter-scaled for pinch-zoom. */
  function clientDeltaToDialog(dx, dy) {
    const scale = window.visualViewport?.scale || 1;
    return { dx: dx * scale, dy: dy * scale };
  }

  function onCanvasPointerDown(event) {
    if (busy || !dialog.open || !dialog.classList.contains("is-settled")) return;
    if (event.button !== 0) return;
    panDrag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      originX: panX,
      originY: panY,
      moved: false,
    };
    modalCanvas.setPointerCapture(event.pointerId);
  }

  function onCanvasPointerMove(event) {
    if (!panDrag || event.pointerId !== panDrag.id) return;
    const rawDx = event.clientX - panDrag.x;
    const rawDy = event.clientY - panDrag.y;
    if (!panDrag.moved && rawDx * rawDx + rawDy * rawDy > 36) {
      panDrag.moved = true;
      modalCanvas.classList.add("is-panning");
    }
    if (!panDrag.moved) return;
    const { dx, dy } = clientDeltaToDialog(rawDx, rawDy);
    const next = clampPan(panDrag.originX + dx, panDrag.originY + dy);
    panX = next.x;
    panY = next.y;
    applySettledCanvasTransform();
  }

  function onCanvasPointerUp(event) {
    if (!panDrag || event.pointerId !== panDrag.id) return;
    const moved = panDrag.moved;
    panDrag = null;
    modalCanvas.classList.remove("is-panning");
    try {
      modalCanvas.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
    if (!moved && aboutOpen) closeAbout();
  }

  function onCanvasWheel(event) {
    if (!dialog.open || busy || !dialog.classList.contains("is-settled")) return;
    if (aboutOpen) return;
    event.preventDefault();
    const { dx, dy } = clientDeltaToDialog(-event.deltaX, -event.deltaY);
    const next = clampPan(panX + dx, panY + dy);
    panX = next.x;
    panY = next.y;
    applySettledCanvasTransform();
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
    setAboutOpen(false);
    resetPan();

    await ensureBoard();
    renderMinis();

    const fromRect = btn.getBoundingClientRect();
    btn.classList.add("is-zoomed-away");

    // Instant open when motion is reduced or the page is already pinch-zoomed
    // (FLIP + layout-viewport geometry fights the visual viewport).
    const skipFlip = prefersReducedMotion() || pagePinchZoomed();

    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    lockBodyScroll();
    pinDialogToVisualViewport();

    const metrics = layoutModalCanvas();
    if (!metrics) {
      dialog.close();
      unpinDialogFromVisualViewport();
      unlockBodyScroll();
      revealEndmark(btn);
      sourceBtn = null;
      busy = false;
      return;
    }

    if (skipFlip) {
      applySettledCanvasTransform();
      dialog.classList.add("is-settled");
      busy = false;
      startProgressLoop();
      closeBtn?.focus();
      return;
    }

    // Place the canvas on the endmark *before* paint settles, so we never
    // flash a full-bleed black frame.
    const start = transformFromRect(fromRect, metrics.px, metrics.vw, metrics.vh);
    dialog.classList.remove("is-settled");
    modalCanvas.style.transform = start;

    try {
      await runZoom(modalCanvas, start, settledCanvasTransform(), ZOOM_EASE_IN);
    } catch {
      applySettledCanvasTransform();
    }

    dialog.classList.add("is-settled");
    busy = false;
    startProgressLoop();
    closeBtn?.focus();
  }

  async function closeToSource() {
    if (!dialog.open || busy) return;
    closeAbout();
    busy = true;
    stopProgressLoop();

    const btn = sourceBtn;
    const fromRect = btn?.getBoundingClientRect();
    const skipFlip =
      prefersReducedMotion() || pagePinchZoomed() || !fromRect || fromRect.width < 1;
    const fromPan = settledCanvasTransform(panX, panY);

    // Drop the void behind the canvas first so the page can reappear around
    // the shrinking square (same path as zoom-in, reversed).
    dialog.classList.remove("is-settled");

    if (skipFlip) {
      dialog.close();
      resetPan();
      unpinDialogFromVisualViewport();
      unlockBodyScroll();
      revealEndmark(btn);
      sourceBtn = null;
      busy = false;
      return;
    }

    const metrics = layoutModalCanvas() || coverMetrics(modalViewportSize());
    const end = transformFromRect(fromRect, metrics.px, metrics.vw, metrics.vh);

    try {
      await runZoom(modalCanvas, fromPan, end, ZOOM_EASE_OUT);
    } catch {
      /* aborted */
    }

    dialog.close();
    resetPan();
    unpinDialogFromVisualViewport();
    unlockBodyScroll();
    revealEndmark(btn);
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
  infoBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleAbout();
  });
  aboutEl?.addEventListener("click", (event) => {
    event.stopPropagation();
  });
  modalCanvas.addEventListener("pointerdown", onCanvasPointerDown);
  modalCanvas.addEventListener("pointermove", onCanvasPointerMove);
  modalCanvas.addEventListener("pointerup", onCanvasPointerUp);
  modalCanvas.addEventListener("pointercancel", onCanvasPointerUp);
  modalCanvas.addEventListener("wheel", onCanvasWheel, { passive: false });
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    if (closeAbout()) return;
    closeToSource();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !dialog.open) return;
    event.preventDefault();
    if (closeAbout()) return;
    closeToSource();
  });
  // Prevent native dialog close from skipping the zoom-out.
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    if (closeAbout()) return;
    closeToSource();
  });

  window.addEventListener("resize", onVisualViewportChange);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", onVisualViewportChange);
    window.visualViewport.addEventListener("scroll", onVisualViewportChange);
  }

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
