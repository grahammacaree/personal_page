# Google Docs — site structure (maintainer)

**Audience:** editing site content in Drive — not required to read the public repo.

Create one Doc per row in `docs.manifest.json`. A dedicated Drive folder keeps them together.

| # | Doc title (in Drive) | Manifest slug | Type | Site URL (after deploy) |
|---|----------------------|---------------|------|-------------------------|
| 1 | Introduction | `intro` | `intro` | Homepage (`/`) only |
| 2 | Baseball Potato | `baseball-potato` | `story` | `/stories/baseball-potato.html` |
| 3 | The Dark Side of the Moon | `dark-side-of-the-moon` | `story` | `/stories/dark-side-of-the-moon.html` |
| 4 | Thesis | `thesis` | `thesis` | Homepage (`/`) only |
| 5 | CV | `cv` | `cv` | `/cv.html` |
| 6 | About this site | `about-this-site` | `about` | `/about-this-site.html` |
| 7 | Reading | `reading` | `reading` | Homepage (`/`) only — top two entries |
| 8 | Studies | `studies` | `studies` | `/studies.html` — intro + course grid |

Full paths use your `basePath`, e.g. `https://grahammacaree.com/stories/baseball-potato.html`.

Homepage section order is set in `site.config.json` → `home.sections` (`intro`, `thesis`, `reading`). Contact is a **mailto** link in the top bar (from `email` in site config), not a separate page. The top bar also links to **CV** and **Studies**.

## 1. Introduction (homepage)

The intro doc is the opening block on the homepage. Include links to both stories here — that’s the primary navigation into your work.

```
2–4 short paragraphs: who you are, what you care about in storytelling, why trust your judgement.

Stories on this site:
• Baseball Potato — link to the Baseball Potato doc
• The Dark Side of the Moon — link to that doc
```

Put contact / CV links here if you want them on the homepage (there is no separate “me” block anymore).

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

## 5. CV

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

## 6. About this site

Optional meta page: how the site is built (Google Docs → sync → static HTML). Linked from the footer. Not part of the homepage.

## 7. Reading (homepage)

Personal reading log. The site only shows the **top two entries** on the homepage (under the thesis): **Currently reading** then **Last read**. Everything below that stays in the Doc as your archive — the build ignores it.

Put the book you’re reading now at the top. When you finish it, write the note under it and add the new current book above.

```
Title
Author
[optional short line — translator, edition, etc.]

← blank line between entries

Title
Author

Review paragraphs…

← blank line

Older entries… (site ignores these)
```

**Currently reading** (first entry): title, author, and short meta lines only — review text is not shown even if present.

**Last read** (second entry): title, author, meta, plus the review paragraphs.

Separate entries with a **blank line**, a **horizontal rule**, or by using Google’s **Title / Heading** style on each book title (the build treats each heading as a new entry). Optional short lines after the author (e.g. `tr. …`) show as meta.

## 8. Studies

Intro copy for `/studies.html`. The course cards (status, title, instructor, year, summary bullets, PDF, optional repo) come from `studies.config.json` in the repo — **do not** try to layout the course grid in the Doc.

```
Title: Studies

A short paragraph or two on why you’re doing the maths courses / what this page is.
```

## Formatting rules

- **Visible title on the page:** use Google’s **Title** or **Heading 1** style on the first line. The build promotes large/bold styled lines to `<h1>` (and section headings to `<h2>` / `<h3>`). Normal body text stays `<p>`.
- **Browser tab title** comes from `docs.manifest.json` (`title` field) for pages that get their own URL (stories, CV, about, studies). Homepage tab title is `site.config.json` → `name`.
- **Search / link preview blurb:** `site.config.json` → `description` for the homepage. For stories, CV, about, and studies, optional `description` on that row in `docs.manifest.json`. Intro and thesis are homepage-only — no manifest description needed. Not synced from Google Docs.
- A strong opening line in normal text (e.g. a question hook) will correctly stay a paragraph — only styled title/heading lines become `<h1>`.
- Avoid text boxes, comments, heavy tables.
- Links and bold/italic export fine.

## After creating docs

1. Share each doc with the service account (see `SETUP.md`).
2. Paste document IDs into `docs.manifest.json`.
3. Push to `main` or run **Sync and deploy** in Actions.
