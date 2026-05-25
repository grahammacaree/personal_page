# personal_page

Personal site — intro, two stories, thesis, me, CV, about. Content lives in Google Docs; this repo syncs, builds, and publishes to GitHub Pages.

## Docs

- [`SETUP.md`](SETUP.md) — Google service account, GitHub secret, Pages
- [`GOOGLE_DOCS.md`](GOOGLE_DOCS.md) — seven-doc structure and placeholder copy
- [`docs.manifest.json`](docs.manifest.json) — Doc ID → page mapping
- [`site.config.json`](site.config.json) — name, email, homepage section order, `basePath`

## Commands

```bash
npm ci
npm run sync    # export Google Docs → content/
npm run build   # content/ → public/
npm run site    # both
npm run preview # build with BASE_PATH=/, then serve public/
```

## Stack

Node scripts (Drive export + HTML cleanup), static HTML/CSS, GitHub Actions cron. No framework, no client JS.

Styles live in `site/style.css` using **native CSS nesting** (`&`, nested selectors) — Sass-like structure without a preprocessor; the build copies the file unchanged to `public/`.
