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
    pageType: { title: "siteName", layout: "page", bodyClass: "body--home" },
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

test("chrome scripts prepend pageType scripts", () => {
  const withChromeScripts = {
    ...ctx,
    siteConfig: {
      ...siteConfig,
      chrome: {
        ...siteConfig.chrome,
        scripts: ["jovian.js"],
      },
    },
  };
  const page = {
    pageType: {
      title: "siteName",
      layout: "page",
      scripts: ["studies.js"],
    },
    sectionSlugs: ["intro"],
    pageTitle: null,
    output: "index.html",
  };
  assert.equal(
    layoutVars(page, withChromeScripts).pageScripts,
    '<script src="/jovian.js" defer></script>\n<script src="/studies.js" defer></script>'
  );
});

test("life.js script carries data-life-base and icon template", () => {
  const withIcons = {
    ...ctx,
    siteConfig: {
      ...siteConfig,
      chrome: {
        ...siteConfig.chrome,
        assets: {
          backChevron: "chevrons/left.svg",
          lifeInfo: "icons/info.svg",
        },
      },
    },
    assets: {
      "chevrons/left.svg": '<svg id="back-icon" aria-hidden="true"></svg>',
      "icons/info.svg": '<svg id="info-icon" aria-hidden="true"></svg>',
    },
  };
  const page = {
    pageType: {
      title: "siteName",
      layout: "page",
      scripts: ["life.js"],
    },
    sectionSlugs: ["intro"],
    pageTitle: null,
    output: "index.html",
  };
  const html = layoutVars(page, withIcons).pageScripts;
  assert.match(html, /<template id="life-chrome">/);
  assert.match(html, /data-life-icon="back"/);
  assert.match(html, /id="back-icon"/);
  assert.match(html, /data-life-icon="info"/);
  assert.match(html, /id="info-icon"/);
  assert.match(
    html,
    /<script type="module" src="\/life\.js" data-life-base="\/"><\/script>/
  );
});
