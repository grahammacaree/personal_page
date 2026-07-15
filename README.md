# grahammacaree.com — site source

Source for [grahammacaree.com](https://grahammacaree.com): a **lightweight static site generator** whose essays live in **Google Docs** and builds to plain HTML.

You do **not** need this repo, Node, or Google credentials to **read** the site.

## What’s in here

| Path | Purpose |
|------|---------|
| `scripts/` | Sync, build, studies PDF pipeline, tests — see [`scripts/BUILD.md`](scripts/BUILD.md) |
| `site.config.json` | Generator config — `home`, `chrome`, `docTypes`, `pageTypes` |
| `docs.manifest.json` | Google Doc id, slug, title, type; optional `description` for published pages |
| `studies/` | Local PDF cache (gitignored); filled by Drive sync or tablet convert |
| `studies.config.json` | Course cards + reMarkable / Drive folder settings |
| `templates/<component>/` | One folder per component (`*.html`, `*.css`, `component.json`) |
| `assets/` | Shared SVGs (e.g. `chevrons/left.svg`) |
| `site/` | Favicon, `robots.txt`, page scripts, `CNAME`, `llms.txt` |
| `.github/workflows/site.yml` | CI: sync Docs + study PDFs, build, deploy to GitHub Pages |

Generated folders (`content/`, `public/`) and `studies/*.pdf` are not committed; Actions syncs and builds `public/` on each deploy.

## Stack

Node 20+ (CI uses 22), Cheerio (HTML cleanup), Google Drive / Docs APIs (content export + study PDF download). No framework, no app server. Study notebooks: reMarkable cloud → Mac convert → Drive folder → CI → `/studies/*.pdf`.

## Try the build (no Google account)

```bash
npm ci
npm run build   # needs content/ from a prior sync, or empty sections
npm run preview # build with BASE_PATH=/ and serve public/
```

A full content sync requires maintainer credentials — see [`SETUP.md`](SETUP.md).

## Maintainer docs

- [`scripts/BUILD.md`](scripts/BUILD.md) — npm scripts, build pipeline, studies tooling
- [`scripts/GENERATOR.md`](scripts/GENERATOR.md) — config, components, and routes
- [`SETUP.md`](SETUP.md) — service account, GitHub Pages, custom domain, reMarkable → Drive
- [`GOOGLE_DOCS.md`](GOOGLE_DOCS.md) — how site content is split across Docs (authoring)
- [`SECURITY.md`](SECURITY.md) — secrets, Doc IDs, study PDF Drive folder
- [`JOVIAN.md`](JOVIAN.md) — footer discs are Jupiter + the Galilean moons (real positions)

## License

- **Code** (generator, templates, scripts): [MIT](LICENSE)
- **Essays** (text on the live site, authored in Google Docs): all rights reserved — not licensed for reuse from this repository
