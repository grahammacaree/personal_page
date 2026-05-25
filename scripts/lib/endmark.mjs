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

/** Last <p> in doc HTML — final word in .endmark-container + square .endmark */
export function applyEndmarkToLastParagraph(html) {
  const $ = cheerio.load(`<div id="endmark-root">${html}</div>`, {
    decodeEntities: false,
  });
  const $last = $("#endmark-root > p").last();
  if (!$last.length) return html;

  const updated = wrapLastWordInParagraph($last.html() ?? "");
  $last.html(updated);
  return $("#endmark-root").html() ?? html;
}
