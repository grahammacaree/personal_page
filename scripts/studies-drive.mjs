#!/usr/bin/env node
/**
 * Study PDF ↔ Google Drive.
 *
 *   node scripts/studies-drive.mjs                          # download Drive → studies/
 *   node scripts/studies-drive.mjs --upload                 # upload all local (skip md5 match)
 *   node scripts/studies-drive.mjs --upload -- a.pdf b.pdf  # upload only these names
 */
import {
  syncStudiesPdfsFromDrive,
  uploadStudiesPdfsToDrive,
} from "./lib/sync-studies-drive.mjs";

const argv = process.argv.slice(2);
const upload = argv.includes("--upload");
const only = [];
const dash = argv.indexOf("--");
if (dash >= 0) {
  only.push(...argv.slice(dash + 1).filter(Boolean));
} else {
  // also accept bare filenames after --upload
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--upload") continue;
    if (argv[i].startsWith("-")) continue;
    only.push(argv[i]);
  }
}

const run = upload
  ? uploadStudiesPdfsToDrive(only.length ? { only } : {}).then(
      ({ uploaded, skipped }) => {
        if (uploaded.length === 0) {
          console.log(
            `Drive upload: nothing new (${skipped.length} skipped).`
          );
        } else {
          console.log(
            `Drive upload done (${uploaded.length} file(s), ${skipped.length} skipped).`
          );
        }
      }
    )
  : syncStudiesPdfsFromDrive({
      required: process.env.SYNC_REQUIRED === "true",
    }).then((n) => {
      if (n > 0) console.log(`Downloaded ${n} study PDF(s).`);
    });

run.catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
