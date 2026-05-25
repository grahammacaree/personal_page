# Google Docs — site structure

Create one Doc per row in `docs.manifest.json`. Suggested Drive folder: `personal_site/`

| # | Doc title (in Drive) | Manifest slug | Type | Site URL (after deploy) |
|---|----------------------|---------------|------|-------------------------|
| 1 | Introduction | `intro` | `intro` | Homepage (`/`) only |
| 2 | Baseball Potato | `baseball-potato` | `story` | `/stories/baseball-potato.html` |
| 3 | The Dark Side of the Moon | `dark-side-of-the-moon` | `story` | `/stories/dark-side-of-the-moon.html` |
| 4 | Thesis | `thesis` | `thesis` | Homepage (`/`) only |
| 5 | me | `me` | `me` | Homepage (`/`) only |
| 6 | CV | `cv` | `cv` | `/cv.html` |
| 7 | About this site | `about-this-site` | `about` | `/about-this-site.html` |

Full paths use your `basePath`, e.g. `https://grahammacaree.github.io/personal_page/stories/baseball-potato.html`.

Homepage section order is set in `site.config.json` (`home`: `intro`, `thesis`, `me`). Contact is a **mailto** link in the top bar (from `email` in site config), not a separate page.

## 1. Introduction (homepage)

The intro doc is the opening block on the homepage. Include links to both stories here — that’s the primary navigation into your work.

```
2–4 short paragraphs: who you are, what you care about in storytelling, why trust your judgement.

Stories on this site:
• Baseball Potato — link to the Baseball Potato doc
• The Dark Side of the Moon — link to that doc
```

**Linking between your docs:** In Google Docs, use **Insert → Link** and pick another doc (or paste its `docs.google.com/document/d/…` URL). On build, those URLs are rewritten to the correct site paths using the ids in `docs.manifest.json` — no need to hand-maintain `github.io` URLs in the doc. External links pasted via Google’s redirect wrapper are cleaned to the real URL at build time.

## 2. Baseball Potato

```
[Working title: Baseball Potato*]

Hook — scene, image, or question.

## Notes
Bullets, fragments, research links.

## Draft
[Prose when ready]
```

## 3. The Dark Side of the Moon

```
[Working title: The Dark Side of the Moon]

Hook.

## Notes
Bullets, fragments.

## Draft
[Prose when ready]
```

## 4. Thesis (homepage)

```
[Working title optional]

One-sentence thesis — the claim this piece defends.

## Problem
What’s under-examined in how stories get told?

## Argument
3–5 sections (outline OK today).

## Close
What should the reader think or do differently?
```

The build adds a square **endmark** after the last word of the final paragraph on thesis and story pages.

## 5. me (homepage)

Short closing block: who you are, invitation to get in touch, link to CV. Use a **mailto** link for email (same address as `site.config.json` → `email`).

```
My name is … I collect stories. … get in touch … check out my CV.
```

## 6. CV

```
# Name
One-line positioning statement.

## Experience
Role — Organisation — dates
Impact in one line per role.

## Selected work
Bullets with outcomes where possible.

## Skills / interests
Short; only what you’d stand behind in conversation.
```

Use Google heading styles so the build maps sections to `<h2>` (sections), `<h4>` (employer), `<h5>` (role). See formatting rules below.

## 7. About this site

Optional meta page: how the site is built (Google Docs → sync → static HTML). Linked from the footer. Not part of the homepage.

## Formatting rules

- **Visible title on the page:** use Google’s **Title** or **Heading 1** style on the first line. The build promotes large/bold styled lines to `<h1>` (and section headings to `<h2>` / `<h3>`). Normal body text stays `<p>`.
- **Browser tab title** comes from `docs.manifest.json` (`title` field) for pages that get their own URL (stories, CV, about). Homepage tab title is `site.config.json` → `name`.
- A strong opening line in normal text (e.g. a question hook) will correctly stay a paragraph — only styled title/heading lines become `<h1>`.
- Avoid text boxes, comments, heavy tables.
- Links and bold/italic export fine.

## After creating docs

1. Share each doc with the service account (see `SETUP.md`).
2. Paste document IDs into `docs.manifest.json`.
3. Push to `main` or run **Sync and deploy** in Actions.
