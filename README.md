# personal_page

Personal site — intro, two stories, thesis, CV, contact. Content lives in Google Docs; this repo syncs, builds, and publishes to GitHub Pages.

## Docs

- [`SETUP.md`](SETUP.md) — Google service account, GitHub secret, Pages
- [`GOOGLE_DOCS.md`](GOOGLE_DOCS.md) — five-doc structure and placeholder copy
- [`docs.manifest.json`](docs.manifest.json) — Doc ID → page mapping
- [`site.config.json`](site.config.json) — name, tagline, contact

## Commands

```bash
npm ci
npm run sync    # export Google Docs → content/
npm run build   # content/ → public/
npm run site    # both
```

## Stack

Node scripts (Drive export + HTML cleanup), static HTML/CSS, GitHub Actions cron. No framework, no client JS.
