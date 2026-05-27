import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";
import { cleanGoogleHtml } from "./lib/clean-google-html.mjs";
import { PLACEHOLDER } from "./lib/constants.mjs";
import { fileExists } from "./lib/fs.mjs";
import { contentPathForDoc } from "./lib/site-config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "docs.manifest.json");
const siteConfigPath = path.join(root, "site.config.json");
const contentDir = path.join(root, "content");

async function loadCredentials() {
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (inline) {
    return JSON.parse(inline);
  }
  const credPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ??
    (await fileExists(path.join(root, "credentials.json"))
      ? path.join(root, "credentials.json")
      : null);
  if (credPath) {
    return JSON.parse(await readFile(credPath, "utf8"));
  }
  return null;
}

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

  const credentials = await loadCredentials(); // env, or ./credentials.json in repo root
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
      await exportDoc(drive, doc, siteConfig);
    })
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
