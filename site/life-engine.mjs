/**
 * Deterministic Conway Life for the endmark terrarium.
 *
 * Shared across all visitors/URLs via wall clock:
 *   n = floor((Date.now() - GENESIS_MS) / TICK_MS)
 * Quiet-gated meteors keep entropy without a fixed drumbeat.
 */

export const SIZE = 192;
export const TICK_MS = 30_000;
/** Genesis: 2026-07-22T00:00:00.000Z — terrarium epoch */
export const GENESIS_MS = Date.UTC(2026, 6, 22, 0, 0, 0);
/** Generations between quiet-checks / meteors (~6h at 30s) */
export const QUIET_GAP = 720;
/** Force a meteor even if never “quiet” (~24h) */
export const HARD_CAP = 2880;
/** Live cells at or below this ⇒ quiet (≲6% of 192²) */
export const QUIET_POP = 2304;
/** Cells flipped by a meteor */
export const METEOR_CELLS = 1728;
/** Persist a resume point this often during long catch-up */
export const CHECKPOINT_EVERY = 2048;

const CHECKPOINT_KEY = `life-cp:v2:${SIZE}:${GENESIS_MS}`;
const CELLS = SIZE * SIZE;

/** In-memory: { n, board, lastMeteor } */
let cache = null;

export function generationAt(nowMs = Date.now()) {
  if (nowMs < GENESIS_MS) return 0;
  return Math.floor((nowMs - GENESIS_MS) / TICK_MS);
}

