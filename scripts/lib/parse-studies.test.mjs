import assert from "node:assert/strict";
import test from "node:test";
import { renderStudiesSection } from "./parse-studies.mjs";

const icon = '<svg class="test-ext" aria-hidden="true"></svg>';

test("renderStudiesSection groups currently then previously with one label each", () => {
  const html = renderStudiesSection(
    "<p>Intro.</p>",
    {
      courses: [
        {
          status: "previously",
          title: "Old",
          href: "https://example.com/old",
          instructor: "A",
          pdf: "old.pdf",
          repo: null,
        },
        {
          status: "currently",
          title: "Now",
          href: "https://example.com/now",
          instructor: "B",
          year: 2012,
          summary: ["First theme", "Second theme"],
          pdf: "now.pdf",
          repo: "https://github.com/x/y",
        },
        {
          status: "currently",
          title: "Also",
          href: "https://example.com/also",
          instructor: "C",
          pdf: "also.pdf",
          repo: null,
        },
      ],
    },
    "/",
    { externalLinkIcon: icon }
  );

  assert.match(html, /studies-intro/);
  assert.match(html, /Intro\./);
  assert.match(html, /B, 2012/);
  assert.match(html, /studies-card-summary/);
  assert.match(html, /<li>First theme<\/li>/);
  assert.match(html, /data-studies-pdf="\/studies\/now\.pdf"/);
  assert.match(
    html,
    /href="\/studies\/now\.pdf"[^>]*data-studies-pdf="\/studies\/now\.pdf"/
  );
  assert.match(html, /aria-label="Open Now notes"/);
  assert.match(html, /aria-haspopup="dialog"/);
  assert.match(html, /aria-labelledby="studies-group-currently"/);
  assert.match(html, /GitHub repo/);
  assert.match(html, /studies-lightbox/);
  assert.match(html, /studies-external/);
  assert.match(html, /aria-label="Open course page for Now"/);
  assert.doesNotMatch(html, /<h3 class="studies-card-title"><a href=/);
  assert.match(html, /GitHub repo <svg class="test-ext"/);
  assert.doesNotMatch(html, /studies-btn--notes[^>]*<\/button>/);

  const currentlyMatches = html.match(/>Current courses</g) ?? [];
  assert.equal(currentlyMatches.length, 1);
  const previouslyMatches = html.match(/>Previous courses</g) ?? [];
  assert.equal(previouslyMatches.length, 1);

  const nowAt = html.indexOf("Now");
  const oldAt = html.indexOf("Old");
  assert.ok(nowAt < oldAt);
});
