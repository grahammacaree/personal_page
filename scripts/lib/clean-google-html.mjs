import * as cheerio from "cheerio";

/**
 * Strip Google Docs export cruft; keep semantic structure for site CSS.
 */
export function cleanGoogleHtml(rawHtml) {
  const $ = cheerio.load(rawHtml, { decodeEntities: false });

  $("style, script, meta, link").remove();
  $("[id^='docs-internal-guid']").each((_, el) => {
    const $el = $(el);
    $el.replaceWith($el.html() ?? "");
  });

  $("span").each((_, el) => {
    const $el = $(el);
    const style = ($el.attr("style") ?? "").toLowerCase();
    const hasMeaning =
      style.includes("font-weight:700") ||
      style.includes("font-weight:bold") ||
      style.includes("font-style:italic") ||
      style.includes("text-decoration:underline");
    if (!hasMeaning && $el.children().length === 0) {
      $el.replaceWith($el.text());
    }
  });

  $("p, li, h1, h2, h3, h4").each((_, el) => {
    $(el).removeAttr("style class id");
  });

  const body = $("body").length ? $("body").html() : $.root().html();
  return (body ?? "").trim();
}
