import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDocUrlMap,
  cvPdfHref,
  linkSeeHereToPdf,
  rewriteDocLinks,
} from "./rewrite-doc-links.mjs";

test("linkSeeHereToPdf wraps bare here in the CV closer", () => {
  const html =
    "<p>Should you for any reason require a more traditional CV (dates, titles, skills etc.) please see here.</p>";
  assert.equal(
    linkSeeHereToPdf(html, "/cv.pdf"),
    '<p>Should you for any reason require a more traditional CV (dates, titles, skills etc.) please see <a href="/cv.pdf">here</a>.</p>'
  );
});

test("linkSeeHereToPdf ignores other please-see-here phrases", () => {
  const html = "<p>For more, please see here.</p>";
  assert.equal(linkSeeHereToPdf(html, "/cv.pdf"), html);
});

test("linkSeeHereToPdf leaves existing link alone", () => {
  const html =
    '<p>Should you for any reason require a more traditional CV (dates, titles, skills etc.) please see <a href="/cv.pdf">here</a>.</p>';
  assert.equal(linkSeeHereToPdf(html, "/cv.pdf"), html);
});

test("buildDocUrlMap includes pdfExports", () => {
  const map = buildDocUrlMap([], "/", {
    pdfExports: [{ id: "pdf-doc-id", path: "cv.pdf" }],
  });
  assert.equal(map.get("pdf-doc-id"), "/cv.pdf");
});

test("rewriteDocLinks maps printable CV Doc to pdf", () => {
  const map = buildDocUrlMap([], "/", {
    pdfExports: [{ id: "pdf-doc-id", path: "cv.pdf" }],
  });
  const html =
    '<p>please see <a href="https://docs.google.com/document/d/pdf-doc-id/edit">here</a>.</p>';
  assert.match(
    rewriteDocLinks(html, map),
    /href="\/cv\.pdf"/
  );
});

test("cvPdfHref prefers cv.pdf", () => {
  assert.equal(
    cvPdfHref(
      {
        pdfExports: [
          { id: "a", path: "other.pdf" },
          { id: "b", path: "cv.pdf" },
        ],
      },
      "/"
    ),
    "/cv.pdf"
  );
});
