import { readFile } from "node:fs/promises";
import path from "node:path";

/** Join discovered component CSS into public/style.css. */
export async function buildSiteStyles(templatesDir, cssOrder) {
  const chunks = [];

  for (const rel of cssOrder) {
    const full = path.join(templatesDir, rel);
    let content;
    try {
      content = (await readFile(full, "utf8")).trim();
    } catch (err) {
      if (err.code === "ENOENT") {
        throw new Error(`Missing style part: ${rel}`);
      }
      throw err;
    }
    if (!content) continue;
    chunks.push(`/* ${rel} */\n${content}`);
  }

  return `${chunks.join("\n\n")}\n`;
}
