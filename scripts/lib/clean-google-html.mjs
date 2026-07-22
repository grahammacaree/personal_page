import * as cheerio from "cheerio";

const ALLOWED_TAGS = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "a",
  "strong",
  "em",
  "ul",
  "ol",
  "li",
  "hr",
  "br",
  "blockquote",
  "sup",
  "sub",
]);

const ALLOWED_ATTRS = {
  a: ["href"],
};

function semanticWrapFromSpanStyle(style) {
  const s = style.toLowerCase();
  if (s.includes("font-style:italic") || s.includes("font-style: italic")) {
    return "em";
  }
  if (
    s.includes("font-weight:700") ||
    s.includes("font-weight: bold") ||
    s.includes("font-weight:bold")
  ) {
    return "strong";
  }
  return null;
}

function unwrapTag($, selector, wrapTag) {
  let changed = true;
  while (changed) {
    changed = false;
    $(selector).each((_, el) => {
      changed = true;
      const $el = $(el);
      const inner = $el.html() ?? "";
      if (wrapTag) {
        $el.replaceWith(`<${wrapTag}>${inner}</${wrapTag}>`);
      } else {
        $el.replaceWith(inner);
      }
    });
  }
}

function unwrapDisallowed($) {
  let changed = true;
  while (changed) {
    changed = false;
    $("*").each((_, el) => {
      const tag = el.tagName?.toLowerCase();
      if (!tag || ALLOWED_TAGS.has(tag)) return;
      changed = true;
      const $el = $(el);
      $el.replaceWith($el.html() ?? "");
    });
  }
}

function stripAllAttributes($) {
  $("*").each((_, el) => {
    const tag = el.tagName?.toLowerCase();
    const $el = $(el);
    const keep = ALLOWED_ATTRS[tag] ?? [];
    for (const attr of Object.keys(el.attribs ?? {})) {
      if (!keep.includes(attr)) $el.removeAttr(attr);
    }
  });
}

function removeEmptyNodes($) {
  $("p, li, h1, h2, h3, h4, h5, h6, blockquote").each((_, el) => {
    const $el = $(el);
    const text = $el.text().replace(/\u00a0/g, " ").trim();
    if (!text && !$el.find("img, hr, br").length) $el.remove();
  });
}

/** Drop trailing spaces / nbsp / <br> from block contents (Google Docs residue). */
function trimTrailingWhitespace($, el) {
  let children = $(el).contents().toArray();
  while (children.length) {
    const last = children[children.length - 1];
    if (last.type === "tag" && last.tagName?.toLowerCase() === "br") {
      $(last).remove();
      children = $(el).contents().toArray();
      continue;
    }
    break;
  }
  children = $(el).contents().toArray();
  if (!children.length) return;
  const last = children[children.length - 1];
  if (last.type === "text") {
    const next = (last.data ?? "").replace(/[\s\u00a0]+$/u, "");
    if (!next) $(last).remove();
    else last.data = next;
    return;
  }
  if (last.type === "tag") {
    trimTrailingWhitespace($, last);
  }
}

function trimTrailingInBlocks($) {
  $("p, li, h1, h2, h3, h4, h5, h6, blockquote").each((_, el) => {
    trimTrailingWhitespace($, el);
  });
}

function fontSizePt(style) {
  const match = style.toLowerCase().match(/font-size:\s*(\d+(?:\.\d+)?)pt/);
  return match ? parseFloat(match[1]) : null;
}

function isBold(style) {
  return /font-weight:\s*(700|bold)/i.test(style);
}

/** Map Google Title / Heading paragraph styles to h1–h3 before attributes are stripped. */
function headingLevel(sizePt, bold) {
  if (sizePt == null) return null;
  if (sizePt >= 18 || (sizePt >= 14 && bold)) return 1;
  if (sizePt >= 13 && bold) return 2;
  if (sizePt >= 12 && bold) return 3;
  return null;
}

function promoteStyledParagraphs($) {
  $("p[style]").each((_, el) => {
    const $el = $(el);
    const style = $el.attr("style") ?? "";
    const level = headingLevel(fontSizePt(style), isBold(style));
    if (level) $el.replaceWith(`<h${level}>${$el.html()}</h${level}>`);
  });

  // Title style often wraps text in a styled span inside a plain <p>
  $("p").each((_, el) => {
    const $el = $(el);
    if ($el.attr("style")) return;
    const $span = $el.children("span[style]").first();
    if ($el.children().length !== 1 || !$span.length) return;
    const spanStyle = $span.attr("style") ?? "";
    const level = headingLevel(fontSizePt(spanStyle), isBold(spanStyle));
    if (level) $el.replaceWith(`<h${level}>${$el.html()}</h${level}>`);
  });
}

function unwrapSpans($) {
  let changed = true;
  while (changed) {
    changed = false;
    $("span").each((_, el) => {
      changed = true;
      const $el = $(el);
      const style = $el.attr("style") ?? "";
      const inner = $el.html() ?? "";
      const wrap = semanticWrapFromSpanStyle(style);
      $el.replaceWith(wrap ? `<${wrap}>${inner}</${wrap}>` : inner);
    });
  }
}

/**
 * Strip Google Docs export to semantic HTML only — tag names + href on links.
 */
export function cleanGoogleHtml(rawHtml) {
  const $ = cheerio.load(rawHtml, { decodeEntities: false });

  $("style, script, meta, link").remove();
  $("[id^='docs-internal-guid']").each((_, el) => {
    $(el).replaceWith($(el).html() ?? "");
  });

  promoteStyledParagraphs($);
  unwrapTag($, "b", "strong");
  unwrapTag($, "i", "em");
  unwrapSpans($);
  unwrapDisallowed($);
  stripAllAttributes($);
  removeEmptyNodes($);
  trimTrailingInBlocks($);

  const html = $("body").length ? $("body").html() : $.root().html();
  return (html ?? "").trim();
}
