# Security

## Never commit

- `credentials.json` or any Google service-account key
- `GOOGLE_SERVICE_ACCOUNT_JSON` (use a GitHub Actions secret only)
- `.env` files with secrets

These paths are in `.gitignore`. If a key was ever committed, rotate it in Google Cloud and purge it from git history.

## `docs.manifest.json` IDs

The manifest lists Google Doc IDs so CI can export them. IDs are **not** passwords, but they identify documents. Keep each Doc shared only with people who should edit it, plus the read-only service account used for deploy (see `SETUP.md`). Do not set Docs to public unless you intend them to be.

## Contact email

`site.config.json` includes a public `mailto:` address (same as on the live site).

## Report issues

For security concerns about this site or repo, contact the address on [grahammacaree.com](https://grahammacaree.com).
