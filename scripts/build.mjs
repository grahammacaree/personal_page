import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BACK_NAV_DOC_TYPES, ENDMARK_DOC_TYPES } from "./lib/constants.mjs";
import { contentRelPath, publicRelPath } from "./lib/content-path.mjs";
import { cleanGoogleHtml } from "./lib/clean-google-html.mjs";
import { applyEndmarkToLastParagraph } from "./lib/endmark.mjs";
import { escapeHtml, renderTemplate } from "./lib/html.mjs";
import {
  buildDocUrlMap,
  rewriteDocLinks,
} from "./lib/rewrite-doc-links.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const contentDir = path.join(root, "content");
const assetsDir = path.join(root, "site");

const backChevronSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"/>
  </svg>`;

function normalizeBasePath(basePath) {
  if (!basePath || basePath === "/") return "/";
  return basePath.endsWith("/") ? basePath : `${basePath}/`;
}

const introScrollHintSvg = `<svg class="intro-scroll-hint" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"/>
  </svg>`;

function siteTopBarHtml(
  basePath,
  siteName,
  email,
  { showBack = false, page = null, hideOnLoad = false } = {}
) {
  const safeName = escapeHtml(siteName);
  const contactHref = email ? `mailto:${escapeHtml(email)}` : `${basePath}#me`;
  const cvNav =
    page === "cv"
      ? `<span class="site-nav-current" aria-current="page">CV</span>`
      : `<a href="${basePath}cv.html">CV</a>`;
  const left = showBack
    ? `<a href="${basePath}" class="page-back" aria-label="Back to home">
  ${backChevronSvg}
  <span>Back</span>
</a>`
    : `<span class="site-brand">${safeName}</span>`;
  const hiddenClass = hideOnLoad ? " site-top--hidden" : "";
  return `<header class="site-top${hiddenClass}">
  <nav class="site-top-nav" aria-label="Site">
    ${left}
    <div class="site-top-nav-end">
      <a href="${contactHref}">Contact</a>
      ${cvNav}
    </div>
  </nav>
</header>`;
}

function siteFooterHtml(aboutHref, siteName, year, { page = null } = {}) {
  const aboutNav =
    page === "about"
      ? ""
      : `<a href="${aboutHref}" class="site-footer-about">About this site</a>`;
  return `<footer class="site-footer">
  <p class="site-footer-copy">© ${year} ${escapeHtml(siteName)}</p>
  ${aboutNav}
</footer>`;
}

async function readContent(relPath) {
  try {
    return await readFile(path.join(contentDir, relPath), "utf8");
  } catch {
    return "";
  }
}

async function docSection(doc, docUrlById) {
  const raw = await readContent(contentRelPath(doc));
  const cleaned = raw ? cleanGoogleHtml(raw) : "";
  let html = rewriteDocLinks(cleaned, docUrlById);
  if (ENDMARK_DOC_TYPES.has(doc.type)) {
    html = applyEndmarkToLastParagraph(html);
  }
  const idAttr =
    doc.type === "me" ? ' id="me"' : doc.type === "thesis" ? ' id="thesis"' : "";
  if (doc.type === "intro") {
    return `<section class="doc doc--${doc.slug}"${idAttr}><div class="intro-wrap"><div class="intro-body">${html}${introScrollHintSvg}<div class="intro-nav-sentinel" aria-hidden="true"></div></div></div></section>`;
  }
  return `<section class="doc doc--${doc.slug}"${idAttr}>${html}</section>`;
}

async function main() {
  const siteConfig = JSON.parse(
    await readFile(path.join(root, "site.config.json"), "utf8")
  );
  const manifest = JSON.parse(
    await readFile(path.join(root, "docs.manifest.json"), "utf8")
  );
  const template = await readFile(
    path.join(root, "templates", "page.html"),
    "utf8"
  );

  const basePath = normalizeBasePath(
    process.env.BASE_PATH ?? siteConfig.basePath ?? "/"
  );
  const docs = manifest.documents ?? [];
  const home = siteConfig.home ?? ["intro", "thesis", "me"];
  const docUrlById = buildDocUrlMap(docs, basePath);

  const aboutDoc = docs.find((d) => d.type === "about");
  const aboutRel = aboutDoc ? publicRelPath(aboutDoc) : "about-this-site.html";
  const aboutHref = `${basePath}${aboutRel}`;
  const year = String(new Date().getFullYear());
  const sections = Object.fromEntries(
    await Promise.all(
      docs.map(async (doc) => [doc.slug, await docSection(doc, docUrlById)])
    )
  );

  await rm(publicDir, { recursive: true, force: true });
  await mkdir(path.join(publicDir, "stories"), { recursive: true });
  await copyFile(
    path.join(assetsDir, "style.css"),
    path.join(publicDir, "style.css")
  );
  await copyFile(path.join(assetsDir, "nav.js"), path.join(publicDir, "nav.js"));
  await copyFile(path.join(assetsDir, "CNAME"), path.join(publicDir, "CNAME"));
  await copyFile(
    path.join(assetsDir, "favicon.svg"),
    path.join(publicDir, "favicon.svg")
  );

  const writePage = async (
    relPath,
    pageTitle,
    body,
    { back = false, home = false, page = null } = {}
  ) => {
    const documentTitle = home
      ? escapeHtml(siteConfig.name)
      : `${escapeHtml(pageTitle)} — ${escapeHtml(siteConfig.name)}`;
    await writeFile(
      path.join(publicDir, relPath),
      renderTemplate(template, {
        basePath,
        documentTitle,
        body,
        bodyClass: home ? "body--home" : "",
        siteTopBar: siteTopBarHtml(basePath, siteConfig.name, siteConfig.email, {
          showBack: back,
          page,
          hideOnLoad: home,
        }),
        siteFooter: siteFooterHtml(aboutHref, siteConfig.name, year, { page }),
        pageScript: home
          ? `<script src="${basePath}nav.js" defer></script>`
          : "",
      })
    );
  };

  const indexBody = home.map((slug) => sections[slug] ?? "").join("\n");
  await writePage("index.html", siteConfig.name, indexBody, { home: true });

  for (const doc of docs) {
    const out = publicRelPath(doc);
    if (!out) continue;
    await writePage(out, doc.title, sections[doc.slug], {
      back: BACK_NAV_DOC_TYPES.has(doc.type),
      page: doc.type,
    });
  }

  console.log(`built site → ${path.relative(root, publicDir)}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
