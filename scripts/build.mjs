import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const contentDir = path.join(root, "content");
const templatesDir = path.join(root, "templates");
const assetsDir = path.join(root, "site");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function readContent(relativePath, fallbackHtml) {
  try {
    return await readFile(path.join(contentDir, relativePath), "utf8");
  } catch {
    return fallbackHtml;
  }
}

function render(template, vars) {
  let html = template;
  for (const [key, value] of Object.entries(vars)) {
    html = html.replaceAll(`{{${key}}}`, value ?? "");
  }
  return html;
}

async function loadTemplate(name) {
  return readFile(path.join(templatesDir, name), "utf8");
}

function normalizeBasePath(basePath) {
  if (!basePath || basePath === "/") return "/";
  return basePath.endsWith("/") ? basePath : `${basePath}/`;
}

function docListItem(doc, basePath, section) {
  const href = `${basePath}${section}/${doc.slug}.html`;
  const desc = doc.description
    ? `<p class="meta">${escapeHtml(doc.description)}</p>`
    : "";
  return `<li><a href="${href}">${escapeHtml(doc.title)}</a>${desc}</li>`;
}

async function main() {
  const [siteConfig, manifest, pageTemplate, articleTemplate] = await Promise.all([
    readFile(path.join(root, "site.config.json"), "utf8").then(JSON.parse),
    readFile(path.join(root, "docs.manifest.json"), "utf8").then(JSON.parse),
    loadTemplate("page.html"),
    loadTemplate("article.html"),
  ]);

  const basePath = normalizeBasePath(siteConfig.basePath ?? "/");
  const docs = manifest.documents ?? [];
  const stories = docs.filter((d) => d.type === "story");
  const thesisDoc = docs.find((d) => d.type === "thesis");

  const introFallback =
    "<p>Introduction draft coming soon — write this in your Google Doc titled <em>Introduction</em>. Link to your two stories from here.</p>";
  const introHtml = await readContent("intro.html", introFallback);

  const storyItems = stories.map((s) => docListItem(s, basePath, "stories")).join("\n");
  const thesisHref = `${basePath}thesis.html`;
  const thesisTitle = thesisDoc?.title ?? "Thesis";

  const nav = `
    <nav class="site-nav">
      <a href="${basePath}">Home</a>
      <a href="${basePath}stories/">Stories</a>
      <a href="${basePath}thesis.html">Thesis</a>
      <a href="${basePath}cv.html">CV</a>
      <a href="${basePath}contact.html">Contact</a>
    </nav>`;

  const baseVars = {
    basePath,
    siteName: escapeHtml(siteConfig.name),
    tagline: escapeHtml(siteConfig.tagline),
    nav,
    year: String(new Date().getFullYear()),
  };

  await mkdir(publicDir, { recursive: true });
  await mkdir(path.join(publicDir, "stories"), { recursive: true });
  await copyFile(
    path.join(assetsDir, "style.css"),
    path.join(publicDir, "style.css")
  );

  const indexHtml = render(pageTemplate, {
    ...baseVars,
    title: siteConfig.name,
    body: `
      <section class="intro prose">${introHtml}</section>
      <section class="featured">
        <h2>Thesis</h2>
        <p><a class="essay-link" href="${thesisHref}">${escapeHtml(thesisTitle)}</a></p>
      </section>
      <section>
        <h2>Stories</h2>
        <ul class="link-list">${storyItems}</ul>
        <p><a href="${basePath}stories/">All stories →</a></p>
      </section>`,
  });
  await writeFile(path.join(publicDir, "index.html"), indexHtml);

  const storiesIndex = render(pageTemplate, {
    ...baseVars,
    title: "Stories",
    body: `<ul class="link-list">${storyItems}</ul>`,
  });
  await writeFile(path.join(publicDir, "stories", "index.html"), storiesIndex);

  const cvFallback =
    "<p>CV draft coming soon — maintain this in your Google Doc titled <em>CV</em>.</p>";
  const cvHtml = await readContent("cv.html", cvFallback);
  await writeFile(
    path.join(publicDir, "cv.html"),
    render(pageTemplate, {
      ...baseVars,
      title: "CV",
      body: `<article class="prose cv">${cvHtml}</article>`,
    })
  );

  await writeFile(
    path.join(publicDir, "contact.html"),
    render(pageTemplate, {
      ...baseVars,
      title: "Contact",
      body: `<p class="lede">${escapeHtml(siteConfig.contact?.note ?? "")}</p>
      <p><a href="mailto:${escapeHtml(siteConfig.contact?.email ?? "")}">${escapeHtml(siteConfig.contact?.email ?? "")}</a></p>`,
    })
  );

  if (thesisDoc) {
    const thesisBody = await readContent(
      "thesis.html",
      "<p>Thesis draft in progress.</p>"
    );
    await writeFile(
      path.join(publicDir, "thesis.html"),
      render(articleTemplate, {
        ...baseVars,
        title: escapeHtml(thesisDoc.title),
        body: `<article class="prose">${thesisBody}</article>`,
        backHref: basePath,
        backLabel: "← Home",
      })
    );
  }

  for (const story of stories) {
    const storyBody = await readContent(
      `stories/${story.slug}.html`,
      `<p>Draft in progress — <em>${escapeHtml(story.title)}</em>.</p>`
    );
    await writeFile(
      path.join(publicDir, "stories", `${story.slug}.html`),
      render(articleTemplate, {
        ...baseVars,
        title: escapeHtml(story.title),
        body: `<article class="prose">${storyBody}</article>`,
        backHref: `${basePath}stories/`,
        backLabel: "← Stories",
      })
    );
  }

  console.log(`built site → ${path.relative(root, publicDir)}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
