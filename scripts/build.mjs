import { copyFile, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAssets } from "./lib/assets.mjs";
import { FAVICON_PNG_NAME, writeFaviconPng } from "./lib/favicon-png.mjs";
import { buildAllSections, writeDocFragments } from "./lib/doc-section.mjs";
import { discoverComponents } from "./lib/discover-components.mjs";
import { planPages } from "./lib/pages.mjs";
import { buildDocUrlMap } from "./lib/rewrite-doc-links.mjs";
import { renderSitePage } from "./lib/render-site.mjs";
import { buildSiteStyles } from "./lib/styles.mjs";
import { normalizeBasePath } from "./lib/site-config.mjs";
import { buildSitemapXml } from "./lib/sitemap.mjs";
import { lastModifiedForPage } from "./lib/lastmod.mjs";
import { loadTemplates } from "./lib/templates.mjs";
import { computePublishedLifeState } from "./lib/life-state.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const contentDir = path.join(root, "content");
const siteDir = path.join(root, "site");
const repoAssetsDir = path.join(root, "assets");
const templatesDir = path.join(root, "templates");

const STATIC_ASSETS = [
  "studies.js",
  "jovian.js",
  "life.js",
  "life-engine.mjs",
  "CNAME",
  "favicon.svg",
  "llms.txt",
  "robots.txt",
];

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
  const studiesDir = path.join(root, "studies");
  const studiesConfigPath = path.join(root, "studies.config.json");
  const exportsDir = path.join(root, "exports");
  for (const page of pages) {
    page.lastmod = await lastModifiedForPage(page, {
      contentDir,
      siteConfig,
      docs,
      studiesDir,
      studiesConfigPath,
      exportsDir,
    });
  }

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

  const lifeState = await computePublishedLifeState({
    siteUrl: siteConfig.url,
  });
  await writeFile(
    path.join(publicDir, "life-state.json"),
    `${JSON.stringify(lifeState)}\n`,
    "utf8"
  );
  console.log(`  life-state.json (gen ${lifeState.n})`);

  await writeDocFragments(docs, docUrlById, {
    contentDir,
    siteConfig,
    outDir: publicDir,
  });
  for (const doc of docs) {
    const fragment = siteConfig.docTypes?.[doc.type]?.fragment;
    if (fragment) console.log(`  ${fragment}`);
  }

  await writeFaviconPng(
    path.join(siteDir, "favicon.svg"),
    path.join(publicDir, FAVICON_PNG_NAME)
  );

  await cp(repoAssetsDir, path.join(publicDir, "assets"), { recursive: true });

  try {
    await cp(studiesDir, path.join(publicDir, "studies"), { recursive: true });
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }

  for (const entry of siteConfig.pdfExports ?? []) {
    const rel = String(entry?.path ?? "").trim().replace(/^\/+/, "");
    if (!rel || !rel.endsWith(".pdf") || rel.includes("..")) continue;
    const src = path.join(exportsDir, rel);
    const dest = path.join(publicDir, rel);
    try {
      await mkdir(path.dirname(dest), { recursive: true });
      await copyFile(src, dest);
      console.log(`  ${rel}`);
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }
  }

  const siteCss = await buildSiteStyles(templatesDir, registry.cssOrder);
  await writeFile(path.join(publicDir, "style.css"), siteCss, "utf8");

  for (const page of pages) {
    const html = renderSitePage(templates, registry, page, renderCtx);
    await writeFile(path.join(publicDir, page.output), html, "utf8");
    console.log(`  ${page.output}`);
  }

  const siteUrl = siteConfig.url;
  if (!siteUrl) {
    throw new Error("site.config.json must define url for sitemap.xml");
  }
  await writeFile(
    path.join(publicDir, "sitemap.xml"),
    buildSitemapXml(siteUrl, basePath, pages),
    "utf8"
  );
  console.log("  sitemap.xml");

  console.log(`built ${pages.length} pages → ${path.relative(root, publicDir)}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
