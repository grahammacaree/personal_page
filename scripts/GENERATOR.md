# Static site generator

This repo is a small static site generator: **Google Docs are the CMS**, `docs.manifest.json` lists each doc, `site.config.json` defines how doc types become pages and sections, and `templates/<component>/` holds HTML/CSS components discovered at build time.

## Data flow

```
Google Docs  ──sync──►  content/*.html  (raw fragments)
docs.manifest.json      slug, title, type; optional description (published pages)
site.config.json        docTypes + pageTypes + site chrome + description
templates/<name>/       component.html + component.css + component.json
assets/                 shared SVGs, etc.

        npm run build
              │
              ▼
         public/          static HTML + style.css + sitemap.xml
```

## Configuration (`site.config.json`)

Top-level fields: `name`, `email`, `basePath`, `url` (canonical origin for `sitemap.xml`), `description` (homepage `<meta name="description">` and Open Graph fallback).

### `home` — homepage route

| Field | Meaning |
|-------|---------|
| `output` | File under `public/` (usually `index.html`) |
| `pageType` | Key into `pageTypes` for chrome |
| `sections` | Manifest slugs to concatenate as the page body |

### `chrome` — shared UI wiring

| Field | Meaning |
|-------|---------|
| `components.topBar` | Template folder for the header (e.g. `site-top-bar`) |
| `components.footer` | Template folder for the footer |
| `docRefs.cv` / `docRefs.about` | Manifest `type` used to resolve nav/footer links |
| `assets.backChevron` | Asset path for the story back control |

Nav and footer URLs come from `docRefs` + `docTypes.*.publishPath` — not hardcoded in the build.

### `docTypes` — content → section → URL

Each manifest `type` must have a `docTypes` entry:

| Field | Meaning |
|-------|---------|
| `section` | Component folder wrapping synced HTML (e.g. `intro`, `document`) |
| `contentPath` | Path under `content/` (`{slug}` interpolated) |
| `publish` | If `false`, doc is only used on composed pages (e.g. homepage) |
| `publishPath` | Output path under `public/` when `publish: true` |
| `pageType` | Key into `pageTypes` for chrome when published |
| `endmark` | Append endmark to last paragraph |
| `sectionId` | Optional `id` on `<section>` |
| `sectionStyles` | Extra CSS-only components (e.g. `cv` styles on `document` markup) |

### `pageTypes` — chrome slots

Controls layout, title, nav, footer, scripts. Use `extends` to inherit (e.g. `story` extends `default` with `leftNav: "back"`).

| Field | Values / meaning |
|-------|------------------|
| `layout` | Component name (`home`, `page`) |
| `title` | `siteName` or `docTitle` |
| `bodyClass` | Optional `<body class="…">` |
| `topBarHidden` | Hide fixed top bar on load |
| `leftNav` | `brand` on homepage only; `back` on every other page (`pageTypes.default`) |
| `cvNav` | `link` or `current` |
| `aboutLink` | `true` / `false` — show About in footer |
| `scripts` | List of files under `site/` to append before `</body>` |

Rendering reads `page.pageType` and passes **booleans + URLs** into component templates; chrome markup uses a small conditional syntax (see below).

### Template syntax (`lib/html.mjs`)

| Syntax | Meaning |
|--------|---------|
| `{{name}}` | Insert string (HTML from build is trusted; escape text in `page-context` when needed) |
| `{{#name}}…{{/name}}` | Block when `name` is truthy |
| `{{^name}}…{{/name}}` | Block when `name` is falsy |

Booleans are for conditionals only — they are not emitted as text. Nested blocks are supported. Run `npm test` for examples.

## Components (`templates/<name>/`)

| File | Purpose |
|------|---------|
| `<name>/<name>.html` | Markup with `{{placeholders}}` |
| `<name>/<name>.css` | Styles (optional for CSS-only components like `cv`) |
| `component.json` | `layer` + `order` for CSS bundle; optional `vars` for asset injection |

**Layers** (CSS concat order): `foundation` → `layout` → `chrome` → `section`.

Discovery: `lib/discover-components.mjs` — no manual path registry.

### Asset vars (intro example)

`intro/component.json`:

```json
{
  "layer": "section",
  "order": 1,
  "vars": {
    "introScrollHint": { "asset": "chevrons/down.svg" }
  }
}
```

Build injects trimmed SVG into `{{introScrollHint}}` when wrapping intro content.

## Adding a published story

1. Add doc to `docs.manifest.json` (`type: "story"`, slug, title, Google Doc id, optional `description` for `<meta>` / Open Graph on published pages).
2. `docTypes.story` already defines paths and uses `pageTypes.default` (back nav).
3. Add `templates/…` only if you need a new section shape or styles.
4. `npm run site` (sync + build).

## Adding a new doc type

1. Add `docTypes.yourType` in `site.config.json`.
2. Add `pageTypes.yourType` (or reuse `default`) if published.
3. Point `section` at an existing or new component folder.
4. Add manifest entries with `type: "yourType"`.

## Build entrypoint

`scripts/build.mjs` orchestrates only:

1. Load config + discover components + load templates/assets  
2. Build sections from content  
3. Plan routes  
4. Write CSS, static files, HTML pages  

See also [`BUILD.md`](BUILD.md) for command reference.
