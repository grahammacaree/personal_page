import * as cheerio from "cheerio";
import { publicRelPath } from "./content-path.mjs";

/** Google doc id in /document/d/ID or /document/u/0/d/ID paths */
const DOC_ID = /\/document(?:\/u\/\d+)?\/d\/([a-zA-Z0-9_-]+)/;

import { PLACEHOLDER } from "./constants.mjs";

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

/** Map manifest doc ids → site paths; rewrite <a href> from Google Docs URLs. */
export function buildDocUrlMap(docs, basePath) {
  const map = new Map();
  for (const doc of docs) {
    if (!doc.id || doc.id === PLACEHOLDER) continue;
    const rel = publicRelPath(doc);
    map.set(doc.id, rel == null ? basePath : `${basePath}${rel}`);
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
