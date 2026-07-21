import * as cheerio from "cheerio";

function lastWordFromText(text) {
  const tokens = text.trim().split(/\s+/);
  return tokens[tokens.length - 1] ?? "";
}

function peelLastWord($, $parent, word) {
  const nodes = $parent.contents().toArray().reverse();

  for (const node of nodes) {
    if (node.type === "text") {
      const data = node.data ?? "";
      const idx = data.lastIndexOf(word);
      if (idx === -1) continue;

      const before = data.slice(0, idx);
      const wordPart = data.slice(idx);
      $(node).replaceWith(
        `${before}<span class="endmark-container">${wordPart}<span class="endmark" aria-hidden="true"></span></span>`
      );
      return true;
    }

    if (node.type === "tag") {
      if (peelLastWord($, $(node), word)) return true;
    }
  }

  return false;
}

function wrapLastWordInParagraph(innerHtml) {
  const $ = cheerio.load(`<w>${innerHtml}</w>`, { decodeEntities: false });
  const $wrap = $("w");
  const lastWord = lastWordFromText($wrap.text());
  if (!lastWord) return innerHtml;

  if (!peelLastWord($, $wrap, lastWord)) return innerHtml;
  return $wrap.html() ?? innerHtml;
}

function applyEndmarkToParagraph($p) {
  if (!$p?.length) return false;
  const updated = wrapLastWordInParagraph($p.html() ?? "");
  $p.html(updated);
  return true;
}

/** Last <p> in doc HTML — final word in .endmark-container + square .endmark */
export function applyEndmarkToLastParagraph(html) {
  const $ = cheerio.load(`<div id="endmark-root">${html}</div>`, {
    decodeEntities: false,
  });
  applyEndmarkToParagraph($("#endmark-root > p").last());
  return $("#endmark-root").html() ?? html;
}

/** Paragraph immediately before the first <hr> (e.g. CV closer after the rule). */
export function applyEndmarkBeforeHr(html) {
  const $ = cheerio.load(`<div id="endmark-root">${html}</div>`, {
    decodeEntities: false,
  });
  const $hr = $("#endmark-root > hr").first();
  if (!$hr.length) return html;

  let $prev = $hr.prev();
  while ($prev.length && $prev[0].type === "text") {
    $prev = $prev.prev();
  }
  if (!$prev.is("p")) return html;

  applyEndmarkToParagraph($prev);
  return $("#endmark-root").html() ?? html;
}

/**
 * @param {string} html
 * @param {true | "before-hr"} mode
 */
export function applyEndmark(html, mode) {
  if (mode === "before-hr") return applyEndmarkBeforeHr(html);
  if (mode) return applyEndmarkToLastParagraph(html);
  return html;
}
