import assert from "node:assert/strict";
import test from "node:test";
import { formatLastmod } from "./lastmod.mjs";
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

test("buildSitemapXml includes lastmod when provided", () => {
  const xml = buildSitemapXml("https://example.com", "/", [
    { output: "index.html", lastmod: new Date("2026-07-14T12:00:00Z") },
    { output: "cv.html" },
  ]);
  assert.match(
    xml,
    /<loc>https:\/\/example\.com\/<\/loc>\s*<lastmod>2026-07-14<\/lastmod>/
  );
  assert.doesNotMatch(
    xml,
    /cv\.html<\/loc>\s*<lastmod>/
  );
});

test("formatLastmod is UTC calendar day", () => {
  assert.equal(formatLastmod(new Date("2026-07-15T01:30:00Z")), "2026-07-15");
  assert.equal(formatLastmod(null), "");
});
