import assert from "node:assert/strict";
import test from "node:test";
import { layoutVars } from "./page-context.mjs";

const siteConfig = {
  name: "Graham MacAree",
  description: "Site blurb",
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
  };
  assert.equal(layoutVars(page, ctx).metaDescription, "Site blurb");
});

test("published page uses manifest description", () => {
  const page = {
    pageType: { title: "docTitle", layout: "page" },
    sectionSlugs: ["baseball-potato"],
    pageTitle: "Baseball Potato",
  };
  assert.equal(layoutVars(page, ctx).metaDescription, "Story blurb");
});

test("published page falls back to site description", () => {
  const page = {
    pageType: { title: "docTitle", layout: "page" },
    sectionSlugs: ["missing"],
    pageTitle: "Missing",
  };
  assert.equal(layoutVars(page, ctx).metaDescription, "Site blurb");
});
