# grahammacaree.com — site source

Source for [grahammacaree.com](https://grahammacaree.com): a static personal site whose prose lives in Google Docs and is built with a small Node pipeline.

You do **not** need this repo, Node, or Google credentials to **read** the site.

## What’s in here

| Path | Purpose |
|------|---------|
| `scripts/` | Sync (Google Drive export) and static HTML build |
| `templates/`, `site/` | Page shell, CSS, favicon, homepage nav script |
| `docs.manifest.json` | Maps each Google Doc → slug and page type |
| `site.config.json` | Site name, contact email, homepage section order |
| `.github/workflows/site.yml` | CI: sync, build, deploy to GitHub Pages |

Generated folders (`content/`, `public/`) are not committed; Actions builds `public/` on each deploy.

## Stack

Node 20+, Cheerio (HTML cleanup), Google Drive API (read-only export). No framework, no app server.

## Try the build (no Google account)

```bash
npm ci
npm run build   # needs content/ from a prior sync, or empty sections
npm run preview # build with BASE_PATH=/ and serve public/
```

A full content sync requires maintainer credentials — see [`SETUP.md`](SETUP.md).

## Maintainer docs

- [`SETUP.md`](SETUP.md) — service account, GitHub secret, Pages, custom domain
- [`GOOGLE_DOCS.md`](GOOGLE_DOCS.md) — how site content is split across Docs (authoring)
- [`SECURITY.md`](SECURITY.md) — secrets and Doc IDs

## License

All rights reserved unless otherwise noted. Site prose is not licensed for reuse from this repository.
