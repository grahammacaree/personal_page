import assert from "node:assert/strict";
import test from "node:test";
import { parseReadingEntries, renderReadingEntries } from "./parse-reading.mjs";
import { cleanGoogleHtml } from "./clean-google-html.mjs";

const sampleBlank = `
<p>The History of Early Rome</p>
<p>Titus Livius</p>
<p>tr. Aubrey de Sélincourt</p>
<p><br></p>
<p>Bartleby, the Scrivener</p>
<p>Herman Melville</p>
<p><br></p>
<p>One of the most highly-regarded and certainly the most famous of Melville’s short stories.</p>
<p>This is a bizarre psychological exploration of alienation.</p>
<p><br></p>
<p>Some Older Book</p>
<p>Someone Else</p>
<p>Notes that should not appear on the site.</p>
`;

const sampleHeadings = `
<h2>The History of Early Rome</h2>
<p>Titus Livius</p>
<p>tr. Aubrey de Sélincourt</p>
<h2>Bartleby, the Scrivener</h2>
<p>Herman Melville</p>
<p>One of the most highly-regarded and certainly the most famous of Melville’s short stories.</p>
<p>This is a bizarre psychological exploration of alienation.</p>
`;

test("keeps only the top two entries (blank separators)", () => {
  const entries = parseReadingEntries(sampleBlank);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].label, "Currently reading");
  assert.equal(entries[1].label, "Last read");
  assert.equal(entries[0].title, "The History of Early Rome");
  assert.equal(entries[1].title, "Bartleby, the Scrivener");
});

test("splits on headings from Google Title/Heading styles", () => {
  const entries = parseReadingEntries(sampleHeadings);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].title, "The History of Early Rome");
  assert.deepEqual(entries[0].meta, ["tr. Aubrey de Sélincourt"]);
  assert.equal(entries[0].notesHtml, "");
  assert.equal(entries[1].title, "Bartleby, the Scrivener");
  assert.match(entries[1].notesHtml, /highly-regarded/);
});

test("currently reading has meta but no notes", () => {
  const [current] = parseReadingEntries(sampleBlank);
  assert.deepEqual(current.meta, ["tr. Aubrey de Sélincourt"]);
  assert.equal(current.notesHtml, "");
  assert.equal(current.author, "Titus Livius");
});

test("last read includes notes and strips later entries", () => {
  const [, last] = parseReadingEntries(sampleBlank);
  assert.equal(last.author, "Herman Melville");
  assert.match(last.notesHtml, /highly-regarded/);
  assert.match(last.notesHtml, /psychological exploration/);
  assert.doesNotMatch(last.notesHtml, /should not appear/);
});

test("renderReadingEntries emits labels and structure", () => {
  const html = renderReadingEntries(parseReadingEntries(sampleHeadings));
  assert.match(html, /section-label section-label--inline/);
  assert.match(html, /entry-title/);
  assert.match(html, /reading-notes/);
});

test("hr also separates entries", () => {
  const html = `
<p>Book A</p>
<p>Author A</p>
<hr>
<p>Book B</p>
<p>Author B</p>
<p>A long review paragraph that counts as notes for the finished book because it goes on a bit.</p>
`;
  const entries = parseReadingEntries(html);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].title, "Book A");
  assert.equal(entries[1].title, "Book B");
  assert.match(entries[1].notesHtml, /long review/);
});

test("synced reading.html shape parses into two homepage entries", () => {
  // Mirror of content/reading.html after sync (content/ is gitignored — CI never has it).
  const synced = `<h2>The History of Early Rome</h2><p>Titus Livius</p><p>tr. Aubrey de Sélincourt</p><h2>Bartleby, the Scrivener</h2><p>Herman Melville</p><p>One of the most highly-regarded and certainly the most famous of Melville’s short stories. The titular Bartleby shows up in a prissy lawyer’s office and becomes an ever-present scribe while doing less and less work, on account of preferring not to. </p><p>This is a bizarre psychological exploration of alienation, and if you’ll forgive the heresy I don’t think it’s as good as its reputation. We don’t get the depth we need for a character sketch of Bartleby, and although the narrator is fleshed out he’s weak and lazy, which is not enormously interesting.</p><p>It’s still good, because it’s Melville, but it reads more like a call for help than a <em>great</em>&nbsp;short story. Send Herman (and Bartleby) to sea post-haste.</p>
`;
  const entries = parseReadingEntries(cleanGoogleHtml(synced));
  assert.equal(entries.length, 2);
  assert.equal(entries[0].title, "The History of Early Rome");
  assert.equal(entries[1].title, "Bartleby, the Scrivener");
  assert.equal(entries[0].notesHtml, "");
  assert.match(entries[1].notesHtml, /Melville/);
});
