import assert from "node:assert/strict";
import test from "node:test";
import { buildSitemapXml, pageLoc } from "./sitemap.mjs";

test("pageLoc maps index.html to site root", () => {
  assert.equal(
    pageLoc("https://grahammacaree.com", "/", "index.html"),
    "https://grahammacaree.com/"
  );
});

test("pageLoc builds story URLs", () => {
  assert.equal(
    pageLoc("https://grahammacaree.com", "/", "stories/baseball-potato.html"),
    "https://grahammacaree.com/stories/baseball-potato.html"
  );
});

test("buildSitemapXml lists all page locs", () => {
  const xml = buildSitemapXml("https://example.com", "/", [
    { output: "index.html" },
    { output: "cv.html" },
  ]);
  assert.match(xml, /<loc>https:\/\/example\.com\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/example\.com\/cv\.html<\/loc>/);
});
