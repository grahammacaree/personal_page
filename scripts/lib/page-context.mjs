import { escapeHtml } from "./html.mjs";
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
    .map((file) => `<script src="${basePath}${file}" defer></script>`)
    .join("\n");
}

function topBarVars(page, ctx) {
  const basePath = normalizeBasePath(ctx.basePath);
  const pt = page.pageType;
  const chrome = chromeConfig(ctx.siteConfig);
  const leftNavBack = pt.leftNav === "back";
  const cvHref = publishedDocHrefFromCtx(ctx, "cv");
  const aboutHref = publishedDocHrefFromCtx(ctx, "about");

  return {
    topBarHidden: !!pt.topBarHidden,
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

/** Template variables for a layout component (home / page). */
export function layoutVars(page, ctx) {
  const basePath = normalizeBasePath(ctx.basePath);
  const body = page.sectionSlugs.map((slug) => ctx.sections[slug] ?? "").join("\n");
  const pt = page.pageType;

  return {
    basePath,
    documentTitle: documentTitle(page, ctx.siteConfig.name),
    metaDescription: metaDescription(page, ctx),
    bodyClass: pt.bodyClass ?? "",
    pageScripts: pageScriptsHtml(basePath, pt.scripts),
    body,
    topBar: topBarVars(page, ctx),
    footer: footerVars(page, ctx),
  };
}
