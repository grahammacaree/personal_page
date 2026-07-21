import assert from "node:assert/strict";
import test from "node:test";
import { pdfExportsFromConfig } from "./export-pdfs.mjs";

test("pdfExportsFromConfig keeps valid pdf entries", () => {
  assert.deepEqual(
    pdfExportsFromConfig({
      pdfExports: [
        { id: "abc", path: "cv.pdf" },
        { id: "PLACEHOLDER", path: "x.pdf" },
        { id: "def", path: "notes.txt" },
        { id: "ghi", path: "../escape.pdf" },
        { id: "", path: "empty.pdf" },
      ],
    }),
    [{ id: "abc", path: "cv.pdf" }]
  );
});

test("pdfExportsFromConfig handles missing config", () => {
  assert.deepEqual(pdfExportsFromConfig({}), []);
  assert.deepEqual(pdfExportsFromConfig(null), []);
});
