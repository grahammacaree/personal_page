import { createReadStream, createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
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
  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "stream" }
  );
  await pipeline(res.data, createWriteStream(destPath));
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
    await downloadDriveFile(drive, fileId, dest);
    console.log(`synced studies/${name}`);
    written += 1;
  }
  return written;
}

/**
 * Replace existing Drive PDFs with local studies/*.pdf (seed files must already exist).
 * @returns {Promise<{ uploaded: string[] }>}
 */
export async function uploadStudiesPdfsToDrive() {
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

  const drive = createDriveClient(credentials, DRIVE_SCOPE);
  const courses = (studies.courses ?? []).filter((c) => c.pdf);
  const uploaded = [];

  for (const course of courses) {
    const name = String(course.pdf);
    const localPath = path.join(studiesDir, name);
    if (!(await fileExists(localPath))) {
      throw new Error(`Missing local PDF to upload: studies/${name}`);
    }
    await updatePdfInFolder(drive, folderId, name, localPath);
    console.log(`uploaded studies/${name} → Drive`);
    uploaded.push(name);
  }

  return { uploaded };
}
