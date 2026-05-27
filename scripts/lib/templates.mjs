import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

/** Load every .html under templates/; keys are relative paths (e.g. home/home.html). */
export async function loadTemplates(templatesDir) {
  const templates = {};

  async function walk(dir, prefix = "") {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, rel);
      } else if (entry.name.endsWith(".html")) {
        templates[rel] = await readFile(full, "utf8");
      }
    }
  }

  await walk(templatesDir);
  return templates;
}