/** Mulberry32 — deterministic PRNG from a 32-bit seed */
export function mulberry32(seed) {
  let t = seed >>> 0;
  return function next() {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash32(n) {
  let x = (n >>> 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
}

export function emptyBoard() {
  return new Uint8Array(CELLS);
}

export function seedBoard(seed = 0xc0ffee) {
  const rand = mulberry32(seed);
  const board = emptyBoard();
  for (let i = 0; i < board.length; i += 1) {
    board[i] = rand() < 0.28 ? 1 : 0;
  }
  return board;
}

export function population(board) {
  let n = 0;
  for (let i = 0; i < board.length; i += 1) n += board[i];
  return n;
}

export function boardsEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * One B3/S23 step on a torus.
 * Writes into `out` (allocates if omitted) and returns it — callers can
 * double-buffer to avoid per-generation allocation.
 */
export function step(board, out = emptyBoard()) {
  const S = SIZE;
  const S1 = S - 1;

  // Interior — no wrap branches.
  for (let y = 1; y < S1; y += 1) {
    const row = y * S;
    const rowm = row - S;
    const rowp = row + S;
    for (let x = 1; x < S1; x += 1) {
      const i = row + x;
      const n =
        board[rowm + x - 1] +
        board[rowm + x] +
        board[rowm + x + 1] +
        board[i - 1] +
        board[i + 1] +
        board[rowp + x - 1] +
        board[rowp + x] +
        board[rowp + x + 1];
      const alive = board[i];
      out[i] = alive ? (n === 2 || n === 3 ? 1 : 0) : n === 3 ? 1 : 0;
    }
  }

  // Top & bottom rows (y = 0, S-1), including corners.
  for (let x = 0; x < S; x += 1) {
    const xm = x === 0 ? S1 : x - 1;
    const xp = x === S1 ? 0 : x + 1;

    {
      const y = 0;
      const row = 0;
      const rowm = S1 * S;
      const rowp = S;
      const n =
        board[rowm + xm] +
        board[rowm + x] +
        board[rowm + xp] +
        board[row + xm] +
        board[row + xp] +
        board[rowp + xm] +
        board[rowp + x] +
        board[rowp + xp];
      const alive = board[row + x];
      out[row + x] = alive ? (n === 2 || n === 3 ? 1 : 0) : n === 3 ? 1 : 0;
    }

    {
      const row = S1 * S;
      const rowm = (S1 - 1) * S;
      const rowp = 0;
      const n =
        board[rowm + xm] +
        board[rowm + x] +
        board[rowm + xp] +
        board[row + xm] +
        board[row + xp] +
        board[rowp + xm] +
        board[rowp + x] +
        board[rowp + xp];
      const alive = board[row + x];
      out[row + x] = alive ? (n === 2 || n === 3 ? 1 : 0) : n === 3 ? 1 : 0;
    }
  }

  // Left & right columns (excluding corners already done).
  for (let y = 1; y < S1; y += 1) {
    const row = y * S;
    const rowm = row - S;
    const rowp = row + S;

    {
      const x = 0;
      const xm = S1;
      const xp = 1;
      const n =
        board[rowm + xm] +
        board[rowm + x] +
        board[rowm + xp] +
        board[row + xm] +
        board[row + xp] +
        board[rowp + xm] +
        board[rowp + x] +
        board[rowp + xp];
      const alive = board[row + x];
      out[row + x] = alive ? (n === 2 || n === 3 ? 1 : 0) : n === 3 ? 1 : 0;
    }

    {
      const x = S1;
      const xm = S1 - 1;
      const xp = 0;
      const n =
        board[rowm + xm] +
        board[rowm + x] +
        board[rowm + xp] +
        board[row + xm] +
        board[row + xp] +
        board[rowp + xm] +
        board[rowp + x] +
        board[rowp + xp];
      const alive = board[row + x];
      out[row + x] = alive ? (n === 2 || n === 3 ? 1 : 0) : n === 3 ? 1 : 0;
    }
  }

  return out;
}

/** XOR-scatter births/deaths from hash(generation). Mutates `board`. */
export function applyMeteor(board, generation) {
  const rand = mulberry32(hash32(generation ^ 0x7f4a7c15));
  for (let k = 0; k < METEOR_CELLS; k += 1) {
    const i = Math.floor(rand() * board.length);
    board[i] = board[i] ? 0 : 1;
  }
  return board;
}

export function isQuiet(board, prev) {
  if (population(board) <= QUIET_POP) return true;
  if (prev && boardsEqual(board, prev)) return true;
  return false;
}

function storage() {
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    /* private mode */
  }
  return null;
}

function boardToB64(board) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < board.length; i += chunk) {
    binary += String.fromCharCode(...board.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function boardFromB64(b64) {
  const bin = atob(b64);
  if (bin.length !== CELLS) return null;
  const board = emptyBoard();
  for (let i = 0; i < bin.length; i += 1) board[i] = bin.charCodeAt(i);
  return board;
}

/** Published + localStorage payload (v2). */
export function serializeLifeState(state) {
  return {
    v: 2,
    size: SIZE,
    genesis: GENESIS_MS,
    n: state.n,
    lastMeteor: state.lastMeteor,
    b: boardToB64(state.board),
  };
}

/** Parse a published or localStorage life payload. */
export function parseLifeState(data) {
  if (!data || typeof data !== "object") return null;
  if (data.size != null && data.size !== SIZE) return null;
  if (data.genesis != null && data.genesis !== GENESIS_MS) return null;
  if (
    typeof data.n !== "number" ||
    typeof data.lastMeteor !== "number" ||
    typeof data.b !== "string" ||
    data.n < 0 ||
    data.lastMeteor < 0 ||
    data.lastMeteor > data.n
  ) {
    return null;
  }
  const board = boardFromB64(data.b);
  if (!board) return null;
  return { n: data.n, board, lastMeteor: data.lastMeteor };
}

export function readCheckpoint() {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(CHECKPOINT_KEY);
    if (!raw) return null;
    return parseLifeState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeCheckpoint(state) {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(CHECKPOINT_KEY, JSON.stringify(serializeLifeState(state)));
  } catch {
    /* quota — ignore */
  }
}

function initialState() {
  return { n: 0, board: seedBoard(0xc0ffee), lastMeteor: 0 };
}

/**
 * Advance from `from` through generation `target` using a double buffer.
 * Optional `yieldEvery` / `onProgress` for async catch-up without jank.
 */
export async function evolveTo(from, target, options = {}) {
  const yieldEvery = options.yieldEvery ?? 0;
  const progressEvery = options.progressEvery ?? CHECKPOINT_EVERY;
  const onProgress = options.onProgress;

  if (target < from.n) throw new Error("evolveTo: target behind start");
  if (target === from.n) {
    return { n: from.n, board: from.board.slice(), lastMeteor: from.lastMeteor };
  }

  let cur = from.board.slice();
  let nxt = emptyBoard();
  let lastMeteor = from.lastMeteor;
  let g = from.n;

  while (g < target) {
    const limit =
      yieldEvery > 0 ? Math.min(target, g + yieldEvery) : target;

    while (g < limit) {
      g += 1;
      step(cur, nxt);

      const since = g - lastMeteor;
      if (since >= HARD_CAP) {
        applyMeteor(nxt, g);
        lastMeteor = g;
      } else if (since % QUIET_GAP === 0 && isQuiet(nxt, cur)) {
        applyMeteor(nxt, g);
        lastMeteor = g;
      }

      const tmp = cur;
      cur = nxt;
      nxt = tmp;

      if (
        onProgress &&
        progressEvery > 0 &&
        g !== target &&
        g % progressEvery === 0
      ) {
        onProgress({ n: g, board: cur, lastMeteor });
      }
    }

    if (g >= target) break;
    await new Promise((r) => setTimeout(r, 0));
  }

  return { n: target, board: cur, lastMeteor };
}

/** Sync evolve (tests + small jumps). */
export function evolveToSync(from, target) {
  if (target < from.n) throw new Error("evolveToSync: target behind start");
  if (target === from.n) {
    return { n: from.n, board: from.board.slice(), lastMeteor: from.lastMeteor };
  }

  let cur = from.board.slice();
  let nxt = emptyBoard();
  let lastMeteor = from.lastMeteor;

  for (let g = from.n + 1; g <= target; g += 1) {
    step(cur, nxt);

    const since = g - lastMeteor;
    if (since >= HARD_CAP) {
      applyMeteor(nxt, g);
      lastMeteor = g;
    } else if (since % QUIET_GAP === 0 && isQuiet(nxt, cur)) {
      applyMeteor(nxt, g);
      lastMeteor = g;
    }

    const tmp = cur;
    cur = nxt;
    nxt = tmp;
  }

  return { n: target, board: cur, lastMeteor };
}

function isLifeState(s) {
  return (
    s &&
    typeof s.n === "number" &&
    typeof s.lastMeteor === "number" &&
    s.board &&
    s.board.length === CELLS
  );
}

/**
 * Best resume point at or before generation n.
 * Candidates: in-memory cache, localStorage, plus any extras (e.g. published
 * life-state.json). Highest n wins; cache + storage are write-through synced
 * when something newer is adopted.
 */
export function startStateFor(n, candidates = []) {
  const pool = [];
  if (isLifeState(cache) && cache.n <= n) pool.push(cache);
  const stored = readCheckpoint();
  if (isLifeState(stored) && stored.n <= n) pool.push(stored);
  for (const c of candidates) {
    if (isLifeState(c) && c.n <= n) pool.push(c);
  }

  let best = null;
  for (const s of pool) {
    if (!best || s.n > best.n) best = s;
  }
  if (!best) best = initialState();

  // Historical ask while memory already holds a newer tip — return best
  // without clobbering the tip (production only ever asks for “now”).
  if (cache && cache.n > n) {
    return {
      n: best.n,
      board: best.board,
      lastMeteor: best.lastMeteor,
    };
  }

  const memoryBehind = !cache || cache.n < best.n;
  const storageBehind = !stored || stored.n < best.n;
  if (memoryBehind) {
    cache = {
      n: best.n,
      board: best.board,
      lastMeteor: best.lastMeteor,
    };
  }
  if (storageBehind) writeCheckpoint(cache);

  return {
    n: cache.n,
    board: cache.board,
    lastMeteor: cache.lastMeteor,
  };
}

export function commitState(state) {
  cache = {
    n: state.n,
    board: state.board,
    lastMeteor: state.lastMeteor,
  };
  writeCheckpoint(state);
  return state.board;
}

/**
 * Board at generation n (0 = initial seed, after 0 steps).
 * Quiet checks run every QUIET_GAP generations since the last meteor
 * (or immediately at HARD_CAP).
 */
export function boardAtGeneration(n) {
  if (n < 0) n = 0;
  if (cache && cache.n === n) return cache.board;

  const from = startStateFor(n);
  if (from.n === n) {
    if (!cache || cache.n <= n) {
      cache = {
        n: from.n,
        board: from.board,
        lastMeteor: from.lastMeteor,
      };
    }
    return from.board;
  }

  return commitState(evolveToSync(from, n));
}

/**
 * Async catch-up — yields so the UI can breathe. Prefer the Worker wrapper
 * in life.js for long gaps; this is the main-thread fallback.
 */
export async function boardAtGenerationAsync(n, yieldEvery = 256) {
  if (n < 0) n = 0;
  if (cache && cache.n === n) return cache.board;

  const from = startStateFor(n);
  if (from.n === n) {
    if (!cache || cache.n <= n) {
      cache = {
        n: from.n,
        board: from.board,
        lastMeteor: from.lastMeteor,
      };
    }
    return from.board;
  }

  const state = await evolveTo(from, n, {
    yieldEvery,
    onProgress: (mid) => {
      cache = {
        n: mid.n,
        board: mid.board.slice(),
        lastMeteor: mid.lastMeteor,
      };
      writeCheckpoint(cache);
    },
  });
  return commitState(state);
}

/** Fast path used by the page: board for “now”. */
export function boardNow(nowMs = Date.now()) {
  return boardAtGeneration(generationAt(nowMs));
}

export async function boardNowAsync(nowMs = Date.now(), yieldEvery = 256) {
  return boardAtGenerationAsync(generationAt(nowMs), yieldEvery);
}

/** Test helper — drop in-memory cache; pass `{ storage: true }` to clear localStorage. */
export function clearLifeCache(opts = {}) {
  cache = null;
  if (opts.storage) {
    try {
      storage()?.removeItem(CHECKPOINT_KEY);
    } catch {
      /* ignore */
    }
  }
}
