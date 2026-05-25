import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";
import { cleanGoogleHtml } from "./lib/clean-google-html.mjs";
import { PLACEHOLDER } from "./lib/constants.mjs";
import { contentRelPath } from "./lib/content-path.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "docs.manifest.json");
const contentDir = path.join(root, "content");

function loadCredentials() {
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (inline) {
    return JSON.parse(inline);
  }
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath) {
    return readFile(credPath, "utf8").then(JSON.parse);
  }
  return null;
}

function contentPathFor(doc) {
  return path.join(contentDir, contentRelPath(doc));
}

async function exportDoc(drive, doc) {
  const res = await drive.files.export(
    { fileId: doc.id, mimeType: "text/html" },
    { responseType: "text" }
  );
  const cleaned = cleanGoogleHtml(res.data);
  const outPath = contentPathFor(doc);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${cleaned}\n`, "utf8");
  console.log(`synced ${doc.slug} → ${path.relative(root, outPath)}`);
}

function syncRequired() {
  return process.env.SYNC_REQUIRED === "true";
}

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const docs = manifest.documents ?? [];
  const configured = docs.filter((d) => d.id && d.id !== PLACEHOLDER);

  if (configured.length === 0) {
    const msg =
      "No Google Doc IDs configured yet — add IDs to docs.manifest.json.";
    if (syncRequired()) {
      console.error(msg);
      process.exit(1);
    }
    console.log(msg);
    return;
  }

  const credentials = await loadCredentials();
  if (!credentials) {
    const msg =
      "No Google credentials (GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS).";
    if (syncRequired()) {
      console.error(msg);
      process.exit(1);
    }
    console.warn(`${msg} Skipping sync.`);
    return;
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  const drive = google.drive({ version: "v3", auth });

  await Promise.all(
    docs.map(async (doc) => {
      if (!doc.id || doc.id === PLACEHOLDER) {
        console.log(`skip ${doc.slug} (placeholder ID)`);
        return;
      }
      await exportDoc(drive, doc);
    })
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
