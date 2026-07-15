import { createReadStream, createWriteStream } from "node:fs";
import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { PLACEHOLDER } from "./constants.mjs";
import {
  createDriveClient,
  DRIVE_READONLY_SCOPE,
  DRIVE_SCOPE,
  loadGoogleCredentials,
} from "./drive-auth.mjs";
import { fileExists } from "./fs.mjs";
import {
  driveFolderIdFromConfig,
  isDriveFolderConfigured,
  loadStudiesConfig,
} from "./studies-config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const studiesDir = path.join(root, "studies");

async function md5File(filePath) {
  const buf = await readFile(filePath);
  return createHash("md5").update(buf).digest("hex");
}

/**
 * @param {import("googleapis").drive_v3.Drive} drive
 * @param {string} folderId
 * @param {string} name
 */
export async function findFileInFolder(drive, folderId, name) {
  const escaped = String(name).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const res = await drive.files.list({
    q: `'${folderId}' in parents and name = '${escaped}' and trashed = false`,
    fields: "files(id, name)",
    spaces: "drive",
    pageSize: 10,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const files = res.data.files ?? [];
  return files[0] ?? null;
}

/**
 * Update an existing Drive PDF (must already exist — SA has no My Drive quota for create).
 * @param {import("googleapis").drive_v3.Drive} drive
 * @param {string} folderId
 * @param {string} name
 * @param {string} localPath
 */
export async function updatePdfInFolder(drive, folderId, name, localPath) {
  const existing = await findFileInFolder(drive, folderId, name);
  if (!existing?.id) {
    throw new Error(
      `No Drive file named "${name}" in the studies folder. ` +
        `Service accounts cannot create files in personal Drive (no storage quota) — ` +
        `upload a seed PDF with that exact name in the Drive UI once, then re-run publish.`
    );
  }
  await drive.files.update({
    fileId: existing.id,
    media: {
      mimeType: "application/pdf",
      body: createReadStream(localPath),
    },
    supportsAllDrives: true,
  });
  return existing.id;
}

/**
 * @param {import("googleapis").drive_v3.Drive} drive
 * @param {string} fileId
 * @param {string} destPath
 */
export async function downloadDriveFile(drive, fileId, destPath) {
  await mkdir(path.dirname(destPath), { recursive: true });
  const tmpPath = `${destPath}.download`;
  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "stream" }
  );
  await pipeline(res.data, createWriteStream(tmpPath));
  try {
    if (await fileExists(destPath)) {
      const { readFile } = await import("node:fs/promises");
      const [a, b] = await Promise.all([
        readFile(destPath),
        readFile(tmpPath),
      ]);
      if (a.equals(b)) {
        const { unlink } = await import("node:fs/promises");
        await unlink(tmpPath);
        return false;
      }
    }
    const { rename } = await import("node:fs/promises");
    await rename(tmpPath, destPath);
    return true;
  } catch (err) {
    const { unlink } = await import("node:fs/promises");
    await unlink(tmpPath).catch(() => {});
    throw err;
  }
}

/**
 * Download course PDFs from Drive into studies/.
 * @param {{ required?: boolean }} [opts]
 * @returns {Promise<number>} number of files written
 */
export async function syncStudiesPdfsFromDrive(opts = {}) {
  const required = Boolean(opts.required);
  const studies = await loadStudiesConfig();
  const folderId = driveFolderIdFromConfig(studies);
  const courses = (studies.courses ?? []).filter((c) => c.pdf);

  if (!isDriveFolderConfigured(folderId)) {
    console.log(
      "studies.config.json remarkable.driveFolderId not set — skipping study PDF sync."
    );
    return 0;
  }

  if (courses.length === 0) {
    return 0;
  }

  const credentials = await loadGoogleCredentials();
  if (!credentials) {
    const msg =
      "No Google credentials for study PDF sync (credentials.json or GOOGLE_*).";
    if (required) {
      throw new Error(msg);
    }
    console.warn(`${msg} Skipping.`);
    return 0;
  }

  const drive = createDriveClient(credentials, DRIVE_READONLY_SCOPE);
  await mkdir(studiesDir, { recursive: true });

  let written = 0;
  for (const course of courses) {
    const name = String(course.pdf);
    const dest = path.join(studiesDir, name);
    let fileId = course.driveFileId ? String(course.driveFileId).trim() : "";
    if (!fileId || fileId === PLACEHOLDER) {
      const found = await findFileInFolder(drive, folderId, name);
      if (!found?.id) {
        const msg = `Study PDF not found in Drive folder: ${name}`;
        if (required) {
          throw new Error(msg);
        }
        console.warn(`${msg} — skipping.`);
        continue;
      }
      fileId = found.id;
    }
    const wrote = await downloadDriveFile(drive, fileId, dest);
    console.log(
      wrote ? `synced studies/${name}` : `unchanged studies/${name}`
    );
    if (wrote) written += 1;
  }
  return written;
}

/**
 * Replace existing Drive PDFs with local studies/*.pdf (seed files must already exist).
 * Skips missing locals and files whose MD5 already matches Drive.
 * @param {{ only?: string[] }} [opts] — if set, only these filenames (e.g. just-converted)
 * @returns {Promise<{ uploaded: string[], skipped: string[] }>}
 */
export async function uploadStudiesPdfsToDrive(opts = {}) {
  const studies = await loadStudiesConfig();
  const folderId = driveFolderIdFromConfig(studies);
  if (!isDriveFolderConfigured(folderId)) {
    throw new Error(
      "Set remarkable.driveFolderId in studies.config.json (Drive folder shared with the service account)."
    );
  }

  const credentials = await loadGoogleCredentials();
  if (!credentials) {
    throw new Error(
      "No Google credentials (credentials.json or GOOGLE_SERVICE_ACCOUNT_JSON)."
    );
  }

  const only = opts.only?.length
    ? new Set(opts.only.map((n) => String(n)))
    : null;

  const drive = createDriveClient(credentials, DRIVE_SCOPE);
  const courses = (studies.courses ?? []).filter((c) => c.pdf);
  const uploaded = [];
  const skipped = [];

  for (const course of courses) {
    const name = String(course.pdf);
    if (only && !only.has(name)) {
      continue;
    }
    const localPath = path.join(studiesDir, name);
    if (!(await fileExists(localPath))) {
      console.warn(
        `skip upload studies/${name} — no local file (cloud miss or not converted yet)`
      );
      skipped.push(name);
      continue;
    }

    const existing = await findFileInFolder(drive, folderId, name);
    if (!existing?.id) {
      console.warn(
        `skip upload studies/${name} — no seeded Drive file with that name`
      );
      skipped.push(name);
      continue;
    }

    const localMd5 = await md5File(localPath);
    const remote = await drive.files.get({
      fileId: existing.id,
      fields: "id, md5Checksum, modifiedTime",
      supportsAllDrives: true,
    });
    const remoteMd5 = remote.data.md5Checksum || "";
    if (remoteMd5 && remoteMd5 === localMd5) {
      console.log(`unchanged on Drive: ${name} (md5 match) — skip`);
      skipped.push(name);
      continue;
    }

    await updatePdfInFolder(drive, folderId, name, localPath);
    console.log(`uploaded studies/${name} → Drive`);
    uploaded.push(name);
  }

  return { uploaded, skipped };
}
