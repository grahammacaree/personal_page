# Setup — automated Google Docs → GitHub Pages

Visitors see a static site. You edit Google Docs; a daily cron (and every push to `main`) exports them, builds HTML, and deploys.

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

The build copies `site/CNAME` into `public/CNAME` so GitHub Pages knows the custom hostname.

1. **GitHub** — repo **Settings → Pages → Custom domain** → enter `grahammacaree.com` → Save. Enable **Enforce HTTPS** when DNS has propagated.
2. **DNS** (at your registrar), for the apex domain GitHub expects **A** records (not a CNAME on `@`):

   | Type | Name | Value |
   |------|------|--------|
   | A | `@` | `185.199.108.153` |
   | A | `@` | `185.199.109.153` |
   | A | `@` | `185.199.110.153` |
   | A | `@` | `185.199.111.153` |

3. Optional **www** — add `CNAME` `www` → `grahammacaree.github.io`, then set that host as a second custom domain or redirect in GitHub/DNS.

After DNS propagates, the site is served at the domain root; internal links use `basePath: "/"` from `site.config.json`.

### Ongoing deploys (no manual steps)

| You do | GitHub does |
|--------|-------------|
| Push to `main` | Runs **Sync and deploy** → new site |
| Wait for daily cron | Same |
| **Actions → Run workflow** | Same (handy after editing a Doc) |

### If something fails

- **Actions** tab → failed run → read the `build` or `deploy` log.  
- No workflow listed? `.github/workflows/site.yml` isn’t on `main` yet.  
- `build` ok, `deploy` pending? Approve the **github-pages** environment.  
- Pages URL 404? Wait a minute after first green deploy; check **Settings → Pages** for the exact link.

## 6. Local preview

Production builds use `basePath: "/"` (same as `grahammacaree.com`). `npm run preview` also sets `BASE_PATH=/` when serving locally.

**Use the preview script** (builds with `BASE_PATH=/` so links and CSS match localhost):

```bash
npm ci
export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/credentials.json"
npm run site          # optional: sync + production-path build
npm run preview       # build for localhost, then serve
```

Open the URL `serve` prints (usually `http://localhost:3000`).

Production deploys use `basePath` from `site.config.json` (`/`) — do not set `BASE_PATH` in the workflow unless you are testing a subpath build.

`content/` and `public/` are generated locally and gitignored.

Site styles are plain CSS with [native nesting](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_nesting) in `site/style.css` — no Sass or PostCSS step.

## 7. Automation

| Trigger | What happens |
|--------|----------------|
| **Push to `main`** | Sync (if secret set) → build → deploy |
| **Daily cron** (14:00 UTC) | Sync required → build → deploy |
| **Actions → Run workflow** | Same as cron — manual refresh |

Edit a doc anytime; the live site updates on the next cron run (or push, or manual workflow run). No PDF exports, no manual copy-paste.