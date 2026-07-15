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
| `npm run studies:cloud` | reMarkable cloud (`rmapi`) → convert → local `studies/*.pdf` |
| `npm run studies:publish` | Cloud sync + upload PDFs to Drive (`studies:push` alias) |
| `npm run studies:lan` | LAN/Wi‑Fi backup + convert + Drive (manual fallback) |
| `npm run studies:sync` | LAN backup + convert only (no Drive) |
| `npm run studies:drive` | Drive only: download (default) or `--upload` |

Studies flags (pass after `--`):

```bash
npm run studies:cloud                          # cloud → studies/
npm run studies:publish                       # cloud → studies/ → Drive
bash scripts/setup-rmapi.sh                   # install + check rmapi login
npm run studies:sync -- --skip-backup         # convert from local RemarkableSync backup only
npm run studies:lan -- --skip-backup          # upload without tablet backup
npm run studies:drive                         # download Drive → studies/
npm run studies:drive -- --upload             # upload studies/ → Drive (seed files must exist)
```

Credentials: `credentials.json` in the repo root (gitignored), or `GOOGLE_APPLICATION_CREDENTIALS` / `GOOGLE_SERVICE_ACCOUNT_JSON`. Mac upload needs Drive **Editor** on the studies folder (scope `drive`); CI download can use the same secret. Cloud pull uses `rmapi` tokens under `~/Library/Application Support/rmapi/`.

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
reMarkable cloud → rmapi .rmdoc → convert → Google Drive → npm run sync (CI) → public/studies/
```

| Piece | Role |
|-------|------|
| `scripts/setup-rmapi.sh` | Install rmapi + one-time cloud login check |
| `scripts/sync-studies.sh` | `--from-cloud` (default publish) or LAN backup; optional `--publish` |
| `scripts/lib/unpack-rmdoc.py` | `.rmdoc` zip → RemarkableSync-like layout for convert |
| `scripts/studies-drive.mjs` | Drive download **or** `--upload` |
| `scripts/lib/convert-rm-notebook.py` | `rmrl` (v3/v5) + `rmc` SVG → MuPDF (v6) → JPEG compress |
| `scripts/lib/discover-remarkable.py` | LAN discovery (manual fallback) |
| `scripts/setup-remarkable-ssh.sh` | LAN SSH password → keyring (optional) |
| `scripts/launchd/….plist` | Weekdays 14:00 → `--from-cloud --publish` |

Config: `studies.config.json` (`cloudFolder`, `notebookName`, `driveFolderId`, `pdf`). Setup: [`SETUP.md` §7](../SETUP.md#7-studies-pdfs-remarkable--drive).

Without Connect, cloud may omit notebooks idle ~50d — `--from-cloud` **skips** those and keeps prior PDFs rather than failing the run. Drive upload only pushes PDFs whose bytes **changed this run**, and skips when the Drive file MD5 already matches.

**Seed files:** Google service accounts have no personal Drive storage quota, so publish **updates** files that already exist by name. Create each course PDF once in the Drive folder (exact `course.pdf` filename), then publish can replace contents.

## Key files

| Path | Role |
|------|------|
| `sync-docs.mjs` | Docs HTML export + study PDF download |
| `build.mjs` | Static site build |
| `lib/parse-studies.mjs` | Course cards + PDF lightbox markup |
| `lib/*.test.mjs`, `build.test.mjs` | Tests (`npm test`) |
