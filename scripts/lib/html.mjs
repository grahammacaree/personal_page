export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function isTruthy(value) {
  return value != null && value !== false && value !== "";
}

/** Innermost `{{#key}}…{{/key}}` or `{{^key}}…{{/key}}` block (no nested opens in body). */
const INNERMOST_BLOCK =
  /\{\{([#^])([a-zA-Z0-9_]+)\}\}((?:(?!\{\{[#^])[\s\S])*?)\{\{\/\2\}\}/g;

function renderConditionals(template, vars) {
  let html = template;
  let changed = true;
  while (changed) {
    changed = false;
    html = html.replace(INNERMOST_BLOCK, (_, sigil, key, body) => {
      changed = true;
      const show = sigil === "#" ? isTruthy(vars[key]) : !isTruthy(vars[key]);
      return show ? body : "";
    });
  }
  return html;
}

function interpolateVars(template, vars) {
  let html = template;
  for (const [key, value] of Object.entries(vars)) {
    if (typeof value === "boolean") continue;
    html = html.replaceAll(`{{${key}}}`, value ?? "");
  }
  return html;
}

/**
 * Component templates: `{{var}}` substitution plus conditionals.
 * - `{{#name}}…{{/name}}` when var is truthy
 * - `{{^name}}…{{/name}}` when var is falsy
 * Booleans are for conditionals only (not printed as text).
 */
export function renderTemplate(template, vars) {
  return interpolateVars(renderConditionals(template, vars), vars);
}
