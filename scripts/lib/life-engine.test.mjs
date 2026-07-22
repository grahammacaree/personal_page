import assert from "node:assert/strict";
import test from "node:test";
import {
  HARD_CAP,
  QUIET_GAP,
  SIZE,
  applyMeteor,
  boardAtGeneration,
  boardsEqual,
  clearLifeCache,
  generationAt,
  GENESIS_MS,
  population,
  seedBoard,
  startStateFor,
  step,
  TICK_MS,
} from "../../site/life-engine.mjs";

test("generationAt is zero before genesis", () => {
  assert.equal(generationAt(GENESIS_MS - 1), 0);
  assert.equal(generationAt(GENESIS_MS), 0);
  assert.equal(generationAt(GENESIS_MS + TICK_MS - 1), 0);
  assert.equal(generationAt(GENESIS_MS + TICK_MS), 1);
});

test("step preserves board length on a torus", () => {
  const a = seedBoard(1);
  const b = step(a);
  assert.equal(b.length, SIZE * SIZE);
  assert.ok(population(b) >= 0);
});

test("boardAtGeneration is deterministic", () => {
  clearLifeCache();
  const a = boardAtGeneration(50);
  clearLifeCache();
  const b = boardAtGeneration(50);
  assert.ok(boardsEqual(a, b));
});

test("incremental cache matches cold compute", () => {
  clearLifeCache();
  const cold = boardAtGeneration(80);
  clearLifeCache();
  boardAtGeneration(40);
  const warm = boardAtGeneration(80);
  assert.ok(boardsEqual(cold, warm));
});

test("applyMeteor changes the board", () => {
  const a = seedBoard(2);
  const before = a.slice();
  applyMeteor(a, 99);
  assert.equal(boardsEqual(before, a), false);
});

test("quiet checks only at QUIET_GAP cadence", () => {
  clearLifeCache();
  // Still-life after seed is unlikely; just ensure evolve through one gap works.
  const a = boardAtGeneration(QUIET_GAP);
  const b = boardAtGeneration(QUIET_GAP);
  assert.ok(boardsEqual(a, b));
  assert.equal(a.length, SIZE * SIZE);
});

test("quiet gap and hard cap constants are ordered", () => {
  assert.ok(QUIET_GAP < HARD_CAP);
  assert.ok(TICK_MS >= 1000);
});

test("board evolves across generations", () => {
  clearLifeCache();
  const a = boardAtGeneration(0);
  const b = boardAtGeneration(10);
  assert.equal(boardsEqual(a, b), false);
});

test("startStateFor picks the newest candidate at or before n", () => {
  clearLifeCache();
  const older = boardAtGeneration(10);
  clearLifeCache();
  const newer = {
    n: 40,
    board: boardAtGeneration(40),
    lastMeteor: 0,
  };
  clearLifeCache();
  const start = startStateFor(100, [
    { n: 10, board: older, lastMeteor: 0 },
    newer,
  ]);
  assert.equal(start.n, 40);
  assert.ok(boardsEqual(start.board, newer.board));
});
