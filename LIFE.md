# Endmark terrarium (Conway’s Life)

A shared Game of Life lives inside the essay **endmark** — the little square after the last word on the thesis, stories, and CV.

This is the site’s **emergent** flourish: simple local rules, surprising global behaviour, everyone seeing the same board because it is a pure function of UTC. It pairs with the footer’s Jupiter system ([`JOVIAN.md`](JOVIAN.md)) — clockwork Galilean orbits on the same wall clock, homage to determinate law rather than cellular surprise.

## What you see

- **Collapsed:** a miniature live board (texture, not legible) — cursor `zoom-in`, light hover scale on fine pointers. If `life-state.json` can’t be loaded, a static square instead. Optical offset uses `em` (not `%` of the mark) so mounting the canvas doesn’t nudge baseline.
- **Click:** the square expands into a full-bleed void (FLIP zoom from the endmark); a thin bottom bar fills toward the next 30s generation. Drag / trackpad wheel pans along the crop axis only (Back / ⓘ / notes stay fixed). Back / Escape / backdrop reverse the zoom. Reduced-motion skips the animation. If the page is already pinch-zoomed, open is instant and the dialog is pinned to the visual viewport (so Back / ⓘ stay on-screen).
- **About:** an ⓘ control (top-right; Lucide icon from `assets/`) lazy-loads a bordered popover of Conway Doc copy (`life-about.html`). Escape / void click collapse it first; Back always leaves the universe.

## Sync (no backend)

Everyone sees the same world because it is a pure function of UTC time:

```
n = floor((now - GENESIS) / 30s)
board = evolve(seed, n)  // with quiet-gated meteors
```

Phone and laptop agree; every URL with an endmark agrees. The simulation keeps ticking with nobody watching.

Constants live in [`site/life-engine.mjs`](site/life-engine.mjs):

| Constant | Role |
|----------|------|
| `SIZE` 192 | Torus width/height |
| `TICK_MS` 30000 | One generation per 30s |
| `GENESIS_MS` | Epoch (2026-07-22 UTC) |
| `QUIET_GAP` 720 | Min gap between meteors (~6h) |
| `HARD_CAP` 2880 | Force meteor (~24h) |
| `QUIET_POP` 2304 | “Quiet” if this many live cells or fewer |

Palette: `--text` field, `--bg` cells. Modal is full-bleed `--text`; the board is a square covering the longer viewport side — wide: full width (pan vertically); tall: full height (pan horizontally). Quiet Back control (chevron + label) top-left, matching site nav. Info (Lucide) top-right when the Conway Doc synced.

**Performance:** each site build writes `public/life-state.json` for the current generation — CI resumes from the live file when reachable. Browsers fetch that tip, keep an in-memory cache for the visit, and only step the gap to “now” (≤ ~1 day after a daily deploy). If the published file is missing, the endmark stays a static square. Asset URLs use `data-life-base` from the build. Also: double-buffered steps and quiet checks every `QUIET_GAP`.

**Meteors:** every `QUIET_GAP` generations since the last meteor, if the board looks settled (low population or unchanged vs previous step), XOR a hash-driven scatter of cells. If the world never goes quiet, the hard cap still injects entropy about once a day.

## Files

| Path | Role |
|------|------|
| `site/life-engine.mjs` | Pure engine (also unit-tested) |
| `site/life.js` | Miniature + modal UI (`type="module"`) |
| `scripts/lib/life-state.mjs` | Build-time `life-state.json` |
| `scripts/lib/endmark.mjs` | Emits `<button class="endmark">` |
| `public/life-about.html` | Cleaned Conway Doc fragment (build; fetched on first ⓘ) |
| `assets/icons/info.svg` | Lucide info — injected via `#life-chrome` with the back chevron |
| `templates/document/document.css` | Mini + `.life-lightbox` |

Loaded on home, stories, and CV via `site.config.json` pageType scripts. Conway about copy: manifest slug `conway` → `docTypes.conway.fragment`.
