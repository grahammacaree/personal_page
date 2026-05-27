# Build commands

| Command | What it does |
|---------|----------------|
| `npm run sync` | Google Drive → `content/` (HTML fragments per doc) |
| `npm run build` | `content/` + config + templates → `public/` |
| `npm run site` | sync then build |

## Pipeline (`scripts/build.mjs`)

1. Load `site.config.json`, `docs.manifest.json`
2. Discover `templates/*` components + CSS order
3. Load HTML templates + `assets/`
4. Build sections (`lib/doc-section.mjs`) — `docTypes` → section components
5. Plan pages (`lib/pages.mjs`) — `home` + published docs
6. Concat CSS → `public/style.css`
7. Copy `site/`, `assets/` → `public/`
8. Render each page (`lib/render-site.mjs`) — `pageTypes` → layout slots

**Generator model, config, and components:** [`GENERATOR.md`](GENERATOR.md)
