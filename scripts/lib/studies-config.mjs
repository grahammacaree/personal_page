import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PLACEHOLDER } from "./constants.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultConfigPath = path.resolve(__dirname, "../../studies.config.json");

export async function loadStudiesConfig(configPath = defaultConfigPath) {
  return JSON.parse(await readFile(configPath, "utf8"));
}

export function driveFolderIdFromConfig(studies) {
  const raw =
    studies?.remarkable?.driveFolderId ?? studies?.driveFolderId ?? "";
  return String(raw).trim();
}

export function isDriveFolderConfigured(folderId) {
  const id = folderId ?? "";
  return Boolean(id) && id !== PLACEHOLDER;
}
