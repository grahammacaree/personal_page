import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { cleanGoogleHtml } from "./clean-google-html.mjs";
import { applyEndmark } from "./endmark.mjs";
import { renderTemplate } from "./html.mjs";
import {
  parseReadingEntries,
  renderReadingEntries,
} from "./parse-reading.mjs";
import {
  loadStudiesConfig,
  renderStudiesSection,
} from "./parse-studies.mjs";
import { rewriteDocLinks, linkSeeHereToPdf, cvPdfHref } from "./rewrite-doc-links.mjs";
import {
  contentPathForDoc,
  docTypeConfig,
  normalizeBasePath,
} from "./site-config.mjs";

async function readContent(contentDir, relPath) {
  try {
    return await readFile(path.join(contentDir, relPath), "utf8");
  } catch {
    return "";
  }
}

/** Clean + link-rewrite synced Doc HTML (no section wrapper). */
async function loadDocHtml(doc, docUrlById, { contentDir, siteConfig }) {
  const raw = await readContent(contentDir, contentPathForDoc(siteConfig, doc));
  const cleaned = raw ? cleanGoogleHtml(raw) : "";
  return rewriteDocLinks(cleaned, docUrlById);
}

function sectionIdAttr(docTypeCfg) {
  if (!docTypeCfg.sectionId) return "";
  return ` id="${docTypeCfg.sectionId}"`;
}

function assetVars(component, assets) {
  const vars = {};
  for (const [key, spec] of Object.entries(component.meta.vars ?? {})) {
    if (spec.asset) {
      vars[key] = assets[spec.asset].trim();
    }
  }
  return vars;
}

/** Google Doc HTML → section component HTML (type from site.config.json docTypes). */
export async function buildDocSection(
  doc,
  docUrlById,
  { contentDir, templates, assets, siteConfig, registry }
) {
  const docTypeCfg = docTypeConfig(siteConfig, doc);
  const sectionName = docTypeCfg.section;
  if (!sectionName) {
    throw new Error(
      `Doc type "${doc.type}" (slug "${doc.slug}") has no section — use fragment output instead`
    );
  }
  const component = registry.components.get(sectionName);

  if (!component?.html) {
    throw new Error(`Section component "${sectionName}" has no HTML template`);
  }

  let html = await loadDocHtml(doc, docUrlById, { contentDir, siteConfig });

  if (doc.type === "cv") {
    const basePath = normalizeBasePath(siteConfig.basePath ?? "/");
    html = linkSeeHereToPdf(html, cvPdfHref(siteConfig, basePath));
  }

  if (docTypeCfg.parse === "reading") {
    html = renderReadingEntries(parseReadingEntries(html));
  }

  if (docTypeCfg.parse === "studies") {
    const studies = await loadStudiesConfig();
    const basePath = normalizeBasePath(siteConfig.basePath ?? "/");
    html = renderStudiesSection(html, studies, basePath, {
      externalLinkIcon: assets["icons/external-link.svg"] ?? "",
    });
  }

  if (docTypeCfg.endmark) {
    html = applyEndmark(html, docTypeCfg.endmark);
  }

  const vars = {
    slug: doc.slug,
    sectionIdAttr: sectionIdAttr(docTypeCfg),
    content: html,
    ...assetVars(component, assets),
  };

  return renderTemplate(templates[component.html], vars);
}

export async function buildAllSections(
  docs,
  docUrlById,
  { contentDir, templates, assets, siteConfig, registry }
) {
  const sectionDocs = docs.filter((doc) => docTypeConfig(siteConfig, doc).section);
  return Object.fromEntries(
    await Promise.all(
      sectionDocs.map(async (doc) => [
        doc.slug,
        await buildDocSection(doc, docUrlById, {
          contentDir,
          templates,
          assets,
          siteConfig,
          registry,
        }),
      ])
    )
  );
}

/**
 * Docs with `docTypes.*.fragment` — cleaned HTML written under public/ (e.g. life-about.html).
 * No page shell; fetched by client scripts.
 */
export async function writeDocFragments(
  docs,
  docUrlById,
  { contentDir, siteConfig, outDir }
) {
  for (const doc of docs) {
    const fragment = docTypeConfig(siteConfig, doc).fragment;
    if (!fragment) continue;
    if (fragment.includes("..") || path.isAbsolute(fragment)) {
      throw new Error(`Invalid fragment path for slug "${doc.slug}": ${fragment}`);
    }
    const html = await loadDocHtml(doc, docUrlById, { contentDir, siteConfig });
    const dest = path.join(outDir, fragment);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, html ? `${html}\n` : "", "utf8");
  }
}
