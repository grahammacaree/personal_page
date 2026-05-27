import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileExists } from "./fs.mjs";

const LAYER_RANK = { foundation: 0, layout: 1, chrome: 2, section: 3 };

/** @typedef {{ layer: string, order: number, vars?: Record<string, { asset: string }> }} ComponentMeta */

/**
 * Scan templates/<name>/ for component.html, component.css, component.json.
 * CSS bundle order: foundation → layout → chrome → section (order field, then name).
 */
export async function discoverComponents(templatesDir) {
  const entries = await readdir(templatesDir, { withFileTypes: true });
  const components = new Map();

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

    const name = entry.name;
    const dir = path.join(templatesDir, name);
    const meta = await readComponentMeta(dir, name);
    const htmlPath = `${name}/${name}.html`;
    const cssPath = `${name}/${name}.css`;

    const hasHtml = await fileExists(path.join(templatesDir, htmlPath));
    const hasCss = await fileExists(path.join(templatesDir, cssPath));

    components.set(name, {
      name,
      html: hasHtml ? htmlPath : null,
      css: hasCss ? cssPath : null,
      meta,
    });
  }

  const cssOrder = [...components.values()]
    .filter((c) => c.css)
    .sort(compareComponents)
    .map((c) => c.css);

  return { components, cssOrder };
}

async function readComponentMeta(dir, name) {
  const metaPath = path.join(dir, "component.json");
  try {
    const raw = await readFile(metaPath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new Error(
        `templates/${name}/component.json is required (layer + order for CSS bundle)`
      );
    }
    throw err;
  }
}

function compareComponents(a, b) {
  const layerA = LAYER_RANK[a.meta.layer] ?? 99;
  const layerB = LAYER_RANK[b.meta.layer] ?? 99;
  if (layerA !== layerB) return layerA - layerB;
  const orderA = a.meta.order ?? 0;
  const orderB = b.meta.order ?? 0;
  if (orderA !== orderB) return orderA - orderB;
  return a.name.localeCompare(b.name);
}
