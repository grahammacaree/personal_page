import { escapeHtml } from "./html.mjs";

export { loadStudiesConfig } from "./studies-config.mjs";

const STATUS_HEAD = {
  currently: "Current",
  previously: "Completed",
};

function groupLabel(status, count) {
  const head = STATUS_HEAD[status];
  if (!head) return escapeHtml(status);
  return `${head} ${count === 1 ? "course" : "courses"}`;
}

function externalLink(href, icon, label) {
  if (!href) return "";
  return `<a class="studies-external" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(label)}">${icon}</a>`;
}

function courseCard(course, basePath, icon) {
  const titleRaw = String(course.title ?? "");
  const titleText = escapeHtml(titleRaw);
  const courseLink = externalLink(
    course.href,
    icon,
    `Open course page for ${titleRaw}`
  );
  const instructor = escapeHtml(course.instructor ?? "");
  const year =
    course.year != null && course.year !== ""
      ? escapeHtml(String(course.year))
      : "";
  const byline =
    instructor || year
      ? `<p class="entry-byline studies-card-byline">${
          instructor
            ? `<span class="entry-author">${instructor}</span>`
            : ""
        }${year ? ` (${year})` : ""}</p>`
      : "";
  const pdfHref = `${basePath}studies/${escapeHtml(course.pdf)}`;
  const notesLabel = escapeHtml(`Open ${titleRaw} notes`);
  const summaryItems = (course.summary ?? [])
    .map((item) => String(item).trim())
    .filter(Boolean);
  const summary = summaryItems.length
    ? `<ul class="studies-card-summary">${summaryItems
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join("")}</ul>`
    : "";
  const repo = course.repo
    ? `<a class="studies-btn" href="${escapeHtml(course.repo)}" target="_blank" rel="noopener noreferrer">GitHub repo ${icon}</a>`
    : "";

  return `<article class="studies-card">
  <h3 class="entry-title">${titleText}${courseLink ? ` ${courseLink}` : ""}</h3>
  ${byline}
  <div class="studies-card-actions">
    <a class="studies-btn studies-btn--notes" href="${pdfHref}" data-studies-pdf="${pdfHref}" data-studies-title="${titleText}" aria-label="${notesLabel}" aria-haspopup="dialog">Notes</a>
    ${repo}
  </div>
  ${summary}
</article>`;
}

function courseGroup(status, courses, basePath, icon) {
  if (!courses.length) return "";
  const label = groupLabel(status, courses.length);
  const labelId = `studies-group-${status}`;
  const solo = courses.length === 1 ? " studies-grid--solo" : "";
  const cards = courses.map((c) => courseCard(c, basePath, icon)).join("\n");
  return `<section class="studies-group" aria-labelledby="${labelId}">
  <h2 class="section-label section-label--band" id="${labelId}">${label}</h2>
  <div class="studies-grid${solo}">
${cards}
  </div>
</section>`;
}

/**
 * Intro HTML (optional Google Doc) + course grid from studies.config.json.
 * @param {string} introHtml cleaned intro markup (may be empty)
 * @param {{ courses: object[], description?: string }} studies
 * @param {string} basePath
 * @param {{ externalLinkIcon?: string }} [opts]
 */
export function renderStudiesSection(introHtml, studies, basePath, opts = {}) {
  const icon = (opts.externalLinkIcon ?? "").trim();
  const currently = (studies.courses ?? []).filter((c) => c.status === "currently");
  const previously = (studies.courses ?? []).filter((c) => c.status === "previously");

  const groups = [
    courseGroup("currently", currently, basePath, icon),
    courseGroup("previously", previously, basePath, icon),
  ]
    .filter(Boolean)
    .join("\n");

  const intro = introHtml.trim()
    ? `<div class="studies-intro">${introHtml}</div>`
    : "";

  return `${intro}
${groups}
<dialog class="studies-lightbox" aria-labelledby="studies-lightbox-title">
  <div class="studies-lightbox-bar">
    <p class="studies-lightbox-title" id="studies-lightbox-title"></p>
    <div class="studies-lightbox-actions">
      <a class="studies-btn studies-lightbox-open" target="_blank" rel="noopener noreferrer">Open PDF</a>
      <button type="button" class="studies-btn studies-lightbox-close">Close</button>
    </div>
  </div>
  <iframe class="studies-lightbox-frame" title="Course notes PDF"></iframe>
</dialog>`;
}
