import { createWriteStream } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { PLACEHOLDER } from "./constants.mjs";
import { fileExists } from "./fs.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const exportsDir = path.resolve(__dirname, "../../exports");

/**
 * @param {unknown} siteConfig
 * @returns {{ id: string, path: string }[]}
 */
export function pdfExportsFromConfig(siteConfig) {
  const raw = siteConfig?.pdfExports;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => ({
      id: String(entry?.id ?? "").trim(),
      path: String(entry?.path ?? "").trim().replace(/^\/+/, ""),
    }))
    .filter(
      (e) =>
        e.id &&
        e.id !== PLACEHOLDER &&
        e.path &&
        e.path.endsWith(".pdf") &&
        !e.path.includes("..")
    );
}

async function writeBinaryIfChanged(filePath, buf) {
  try {
    if (await fileExists(filePath)) {
      const prev = await readFile(filePath);
      if (prev.equals(buf)) return false;
    }
  } catch {
    /* missing → write */
  }
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, buf);
  return true;
}

/**
 * Export configured Google Docs as PDFs into exports/.
 * @param {import("googleapis").drive_v3.Drive} drive
 * @param {unknown} siteConfig
 * @param {{ required?: boolean }} [opts]
 * @returns {Promise<number>} files written (changed)
 */
export async function syncPdfExports(drive, siteConfig, opts = {}) {
  const required = opts.required === true;
  const entries = pdfExportsFromConfig(siteConfig);
  if (entries.length === 0) return 0;

  await mkdir(exportsDir, { recursive: true });
  let written = 0;

  for (const entry of entries) {
    const dest = path.join(exportsDir, entry.path);
    try {
      const res = await drive.files.export(
        { fileId: entry.id, mimeType: "application/pdf" },
        { responseType: "stream" }
      );
      const tmp = `${dest}.download`;
      await mkdir(path.dirname(dest), { recursive: true });
      await pipeline(res.data, createWriteStream(tmp));
      const buf = await readFile(tmp);
      await unlink(tmp);
      const changed = await writeBinaryIfChanged(dest, buf);
      console.log(
        changed
          ? `synced pdf → exports/${entry.path}`
          : `unchanged pdf exports/${entry.path}`
      );
      if (changed) written += 1;
    } catch (err) {
      const msg = `Failed to export PDF ${entry.path} (${entry.id}): ${err.message || err}`;
      if (required) throw new Error(msg);
      console.warn(`${msg} Skipping.`);
    }
  }

  return written;
}
