# Setup (maintainer)

**Audience:** you, redeploying or forking this pipeline — not general visitors to [grahammacaree.com](https://grahammacaree.com).

Visitors see a static site. You edit Google Docs; a daily cron (and every push to `main`) exports them, builds HTML, and deploys.

See [`SECURITY.md`](SECURITY.md) for secrets and Doc sharing. Commands: [`scripts/BUILD.md`](scripts/BUILD.md).

## 1. Google Cloud service account

1. Open [Google Cloud Console](https://console.cloud.google.com/) → create or pick a project.
2. **APIs & Services → Library** → enable **Google Drive API**.
3. **IAM & Admin → Service Accounts** → create a service account (e.g. `personal-site-sync`).
4. **Keys** → Add key → JSON → download the file. Keep it private.
5. Copy the service account email (looks like `…@….iam.gserviceaccount.com`).

## 2. Share your docs with the service account

For each Google Doc listed in `docs.manifest.json`, click **Share** and add the service account email as **Viewer**.

You can share a single Drive folder instead if you prefer — the account only needs read access to the docs you export.

## 3. Doc IDs in `docs.manifest.json`

Open each doc. The URL looks like:

`https://docs.google.com/document/d/DOCUMENT_ID/edit`

Paste `DOCUMENT_ID` into the matching `"id"` field (replace `PLACEHOLDER`).

## 4. Deploy with GitHub Actions (not the suggested templates)

### What you’re looking at in Settings → Pages

With **Source: GitHub Actions** selected, GitHub shows suggested starters (“GitHub Pages Jekyll”, “Static HTML”). **Ignore those.** Do not click **Configure** on them.

This repo already ships its own workflow:

`.github/workflows/site.yml` — **Sync and deploy**

That file is the entire deploy pipeline. Pushing it to `main` is what registers the workflow.

### What “GitHub Actions” as the Pages source means

It does **not** mean “pick a template from the dropdown.” It means:

> Only workflows that publish a Pages artifact may deploy this site.

Our workflow does exactly that:

1. **build** job — checkout repo → `npm ci` → sync Google Docs → `npm run build` → upload the `public/` folder as a Pages artifact  
2. **deploy** job — take that artifact and publish it to GitHub Pages (`actions/deploy-pages`)

You never commit `public/` to git. Actions builds it fresh each run.

### Step-by-step (first deploy)

1. **Push the repo to `main`**  
   Ensure `.github/workflows/site.yml` is on GitHub (it lives in this project).

2. **Settings → Pages → Build and deployment**  
   - **Source:** `GitHub Actions` (you’ve done this)  
   - Leave the Jekyll / Static HTML suggestions alone.

3. **Settings → Secrets and variables → Actions**  
   - New repository secret: `GOOGLE_SERVICE_ACCOUNT_JSON`  
   - Value: entire service-account JSON file (see §1).  
   - Until doc IDs and this secret exist, push builds still run but skip sync and use placeholders.

4. **Run the workflow once**  
   - **Actions** tab → **Sync and deploy** (left sidebar) → **Run workflow** → Run on `main`  
   - Or push any commit to `main` (that also triggers it).

5. **Watch the run**  
   - Open the run → two jobs: `build` then `deploy`  
   - Both should be green.  
   - First time, GitHub may ask you to approve the **github-pages** environment on the `deploy` job — approve it.

6. **Open the site**  
   - **Settings → Pages** shows the live URL when deploy succeeds.  
   - Production URL: `https://grahammacaree.com` (after DNS — see §5).  
   - `basePath` in `site.config.json` is `/` for the custom domain.

## 5. Custom domain (`grahammacaree.com`)

The build copies `site/CNAME` into `public/CNAME` so GitHub Pages knows the custom hostname. (With Actions publishing, the domain is owned in **Settings → Pages**; keep `site/CNAME` in sync anyway.)

1. **GitHub** — repo **Settings → Pages → Custom domain** → enter `grahammacaree.com` → Save. Enable **Enforce HTTPS** when DNS has propagated.
2. **DNS** (at your registrar), for the apex domain GitHub expects **A** records (not a CNAME on `@`):

   | Type | Name | Value |
   |------|------|--------|
   | A | `@` | `185.199.108.153` |
   | A | `@` | `185.199.109.153` |
   | A | `@` | `185.199.110.153` |
   | A | `@` | `185.199.111.153` |

   Optional matching **AAAA**s (GitHub’s documented IPv6 set) and `www` → `CNAME` → `grahammacaree.github.io`.

After DNS propagates, the site is served at the domain root; internal links use `basePath: "/"` from `site.config.json`.

### Ongoing deploys

| You do | GitHub does |
|--------|-------------|
| Push to `main` | **Sync and deploy** → new site |
| Daily cron (14:00 UTC) | Same (sync required) |
| **Actions → Run workflow** | Same (handy after editing a Doc) |

### If something fails

- **Actions** tab → failed run → `build` or `deploy` log.
- No workflow listed? `.github/workflows/site.yml` isn’t on `main` yet.
- `build` ok, `deploy` pending? Approve the **github-pages** environment.
- Pages URL 404? Wait a minute after first green deploy; check **Settings → Pages**.
- Site intermittently unreachable / TLS hangs to `185.199.*` while `github.com` works? Often a **VPN** or flaky route to the Pages/Fastly edge — try without VPN before debugging DNS.

## 6. Local preview

```bash
npm ci
# credentials.json in repo root (gitignored), or GOOGLE_APPLICATION_CREDENTIALS
npm run site      # optional: sync + build
npm run preview   # BASE_PATH=/ build + serve public/
```

Full command list: [`scripts/BUILD.md`](scripts/BUILD.md). Styles: component CSS under `templates/` ([`scripts/GENERATOR.md`](scripts/GENERATOR.md)) → `public/style.css`.

## 7. Studies PDFs (reMarkable → Drive)

Handwritten notebooks convert on the Mac, upload to a **Google Drive folder**, then Actions syncs them into `studies/` at build time (same pattern as Docs). Lightbox URLs stay `/studies/*.pdf` on your domain. Cards/summaries: `studies.config.json`. Intro: Google Doc. **Commands:** [`scripts/BUILD.md`](scripts/BUILD.md#studies-remarkable--drive--actions).

**Stack:** RemarkableSync → `rmrl`/`rmc` hybrid convert → Drive **update** (existing names) → `npm run sync` in CI. Tune `pdfDpi` / `pdfJpegQuality` in config.

### One-time Drive setup

1. Create a Drive folder (e.g. `grahammacaree.com / studies-pdfs`).
2. Share it with the service account as **Editor**.
3. Paste the folder id into `studies.config.json` → `remarkable.driveFolderId` (from the folder URL `…/folders/FOLDER_ID`).
4. **Seed each course PDF** in that folder with the **exact** filename from `studies.config.json` (`course.pdf`). Upload any PDF in the Drive UI (empty/stub is fine). Service accounts cannot *create* files in personal Drive (no My Drive quota); publish only **replaces** matching names.
5. Ensure local `credentials.json` / the `GOOGLE_SERVICE_ACCOUNT_JSON` secret can use Drive (upload uses `https://www.googleapis.com/auth/drive`; CI download uses readonly).

### Adding a new course later

1. Add the course + `pdf` / `notebookUuid` in `studies.config.json`.
2. Seed a same-named PDF in the Drive folder (step 4 above).
3. Run `npm run studies:publish` (or wait for the LaunchAgent).

### One-time tablet / LaunchAgent

1. RemarkableSync + rmrl in `~/Library/Application Support/remarkablesync/venv/`
2. `bash scripts/setup-remarkable-ssh.sh`
3. `"wifiHost": "auto"` and notebooks under `remarkable.tabletFolder` (default `Studies`)
4. Install / reload the LaunchAgent (weekdays **14:00** local → `--publish`, before Actions cron ~15:00 BST):

```bash
cp scripts/launchd/com.grahammacaree.sync-studies.plist ~/Library/LaunchAgents/
launchctl unload ~/Library/LaunchAgents/com.grahammacaree.sync-studies.plist 2>/dev/null || true
launchctl load ~/Library/LaunchAgents/com.grahammacaree.sync-studies.plist
```

5. (Optional) Install [`gh`](https://cli.github.com/) if you want to trigger **Actions → Sync and deploy** manually after an off-schedule publish. Publish does **not** kick Actions automatically.

### Daily flow

1. LaunchAgent (or `npm run studies:publish`): tablet backup → convert → upload Drive.
2. Actions daily cron: sync Docs + PDFs → build → Pages.

`studies/*.pdf` are gitignored — never commit them.
