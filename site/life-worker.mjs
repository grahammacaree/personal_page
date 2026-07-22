/**
 * Off-main-thread Life catch-up. Main thread stays responsive; progress
 * messages let the page persist resume checkpoints.
 */
import { evolveTo, CHECKPOINT_EVERY } from "./life-engine.mjs";

self.onmessage = async (event) => {
  const { id, from, target } = event.data;
  try {
    const state = await evolveTo(from, target, {
      // Chunk work so the worker can post progress / accept terminate.
      yieldEvery: 512,
      progressEvery: CHECKPOINT_EVERY,
      onProgress: (mid) => {
        self.postMessage({
          id,
          type: "progress",
          n: mid.n,
          lastMeteor: mid.lastMeteor,
          board: mid.board.slice(),
        });
      },
    });
    self.postMessage(
      {
        id,
        type: "done",
        n: state.n,
        lastMeteor: state.lastMeteor,
        board: state.board,
      },
      [state.board.buffer],
    );
  } catch (err) {
    self.postMessage({
      id,
      type: "error",
      message: err?.message ?? String(err),
    });
  }
};
