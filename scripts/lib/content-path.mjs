/** Relative path under content/ — keep in sync with sync-docs.mjs */
export function contentRelPath(doc) {
  if (doc.type === "story") return `stories/${doc.slug}.html`;
  return `${doc.slug}.html`;
}

export function publicRelPath(doc) {
  if (doc.type === "story") return `stories/${doc.slug}.html`;
  if (doc.type === "intro" || doc.type === "thesis" || doc.type === "me") {
    return null;
  }
  return `${doc.slug}.html`;
}
