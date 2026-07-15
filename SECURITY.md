# Security

## Never commit

- `credentials.json` or any Google service-account key
- `GOOGLE_SERVICE_ACCOUNT_JSON` (use a GitHub Actions secret only)
- `.env` files with secrets

These paths are in `.gitignore`. If a key was ever committed, rotate it in Google Cloud and purge it from git history.

## `docs.manifest.json` IDs

The manifest lists Google Doc IDs so CI can export them. IDs are **not** passwords, but they identify documents. Keep each Doc shared only with people who should edit it, plus the service account used for sync (see `SETUP.md`). Do not set Docs to public unless you intend them to be.

## Study PDFs on Drive

`studies.config.json` → `remarkable.driveFolderId` points at a Drive folder of course PDFs. Share that folder only with yourself and the service account (Editor for Mac upload). Do not make the folder public; the site serves PDFs from GitHub Pages after sync, not via open Drive links.

Google **service accounts have no personal Drive storage quota**, so automated publish only **updates** existing files by name. You must create each `course.pdf` seed file once in the Drive UI (your account owns the bytes); the SA then overwrites content. See [`SETUP.md` §7](SETUP.md#7-studies-pdfs-remarkable--drive).

## Contact email

`site.config.json` includes a public `mailto:` address (same as on the live site).

## Report issues

For security concerns about this site or repo, contact the address on [grahammacaree.com](https://grahammacaree.com).
