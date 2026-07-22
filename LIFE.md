# Endmark terrarium (Conway’s Life)

A shared Game of Life lives inside the essay **endmark** — the little square after the last word on the thesis, stories, and CV.

## What you see

- **Collapsed:** a miniature live board (texture, not legible) — cursor `zoom-in`, light hover scale. If `life-state.json` can’t be loaded and there’s no local resume, a static square instead.
- **Click:** the square expands into a full-bleed void (FLIP zoom from the endmark); Close / Escape / backdrop reverse the zoom. Reduced-motion skips the animation.

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

Palette: black field, off-white cells (`--bg` / `#faf5f4`). Modal is full-bleed black; the board is a centered square that **covers** the viewport (edges may crop). Quiet Close control in the corner.

**Performance:** each site build writes `public/life-state.json` for the current generation — CI resumes from the live file when reachable, so a year of history stays cheap. Browsers fetch that checkpoint and pass it into one resume picker (`startStateFor`) with memory + `localStorage`; highest generation wins, then only the gap to “now” is stepped (≤ ~1 day after a daily deploy). If the published file is missing and there’s no local resume, the endmark stays a static square (no Life, not clickable) — the page never cold-starts the full timeline in-browser. Asset URLs use `data-life-base` from the build. Also: double-buffered steps, quiet checks every `QUIET_GAP`, and a Web Worker for any remaining catch-up.

**Meteors:** every `QUIET_GAP` generations since the last meteor, if the board looks settled (low population or unchanged vs previous step), XOR a hash-driven scatter of cells. If the world never goes quiet, the hard cap still injects entropy about once a day.

## Files

| Path | Role |
|------|------|
| `site/life-engine.mjs` | Pure engine (also unit-tested) |
| `site/life-worker.mjs` | Off-main-thread catch-up |
| `site/life.js` | Miniature + modal UI (`type="module"`) |
| `scripts/lib/life-state.mjs` | Build-time `life-state.json` |
| `scripts/lib/endmark.mjs` | Emits `<button class="endmark">` |
| `templates/document/document.css` | Mini + `.life-lightbox` |

Loaded on home, stories, and CV via `site.config.json` pageType scripts.
