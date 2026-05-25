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

## 4. GitHub secrets and Pages

**Repository → Settings → Secrets and variables → Actions**

- Add secret `GOOGLE_SERVICE_ACCOUNT_JSON` — paste the **entire** JSON key file contents.

**Settings → Pages**

- **Build and deployment → Source:** GitHub Actions (not “Deploy from branch”).

After the first successful workflow run, the site is at:

`https://grahammacaree.github.io/personal_page/`

(`basePath` in `site.config.json` must match the repo name.)

## 5. Local preview

```bash
npm ci
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
# fill in docs.manifest.json first
npm run site
npx serve public
```

`content/` and `public/` are generated locally and gitignored.

## Automation

| Trigger | What happens |
|--------|----------------|
| **Push to `main`** | Sync (if secret set) → build → deploy |
| **Daily cron** (14:00 UTC) | Sync required → build → deploy |
| **Actions → Run workflow** | Same as cron — manual refresh |

Edit a doc anytime; the live site updates on the next cron run (or push, or manual workflow run). No PDF exports, no manual copy-paste.

## Security — public repo + secrets

**A public GitHub repo does not expose GitHub Actions secrets.**

| Stored where | Public? | Used for |
|--------------|---------|----------|
| `GOOGLE_SERVICE_ACCOUNT_JSON` (repo secret) | **No** — encrypted, only injected into Actions runners | Sync step on GitHub’s servers |
| Source in git (`scripts/`, templates, manifest) | **Yes** | Build logic; doc IDs are visible |
| Built site (`public/` → Pages) | **Yes** | Static HTML/CSS only — **no secrets** |

Secrets never get committed, never ship to GitHub Pages, and never appear in the static files visitors download. The published site is the same as if you’d hand-exported HTML.

**Do not commit** the downloaded JSON key. It is listed in `.gitignore` as `credentials.json`; use the repo secret (or a local path via `GOOGLE_APPLICATION_CREDENTIALS`) only.

**Blast radius if a key leaked:** the service account can only read Google Docs you explicitly shared with its email (Viewer). It cannot open your whole Drive, Gmail, etc. Rotate the key in Google Cloud and update the GitHub secret if you ever suspect exposure.

**Doc IDs in `docs.manifest.json`** are public in git. Someone could see which document IDs you use; they still cannot export those docs without access (your Google account, or the service account key).

**Fork PRs:** workflows from forks do not receive repository secrets by default, so random contributors cannot exfiltrate your key via a PR build.

**What you’re trusting:** GitHub to store secrets safely (standard CI practice), and Google’s sharing model (only shared docs are readable).
