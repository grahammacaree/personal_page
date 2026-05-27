import { copyFile, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAssets } from "./lib/assets.mjs";
import { buildAllSections } from "./lib/doc-section.mjs";
import { discoverComponents } from "./lib/discover-components.mjs";
import { planPages } from "./lib/pages.mjs";
import { buildDocUrlMap } from "./lib/rewrite-doc-links.mjs";
import { renderSitePage } from "./lib/render-site.mjs";
import { buildSiteStyles } from "./lib/styles.mjs";
import { normalizeBasePath } from "./lib/site-config.mjs";
import { loadTemplates } from "./lib/templates.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const contentDir = path.join(root, "content");
const siteDir = path.join(root, "site");
const repoAssetsDir = path.join(root, "assets");
const templatesDir = path.join(root, "templates");

const STATIC_ASSETS = ["nav.js", "CNAME", "favicon.svg", "llms.txt"];

async function main() {
  const siteConfig = JSON.parse(
    await readFile(path.join(root, "site.config.json"), "utf8")
  );
  const manifest = JSON.parse(
    await readFile(path.join(root, "docs.manifest.json"), "utf8")
  );

  const registry = await discoverComponents(templatesDir);
  const templates = await loadTemplates(templatesDir);
  const assets = await loadAssets(repoAssetsDir);

  const basePath = normalizeBasePath(
    process.env.BASE_PATH ?? siteConfig.basePath ?? "/"
  );
  const docs = manifest.documents ?? [];
  const docUrlById = buildDocUrlMap(docs, basePath, siteConfig);

  const sections = await buildAllSections(docs, docUrlById, {
    contentDir,
    templates,
    assets,
    siteConfig,
    registry,
  });

  const pages = planPages({ siteConfig, docs });

  const renderCtx = {
    basePath,
    siteConfig,
    docs,
    year: String(new Date().getFullYear()),
    sections,
    assets,
  };

  await rm(publicDir, { recursive: true, force: true });
  for (const page of pages) {
    const dir = path.dirname(page.output);
    if (dir && dir !== ".") {
      await mkdir(path.join(publicDir, dir), { recursive: true });
    }
  }

  for (const asset of STATIC_ASSETS) {
    await copyFile(path.join(siteDir, asset), path.join(publicDir, asset));
  }

  await cp(repoAssetsDir, path.join(publicDir, "assets"), { recursive: true });

  const siteCss = await buildSiteStyles(templatesDir, registry.cssOrder);
  await writeFile(path.join(publicDir, "style.css"), siteCss, "utf8");

  for (const page of pages) {
    const html = renderSitePage(templates, registry, page, renderCtx);
    await writeFile(path.join(publicDir, page.output), html, "utf8");
    console.log(`  ${page.output}`);
  }

  console.log(`built ${pages.length} pages → ${path.relative(root, publicDir)}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
