import assert from "node:assert/strict";
import test from "node:test";
import {
  applyEndmark,
  applyEndmarkBeforeHr,
  applyEndmarkToLastParagraph,
} from "./endmark.mjs";

test("applyEndmarkToLastParagraph replaces terminal period with endmark", () => {
  const html = "<p>One.</p><p>Two three.</p>";
  const out = applyEndmarkToLastParagraph(html);
  assert.match(out, /endmark-container">three<button type="button" class="endmark"/);
  assert.match(out, /class="endmark-life"/);
  assert.doesNotMatch(out, /three\./);
  assert.doesNotMatch(out, /One\.<span class="endmark"/);
});

test("applyEndmarkBeforeHr marks the paragraph above the rule", () => {
  const html =
    "<p>Above all, playing in chords.</p><hr><p>Should you for any reason require a more traditional CV (dates, titles, skills etc.) please see here.</p>";
  const out = applyEndmarkBeforeHr(html);
  assert.match(out, /chords<button type="button" class="endmark"/);
  assert.doesNotMatch(out, /chords\./);
  assert.doesNotMatch(out, /here<button type="button" class="endmark"/);
  assert.match(out, /<hr>/);
});

test("applyEndmarkToLastParagraph strips trailing space before the mark", () => {
  const html = "<p>playing in chords. &nbsp;</p>";
  const out = applyEndmarkToLastParagraph(html);
  assert.match(out, /endmark-container">chords<button/);
  assert.doesNotMatch(out, /chords\./);
});

test("applyEndmark dispatches before-hr", () => {
  const html = "<p>Done.</p><hr><p>After.</p>";
  assert.match(
    applyEndmark(html, "before-hr"),
    /Done<button type="button" class="endmark"/
  );
  assert.match(
    applyEndmark(html, true),
    /After<button type="button" class="endmark"/
  );
});
