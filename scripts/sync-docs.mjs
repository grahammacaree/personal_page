import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanGoogleHtml } from "./lib/clean-google-html.mjs";
import { PLACEHOLDER } from "./lib/constants.mjs";
import {
  createDriveClient,
  DRIVE_READONLY_SCOPE,
  loadGoogleCredentials,
} from "./lib/drive-auth.mjs";
import { contentPathForDoc } from "./lib/site-config.mjs";
import { syncStudiesPdfsFromDrive } from "./lib/sync-studies-drive.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "docs.manifest.json");
const siteConfigPath = path.join(root, "site.config.json");
const contentDir = path.join(root, "content");

function contentPathFor(doc, siteConfig) {
  return path.join(contentDir, contentPathForDoc(siteConfig, doc));
}

async function exportDoc(drive, doc, siteConfig) {
  const res = await drive.files.export(
    { fileId: doc.id, mimeType: "text/html" },
    { responseType: "text" }
  );
  const cleaned = cleanGoogleHtml(res.data);
  const outPath = contentPathFor(doc, siteConfig);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${cleaned}\n`, "utf8");
  console.log(`synced ${doc.slug} → ${path.relative(root, outPath)}`);
}

function syncRequired() {
  return process.env.SYNC_REQUIRED === "true";
}

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const siteConfig = JSON.parse(await readFile(siteConfigPath, "utf8"));
  const docs = manifest.documents ?? [];
  const configured = docs.filter((d) => d.id && d.id !== PLACEHOLDER);
  const required = syncRequired();

  const credentials = await loadGoogleCredentials();
  if (!credentials) {
    const msg =
      "No Google credentials (GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS).";
    if (required) {
      console.error(msg);
      process.exit(1);
    }
    console.warn(`${msg} Skipping sync.`);
    return;
  }

  if (configured.length === 0) {
    const msg =
      "No Google Doc IDs configured yet — add IDs to docs.manifest.json.";
    if (required) {
      console.error(msg);
      process.exit(1);
    }
    console.log(msg);
  } else {
    const drive = createDriveClient(credentials, DRIVE_READONLY_SCOPE);
    await Promise.all(
      docs.map(async (doc) => {
        if (!doc.id || doc.id === PLACEHOLDER) {
          console.log(`skip ${doc.slug} (placeholder ID)`);
          return;
        }
        await exportDoc(drive, doc, siteConfig);
      })
    );
  }

  await syncStudiesPdfsFromDrive({ required });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
