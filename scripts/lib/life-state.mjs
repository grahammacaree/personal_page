/**
 * Build-time Life checkpoint → public/life-state.json
 * Resumes from the live site’s previous file when reachable (daily CI).
 */
import {
  evolveToSync,
  generationAt,
  parseLifeState,
  seedBoard,
  serializeLifeState,
} from "../../site/life-engine.mjs";

export async function fetchPriorLifeState(url, timeoutMs = 4000) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    return parseLifeState(await res.json());
  } catch {
    return null;
  }
}

/**
 * @param {{ siteUrl?: string, nowMs?: number, prior?: { n: number, board: Uint8Array, lastMeteor: number } | null }} [opts]
 */
export async function computePublishedLifeState(opts = {}) {
  const nowMs = opts.nowMs ?? Date.now();
  const target = generationAt(nowMs);

  let from = opts.prior ?? null;
  if (!from && opts.siteUrl) {
    const priorUrl = `${String(opts.siteUrl).replace(/\/$/, "")}/life-state.json`;
    from = await fetchPriorLifeState(priorUrl);
  }

  if (!from || from.n > target) {
    from = { n: 0, board: seedBoard(0xc0ffee), lastMeteor: 0 };
  }

  const state = evolveToSync(from, target);
  return serializeLifeState(state);
}
