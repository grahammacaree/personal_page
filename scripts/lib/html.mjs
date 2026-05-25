export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderTemplate(template, vars) {
  let html = template;
  for (const [key, value] of Object.entries(vars)) {
    html = html.replaceAll(`{{${key}}}`, value ?? "");
  }
  return html;
}
