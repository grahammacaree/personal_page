import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";
import { fileExists } from "./fs.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

export const DRIVE_READONLY_SCOPE =
  "https://www.googleapis.com/auth/drive.readonly";
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

/** @returns {Promise<object|null>} */
export async function loadGoogleCredentials() {
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

/**
 * @param {object} credentials
 * @param {string|string[]} scopes
 */
export function createDriveClient(credentials, scopes) {
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: Array.isArray(scopes) ? scopes : [scopes],
  });
  return google.drive({ version: "v3", auth });
}
