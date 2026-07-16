import * as cheerio from "cheerio";
import { escapeHtml } from "./html.mjs";

const META_MAX = 80;
const META_PATTERN =
  /^(tr\.|trans\.|translated|ed\.|edited|illus\.|vol\.|volume)(\s|$)/i;

function textOf($, el) {
  return $(el).text().replace(/\u00a0/g, " ").trim();
}

function isHeading(el) {
  const tag = el.tagName?.toLowerCase();
  return tag === "h1" || tag === "h2" || tag === "h3";
}

function isSeparator($, el) {
  const tag = el.tagName?.toLowerCase();
  if (tag === "hr") return true;
  if (tag !== "p") return false;
  return !textOf($, el);
}

function isMetaLine(text) {
  if (!text || text.length > META_MAX) return false;
  return META_PATTERN.test(text);
}

function looksLikeTitleAuthorPair($, a, b) {
  if (!a || !b) return false;
  if (isHeading(a)) return true;
  const ta = textOf($, a);
  const tb = textOf($, b);
  if (!ta || !tb) return false;
  if (isMetaLine(ta)) return false;
  return ta.length <= META_MAX && tb.length <= META_MAX;
}

/**
 * Split cleaned reading-log HTML into entries.
 * New entries start at headings, or at a blank/<hr> followed by another title+author pair.
 * Blank lines before review paragraphs stay inside the same entry.
 */
export function parseReadingEntries(html, { limit = 2 } = {}) {
  if (!html?.trim()) return [];

  const $ = cheerio.load(`<div id="reading-root">${html}</div>`, {
    decodeEntities: false,
  });

  const nodes = $("#reading-root").children().toArray();
  const entries = [];
  let i = 0;

  while (i < nodes.length && entries.length < limit) {
    while (i < nodes.length && isSeparator($, nodes[i])) i += 1;
    if (i >= nodes.length) break;

    const titleEl = nodes[i++];
    const title = textOf($, titleEl);
    while (i < nodes.length && isSeparator($, nodes[i])) i += 1;
    const authorEl = i < nodes.length ? nodes[i++] : null;
    const author = authorEl ? textOf($, authorEl) : "";

    const meta = [];
    const notes = [];

    while (i < nodes.length) {
      const el = nodes[i];

      if (isHeading(el)) break;

      if (isSeparator($, el)) {
        let j = i + 1;
        while (j < nodes.length && isSeparator($, nodes[j])) j += 1;
        if (j >= nodes.length) {
          i = j;
          break;
        }
        if (isHeading(nodes[j])) {
          i = j;
          break;
        }
        const next = nodes[j];
        const next2 = nodes[j + 1];
        if (looksLikeTitleAuthorPair($, next, next2)) {
          i = j;
          break;
        }
        i = j;
        continue;
      }

      const text = textOf($, el);
      if (!text) {
        i += 1;
        continue;
      }

      if (notes.length === 0 && isMetaLine(text)) {
        meta.push(text);
      } else if (isHeading(el)) {
        notes.push(`<p>${escapeHtml(text)}</p>`);
      } else {
        notes.push($.html(el));
      }
      i += 1;
    }

    const showNotes = entries.length > 0 && notes.length > 0;
    entries.push({
      title,
      author,
      meta,
      notesHtml: showNotes ? notes.join("\n") : "",
      label: entries.length === 0 ? "Currently reading" : "Last read",
    });
  }

  return entries;
}

/** Render parsed entries to section inner HTML. */
export function renderReadingEntries(entries) {
  if (!entries.length) return "";

  return entries
    .map((entry) => {
      const meta = entry.meta
        .map((line) => `<span class="entry-meta">${escapeHtml(line)}</span>`)
        .join("");
      const byline =
        entry.author || meta
          ? `<p class="entry-byline">${
              entry.author
                ? `<span class="entry-author">${escapeHtml(entry.author)}</span>`
                : ""
            }${meta}</p>`
          : "";
      const notes = entry.notesHtml
        ? `<div class="reading-notes">\n${entry.notesHtml}\n</div>`
        : "";

      return `<div class="reading-entry">
  <h2 class="section-label section-label--inline">${escapeHtml(entry.label)}</h2>
  ${entry.title ? `<p class="entry-title">${escapeHtml(entry.title)}</p>` : ""}
  ${byline}
  ${notes}
</div>`;
    })
    .join("\n");
}
