# Google Docs — your five-doc structure

Create one Doc per row in `docs.manifest.json`. Suggested Drive folder: `personal_site/`

| # | Doc title (in Drive) | Manifest slug | Site URL (after deploy) |
|---|----------------------|---------------|-------------------------|
| 1 | Introduction | `intro` | Homepage (`/`) |
| 2 | Baseball Potato | `baseball-potato` | `/stories/baseball-potato.html` |
| 3 | The Dark Side of the Moon | `dark-side-of-the-moon` | `/stories/dark-side-of-the-moon.html` |
| 4 | Thesis | `thesis` | `/thesis.html` |
| 5 | CV | `cv` | `/cv.html` |

Full paths use your `basePath`, e.g. `https://grahammacaree.github.io/personal_page/stories/baseball-potato.html`.

## 1. Introduction (homepage)

The intro doc **is** the homepage body. Include links to both stories here — that’s the primary navigation into your work.

```
[Your name or leave untitled — page title comes from site config]

2–4 short paragraphs: who you are, what you care about in storytelling, why trust your judgement.

Stories on this site:
• Baseball Potato — link to …/stories/baseball-potato.html
• The Dark Side of the Moon — link to …/stories/dark-side-of-the-moon.html

Optional: one line pointing to the thesis essay.
```

**Linking from Google Docs:** Insert → Link → paste the full story URL (after first deploy you’ll know the exact paths). Relative links from Docs export unreliably.

The built site also lists stories and thesis below the intro — duplicate nav is fine; the intro links are what readers see first.

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

## 4. Thesis

```
[Working title]

One-sentence thesis — the claim this essay defends.

## Problem
What’s under-examined in how stories get told?

## Argument
3–5 sections (outline OK today).

## Close
What should the reader think or do differently?
```

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

## Formatting rules

- Page titles on the site come from `docs.manifest.json`, not the Doc title in Drive.
- Use **Heading 2** for sections; normal text for body.
- Avoid text boxes, comments, heavy tables.
- Links and bold/italic export fine.

## After creating docs

1. Share each doc with the service account (see `SETUP.md`).
2. Paste document IDs into `docs.manifest.json`.
3. Push to `main` or run **Sync and deploy** in Actions.
