# Footer: Jupiter and the Galilean moons

The hairline above the site footer is drawn in SVG. Sitting on that line are five discs: **Jupiter** in the middle, plus **Io**, **Europa**, **Ganymede**, and **Callisto** at their real projected separations as seen from Earth — **now**, on the shared wall clock.

This is the site’s **clockwork** flourish: a small homage to Galileo’s discovery of those moons, and to a universe that runs on determinate law. It pairs with the endmark terrarium ([`LIFE.md`](LIFE.md)), where Conway’s rules make an **emergent** world from the same kind of shared time. Neither is sped up for show.

There are no labels on the page — if you are reading this file, you found the explanation.

## How it works

| Piece | Role |
|-------|------|
| [`templates/site-footer/`](templates/site-footer/) | SVG orbit line + five circles |
| [`site/jovian.js`](site/jovian.js) | Meeus *Astronomical Algorithms* ch.44 (low-accuracy); live wall-clock positions |
| `site.config.json` → `chrome.scripts` | Loads `jovian.js` on every page |

Positions use Earth-view rectangular coordinates in Jupiter radii. **X** is drawn on the footer rule; **Z** (depth) sets layering — moons with **Z > 0** are placed in a group **behind** Jupiter; **Z < 0** in a group **in front**.

The diagram refreshes from `Date` (~2 Hz while the tab is visible). Real Galilean rates are slow — Io drifts only a few pixels over tens of minutes — which is correct, not a bug. `prefers-reduced-motion` freezes a single snapshot; background tabs pause.

Source for the formulas: Jean Meeus, *Astronomical Algorithms*, chapter 44 (satellites of Jupiter). Accuracy is the book’s low-accuracy set — fine for a few-pixel diagram, not for telescope pointing.

## Reading the code

Moon order in the markup and in `jovian.js` is always Io → Europa → Ganymede → Callisto (inner to outer). Class names and `data-moon` attributes use those names on purpose. Draw order at runtime is by Z, not that list order. DOM groups are only rebuilt when a moon crosses in front of / behind Jupiter; otherwise only `cx` updates.
