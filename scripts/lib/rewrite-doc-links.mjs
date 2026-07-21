import * as cheerio from "cheerio";
import { PLACEHOLDER } from "./constants.mjs";
import { pdfExportsFromConfig } from "./export-pdfs.mjs";
import { escapeHtml } from "./html.mjs";
import { publishPathForDoc } from "./site-config.mjs";

/** Google doc id in /document/d/ID or /document/u/0/d/ID paths */
const DOC_ID = /\/document(?:\/u\/\d+)?\/d\/([a-zA-Z0-9_-]+)/;

function unwrapGoogleRedirect(href) {
  try {
    const url = new URL(href);
    if (url.hostname === "www.google.com" && url.pathname === "/url") {
      const q = url.searchParams.get("q");
      if (q) return decodeURIComponent(q);
    }
  } catch {
    // relative or malformed
  }
  return href;
}

function extractDocId(href) {
  if (!href) return null;
  const match = unwrapGoogleRedirect(href).match(DOC_ID);
  return match?.[1] ?? null;
}

/** Map manifest doc ids (+ pdfExports) → site paths; rewrite <a href> from Google Docs URLs. */
export function buildDocUrlMap(docs, basePath, siteConfig) {
  const map = new Map();
  for (const doc of docs) {
    if (!doc.id || doc.id === PLACEHOLDER) continue;
    const rel = publishPathForDoc(siteConfig, doc);
    map.set(doc.id, rel == null ? basePath : `${basePath}${rel}`);
  }
  for (const entry of pdfExportsFromConfig(siteConfig)) {
    map.set(entry.id, `${basePath}${entry.path}`);
  }
  return map;
}

export function rewriteDocLinks(html, docUrlById) {
  if (!html || docUrlById.size === 0) return html;

  const $ = cheerio.load(`<div id="rewrite-root">${html}</div>`, {
    decodeEntities: false,
  });

  $("#rewrite-root a[href]").each((_, el) => {
    const raw = $(el).attr("href") ?? "";
    const href = unwrapGoogleRedirect(raw);
    if (href !== raw) $(el).attr("href", href);

    const docId = extractDocId(href);
    if (!docId) return;
    const siteUrl = docUrlById.get(docId);
    if (siteUrl) $(el).attr("href", siteUrl);
  });

  return $("#rewrite-root").html() ?? html;
}

/**
 * Link bare "here" in the CV closer to the printable PDF.
 * Matches: …require a more traditional CV (…) please see here.
 */
export function linkSeeHereToPdf(html, pdfHref) {
  if (!html || !pdfHref) return html;
  const href = escapeHtml(pdfHref);
  return html.replace(
    /(Should you for any reason require a more traditional CV \(dates, titles, skills etc\.\) please see )(?!<a\b)here(?!<\/a>)(\.?)/g,
    `$1<a href="${href}">here</a>$2`
  );
}

/** Prefer cv.pdf from pdfExports; else first export. */
export function cvPdfHref(siteConfig, basePath) {
  const exports = pdfExportsFromConfig(siteConfig);
  const cv =
    exports.find((e) => e.path === "cv.pdf") ?? exports[0] ?? null;
  return cv ? `${basePath}${cv.path}` : "";
}
