import { readFile } from "node:fs/promises";
import path from "node:path";
import { cleanGoogleHtml } from "./clean-google-html.mjs";
import { applyEndmarkToLastParagraph } from "./endmark.mjs";
import { renderTemplate } from "./html.mjs";
import { rewriteDocLinks } from "./rewrite-doc-links.mjs";
import { contentPathForDoc, docTypeConfig } from "./site-config.mjs";

async function readContent(contentDir, relPath) {
  try {
    return await readFile(path.join(contentDir, relPath), "utf8");
  } catch {
    return "";
  }
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
  const component = registry.components.get(sectionName);

  if (!component?.html) {
    throw new Error(`Section component "${sectionName}" has no HTML template`);
  }

  const raw = await readContent(contentDir, contentPathForDoc(siteConfig, doc));
  const cleaned = raw ? cleanGoogleHtml(raw) : "";
  let html = rewriteDocLinks(cleaned, docUrlById);

  if (docTypeCfg.endmark) {
    html = applyEndmarkToLastParagraph(html);
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
  return Object.fromEntries(
    await Promise.all(
      docs.map(async (doc) => [
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
