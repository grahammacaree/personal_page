import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

/** Load every file under assets/; keys are relative paths (e.g. chevrons/left.svg). */
export async function loadAssets(assetsDir) {
  const assets = {};

  async function walk(dir, prefix = "") {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, rel);
      } else {
        assets[rel] = await readFile(full, "utf8");
      }
    }
  }

  await walk(assetsDir);
  return assets;
}
