import { normalizeBasePath } from "./site-config.mjs";
import { formatLastmod } from "./lastmod.mjs";

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/** Absolute public URL for a built page (index.html → site root). */
export function pageLoc(siteUrl, basePath, output) {
  const origin = siteUrl.replace(/\/$/, "");
  const base = normalizeBasePath(basePath);
  if (output === "index.html") {
    return base === "/" ? `${origin}/` : `${origin}${base}`;
  }
  const prefix = base === "/" ? `${origin}/` : `${origin}${base}`;
  return `${prefix}${output}`;
}

export function buildSitemapXml(siteUrl, basePath, pages) {
  const body = pages
    .map((page) => {
      const loc = pageLoc(siteUrl, basePath, page.output);
      const lastmod = formatLastmod(page.lastmod);
      const lastmodXml = lastmod
        ? `\n    <lastmod>${escapeXml(lastmod)}</lastmod>`
        : "";
      return `  <url>\n    <loc>${escapeXml(loc)}</loc>${lastmodXml}\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}
