import assert from "node:assert/strict";
import test from "node:test";
import {
  boardsEqual,
  evolveToSync,
  parseLifeState,
  seedBoard,
  serializeLifeState,
} from "../../site/life-engine.mjs";
import { computePublishedLifeState } from "./life-state.mjs";

test("serializeLifeState round-trips", () => {
  const state = evolveToSync(
    { n: 0, board: seedBoard(0xc0ffee), lastMeteor: 0 },
    25,
  );
  const parsed = parseLifeState(serializeLifeState(state));
  assert.ok(parsed);
  assert.equal(parsed.n, 25);
  assert.equal(parsed.lastMeteor, state.lastMeteor);
  assert.ok(boardsEqual(parsed.board, state.board));
});

test("parseLifeState rejects wrong size/genesis", () => {
  const state = {
    n: 0,
    board: seedBoard(1),
    lastMeteor: 0,
  };
  const good = serializeLifeState(state);
  assert.equal(parseLifeState({ ...good, size: 16 }), null);
  assert.equal(parseLifeState({ ...good, genesis: 1 }), null);
});

test("computePublishedLifeState reaches generationAt(now)", async () => {
  const nowMs = Date.UTC(2026, 6, 22, 1, 0, 0); // 1h after genesis → 120 gens
  const json = await computePublishedLifeState({
    nowMs,
    prior: { n: 0, board: seedBoard(0xc0ffee), lastMeteor: 0 },
  });
  assert.equal(json.n, 120);
  assert.equal(json.v, 2);
  assert.ok(parseLifeState(json));
});
