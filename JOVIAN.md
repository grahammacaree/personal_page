# Footer: Jupiter and the Galilean moons

The hairline above the site footer is drawn in SVG. Sitting on that line are five discs: **Jupiter** in the middle, plus **Io**, **Europa**, **Ganymede**, and **Callisto** at their real projected separations (as seen from Earth at page load).

This is intentional, not random decoration. There are no labels on the page — if you are reading this file, you found the explanation.

## How it works

| Piece | Role |
|-------|------|
| [`templates/site-footer/`](templates/site-footer/) | SVG orbit line + five circles |
| [`site/jovian.js`](site/jovian.js) | Meeus *Astronomical Algorithms* ch.44 (low-accuracy); places moons once on load |
| `site.config.json` → `chrome.scripts` | Loads `jovian.js` on every page |

Positions use Earth-view rectangular coordinates in Jupiter radii. **X** is drawn on the footer rule; **Z** (depth) sets SVG paint order — moons nearer than Jupiter (Z &lt; 0) sit in front; farther ones (Z &gt; 0) go behind. Values are sampled once when the page loads (and re-laid-out on window resize). Nothing animates.

Source for the formulas: Jean Meeus, *Astronomical Algorithms*, chapter 44 (satellites of Jupiter). Accuracy is the book’s low-accuracy set — fine for a few-pixel diagram, not for telescope pointing.

## Reading the code

Moon order in the markup and in `jovian.js` is always Io → Europa → Ganymede → Callisto (inner to outer). Class names and `data-moon` attributes use those names on purpose. Draw order at runtime is by Z, not that list order.