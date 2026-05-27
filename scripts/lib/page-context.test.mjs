import assert from "node:assert/strict";
import test from "node:test";
import { layoutVars } from "./page-context.mjs";

const siteConfig = {
  name: "Graham MacAree",
  url: "https://grahammacaree.com",
  description: "Site blurb",
  person: { jobTitle: "Editorial/Engineering Leader" },
  chrome: {
    components: { topBar: "site-top-bar", footer: "site-footer" },
  },
};

const docs = [
  { slug: "intro", title: "Introduction", description: "Intro blurb" },
  { slug: "baseball-potato", title: "Baseball Potato", description: "Story blurb" },
];

const ctx = {
  basePath: "/",
  siteConfig,
  docs,
  sections: {},
  year: "2026",
  assets: {},
};

test("homepage uses site description", () => {
  const page = {
    pageType: { title: "siteName", layout: "home" },
    sectionSlugs: ["intro", "thesis"],
    pageTitle: null,
    output: "index.html",
  };
  const slots = layoutVars(page, ctx);
  assert.equal(slots.metaDescription, "Site blurb");
  assert.equal(slots.canonicalUrl, "https://grahammacaree.com/");
  assert.match(slots.personJsonLd, /"@type":"Person"/);
});

test("inner page canonical URL", () => {
  const page = {
    pageType: { title: "docTitle", layout: "page" },
    sectionSlugs: ["baseball-potato"],
    pageTitle: "Story",
    output: "stories/baseball-potato.html",
  };
  assert.equal(
    layoutVars(page, ctx).canonicalUrl,
    "https://grahammacaree.com/stories/baseball-potato.html"
  );
  assert.equal(layoutVars(page, ctx).personJsonLd, "");
});

test("published page uses manifest description", () => {
  const page = {
    pageType: { title: "docTitle", layout: "page" },
    sectionSlugs: ["baseball-potato"],
    pageTitle: "Baseball Potato",
    output: "stories/baseball-potato.html",
  };
  assert.equal(layoutVars(page, ctx).metaDescription, "Story blurb");
});

test("published page falls back to site description", () => {
  const page = {
    pageType: { title: "docTitle", layout: "page" },
    sectionSlugs: ["missing"],
    pageTitle: "Missing",
    output: "missing.html",
  };
  assert.equal(layoutVars(page, ctx).metaDescription, "Site blurb");
});
