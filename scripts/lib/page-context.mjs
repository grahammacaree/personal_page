import { escapeHtml } from "./html.mjs";
import { formatLastmod } from "./lastmod.mjs";
import { pageLoc } from "./sitemap.mjs";
import {
  chromeConfig,
  homePageHref,
  normalizeBasePath,
  publishedDocHrefFromCtx,
} from "./site-config.mjs";

function documentTitle(page, siteName) {
  if (page.pageType.title === "siteName") return escapeHtml(siteName);
  return `${escapeHtml(page.pageTitle)} — ${escapeHtml(siteName)}`;
}

function docForPage(page, docs) {
  const slug = page.sectionSlugs[0];
  return docs.find((d) => d.slug === slug);
}

function canonicalUrl(page, ctx) {
  const siteUrl = ctx.siteConfig.url;
  if (!siteUrl) return "";
  return pageLoc(siteUrl, ctx.basePath, page.output);
}

function personJsonLd(page, ctx) {
  if (page.pageType.title !== "siteName") return "";
  const { person, name, url } = ctx.siteConfig;
  if (!person) return "";

  const payload = {
    "@context": "https://schema.org",
    "@type": "Person",
    name,
    url: url?.replace(/\/$/, ""),
    ...person,
  };

  return JSON.stringify(payload);
}

function metaDescription(page, ctx) {
  const siteDefault = ctx.siteConfig.description ?? "";
  if (page.pageType.title === "siteName") {
    return siteDefault ? escapeHtml(siteDefault) : "";
  }
  const doc = docForPage(page, ctx.docs);
  const raw = doc?.description ?? siteDefault;
  return raw ? escapeHtml(raw) : "";
}

function contactHref(basePath, email) {
  return email ? `mailto:${escapeHtml(email)}` : `${basePath}#main`;
}

function pageScriptsHtml(basePath, scripts) {
  return (scripts ?? [])
    .map((file) => {
      const src = `${basePath}${file}`;
      // life.js imports life-engine.mjs; life-state.json via data-life-base
      if (file === "life.js") {
        return `<script type="module" src="${src}" data-life-base="${basePath}"></script>`;
      }
      return `<script src="${src}" defer></script>`;
    })
    .join("\n");
}

function topBarVars(page, ctx) {
  const basePath = normalizeBasePath(ctx.basePath);
  const pt = page.pageType;
  const chrome = chromeConfig(ctx.siteConfig);
  const leftNavBack = pt.leftNav === "back";
  const cvHref = publishedDocHrefFromCtx(ctx, "cv");
  const studiesHref = publishedDocHrefFromCtx(ctx, "studies");

  return {
    leftNavBack,
    backHref: leftNavBack ? homePageHref(page, ctx) : "",
    backChevron: leftNavBack
      ? (ctx.assets[chrome.assets?.backChevron ?? "chevrons/left.svg"]?.trim() ?? "")
      : "",
    siteName: escapeHtml(ctx.siteConfig.name),
    contactHref: contactHref(basePath, ctx.siteConfig.email),
    cvNavLink: pt.cvNav !== false && pt.cvNav !== "current" && !!cvHref,
    cvHref,
    cvNavCurrent: pt.cvNav === "current",
    studiesNavLink:
      pt.studiesNav !== false && pt.studiesNav !== "current" && !!studiesHref,
    studiesHref,
    studiesNavCurrent: pt.studiesNav === "current",
  };
}

function footerVars(page, ctx) {
  const pt = page.pageType;
  const aboutHref = publishedDocHrefFromCtx(ctx, "about");

  return {
    year: ctx.year,
    siteName: escapeHtml(ctx.siteConfig.name),
    showAboutLink: pt.aboutLink !== false && !!aboutHref,
    aboutHref,
  };
}

function allPageScripts(siteConfig, pageType) {
  const chrome = chromeConfig(siteConfig);
  return [...(chrome.scripts ?? []), ...(pageType.scripts ?? [])];
}

/** Template variables for the page layout shell. */
export function layoutVars(page, ctx) {
  const basePath = normalizeBasePath(ctx.basePath);
  const body = page.sectionSlugs.map((slug) => ctx.sections[slug] ?? "").join("\n");
  const pt = page.pageType;

  const canonical = canonicalUrl(page, ctx);
  const lastmod = formatLastmod(page.lastmod);

  return {
    basePath,
    documentTitle: documentTitle(page, ctx.siteConfig.name),
    metaDescription: metaDescription(page, ctx),
    canonicalUrl: canonical ? escapeHtml(canonical) : "",
    lastmod: lastmod ? escapeHtml(lastmod) : "",
    personJsonLd: personJsonLd(page, ctx),
    bodyClass: pt.bodyClass ?? "",
    pageScripts: pageScriptsHtml(basePath, allPageScripts(ctx.siteConfig, pt)),
    body,
    topBar: topBarVars(page, ctx),
    footer: footerVars(page, ctx),
  };
}
