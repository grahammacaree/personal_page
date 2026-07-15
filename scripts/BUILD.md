# Scripts

Commands and what they call. Generator architecture lives in [`GENERATOR.md`](GENERATOR.md); one-time maintainer setup in [`../SETUP.md`](../SETUP.md).

## npm scripts

| Command | What it does |
|---------|----------------|
| `npm run sync` | Google Docs → `content/*.html` **and** study PDFs from Drive → `studies/*.pdf` |
| `npm run build` | `content/` + config + templates → `public/` (copies `studies/` into the artifact) |
| `npm run site` | `sync` then `build` |
| `npm run preview` | `BASE_PATH=/` build + serve `public/` (localhost) |
| `npm test` | Unit tests under `scripts/` and `scripts/lib/` |
| `npm run studies:sync` | Tablet backup → convert → local `studies/*.pdf` |
| `npm run studies:publish` | Same as sync, then upload PDFs to Drive (`--push` is an alias) |
| `npm run studies:drive` | Drive only: download (default) or `--upload` |

Studies flags (pass after `--`):

```bash
npm run studies:sync -- --skip-backup       # convert from local RemarkableSync backup only
npm run studies:publish -- --skip-backup    # upload without tablet backup
npm run studies:drive                       # download Drive → studies/
npm run studies:drive -- --upload           # upload studies/ → Drive (seed files must exist)
```

Credentials: `credentials.json` in the repo root (gitignored), or `GOOGLE_APPLICATION_CREDENTIALS` / `GOOGLE_SERVICE_ACCOUNT_JSON`. Mac upload needs Drive **Editor** on the studies folder (scope `drive`); CI download can use the same secret.

## Site pipeline (`build.mjs`)

1. Load `site.config.json`, `docs.manifest.json`
2. Discover `templates/*` + CSS order
3. Load templates + `assets/`
4. Build sections (`lib/doc-section.mjs`) — including `parse: "studies"` / `"reading"`
5. Plan pages (`lib/pages.mjs`)
6. Concat CSS → `public/style.css`
7. Copy `site/` static files, `assets/`, and `studies/*.pdf` → `public/`
8. Render pages + `sitemap.xml`

`content/`, `public/`, and `studies/*.pdf` are generated/gitignored. Actions syncs Docs + PDFs from Drive, then builds `public/`.

## Studies (reMarkable → Drive → Actions)

```
reMarkable → Mac convert → Google Drive folder → npm run sync (CI) → public/studies/
```

| Piece | Role |
|-------|------|
| `scripts/sync-studies.sh` | Backup → convert → optional `--publish` / `--push` |
| `scripts/studies-drive.mjs` | Drive download **or** `--upload` (one CLI, two modes) |
| `scripts/lib/sync-studies-drive.mjs` | Shared Drive find/update/download helpers |
| `scripts/lib/studies-config.mjs` | Load `studies.config.json` + folder id helpers |
| `scripts/lib/drive-auth.mjs` | Shared Google credential / Drive client |
| `scripts/lib/convert-rm-notebook.py` | `rmrl` (v3/v5) + `rmc` (v6) → JPEG compress |
| `scripts/lib/discover-remarkable.py` | LAN discovery (`wifiHost: "auto"`) |
| `scripts/setup-remarkable-ssh.sh` | One-time SSH password → keyring |
| `scripts/launchd/….plist` | Weekdays 14:00 → `--publish` |

Config: `studies.config.json` (`remarkable.driveFolderId`, course `pdf` names). Cards/summaries stay in config; intro from the Google Doc. Setup: [`SETUP.md` §7](../SETUP.md#7-studies-pdfs-remarkable--drive).

**Seed files:** Google service accounts have no personal Drive storage quota, so publish **updates** files that already exist by name. Create each course PDF once in the Drive folder (exact `course.pdf` filename), then the Mac agent can replace contents daily.

## Key files

| Path | Role |
|------|------|
| `sync-docs.mjs` | Docs HTML export + study PDF download |
| `build.mjs` | Static site build |
| `lib/parse-studies.mjs` | Course cards + PDF lightbox markup |
| `lib/*.test.mjs`, `build.test.mjs` | Tests (`npm test`) |
