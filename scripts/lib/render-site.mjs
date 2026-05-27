import { layoutVars } from "./page-context.mjs";
import { chromeConfig } from "./site-config.mjs";
import { renderTemplate } from "./html.mjs";

function renderComponent(templates, registry, name, vars) {
  const comp = registry.components.get(name);
  if (!comp?.html) {
    throw new Error(`Component "${name}" has no ${name}/${name}.html template`);
  }
  return renderTemplate(templates[comp.html], vars);
}

/** Assemble one public HTML file: layout + chrome components, slots from page.pageType. */
export function renderSitePage(templates, registry, page, ctx) {
  const slots = layoutVars(page, ctx);
  const layoutName = page.pageType.layout;
  const { topBar: topBarComponent, footer: footerComponent } = chromeConfig(
    ctx.siteConfig
  ).components;

  return renderTemplate(templates[registry.components.get(layoutName).html], {
    basePath: slots.basePath,
    documentTitle: slots.documentTitle,
    bodyClass: slots.bodyClass,
    pageScripts: slots.pageScripts,
    body: slots.body,
    siteTopBar: renderComponent(templates, registry, topBarComponent, slots.topBar),
    siteFooter: renderComponent(templates, registry, footerComponent, slots.footer),
  });
}
