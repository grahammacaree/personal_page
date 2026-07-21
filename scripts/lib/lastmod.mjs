import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { contentPathForDoc } from "./site-config.mjs";

/** W3C date for sitemap / Open Graph (UTC calendar day). */
export function formatLastmod(date) {
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

async function mtimeMs(filePath) {
  try {
    const s = await stat(filePath);
    return s.mtimeMs;
  } catch {
    return null;
  }
}

/**
 * Latest mtime among content files (and studies artifacts) that feed a page.
 * @returns {Promise<Date|null>}
 */
export async function lastModifiedForPage(page, opts) {
  const {
    contentDir,
    siteConfig,
    docs,
    studiesDir,
    studiesConfigPath,
    exportsDir,
  } = opts;
  const times = [];

  for (const slug of page.sectionSlugs ?? []) {
    const doc = docs.find((d) => d.slug === slug);
    if (!doc) continue;
    const rel = contentPathForDoc(siteConfig, doc);
    const ms = await mtimeMs(path.join(contentDir, rel));
    if (ms != null) times.push(ms);

    if (doc.type === "studies") {
      if (studiesConfigPath) {
        const cfgMs = await mtimeMs(studiesConfigPath);
        if (cfgMs != null) times.push(cfgMs);
      }
      if (studiesDir) {
        try {
          for (const name of await readdir(studiesDir)) {
            if (!name.endsWith(".pdf")) continue;
            const pdfMs = await mtimeMs(path.join(studiesDir, name));
            if (pdfMs != null) times.push(pdfMs);
          }
        } catch {
          /* no studies dir yet */
        }
      }
    }

    if (doc.type === "cv" && exportsDir) {
      for (const entry of siteConfig?.pdfExports ?? []) {
        const pdfRel = String(entry?.path ?? "").trim().replace(/^\/+/, "");
        if (!pdfRel.endsWith(".pdf") || pdfRel.includes("..")) continue;
        const pdfMs = await mtimeMs(path.join(exportsDir, pdfRel));
        if (pdfMs != null) times.push(pdfMs);
      }
    }
  }

  if (times.length === 0) return null;
  return new Date(Math.max(...times));
}

/** Write UTF-8 text only when contents differ (preserves mtime for lastmod). */
export async function writeFileIfChanged(filePath, contents) {
  const next = String(contents);
  try {
    const prev = await readFile(filePath, "utf8");
    if (prev === next) return false;
  } catch {
    /* missing → write */
  }
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, next, "utf8");
  return true;
}
