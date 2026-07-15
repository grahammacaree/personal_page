#!/usr/bin/env node
/**
 * Study PDF ↔ Google Drive.
 *
 *   node scripts/studies-drive.mjs           # download Drive → studies/ (CI / npm run sync)
 *   node scripts/studies-drive.mjs --upload  # upload studies/ → Drive (Mac publish)
 */
import {
  syncStudiesPdfsFromDrive,
  uploadStudiesPdfsToDrive,
} from "./lib/sync-studies-drive.mjs";

const upload = process.argv.includes("--upload");

const run = upload
  ? uploadStudiesPdfsToDrive().then(({ uploaded }) => {
      console.log(`Drive upload done (${uploaded.length} file(s)).`);
    })
  : syncStudiesPdfsFromDrive({
      required: process.env.SYNC_REQUIRED === "true",
    }).then((n) => {
      if (n > 0) console.log(`Downloaded ${n} study PDF(s).`);
    });

run.catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
