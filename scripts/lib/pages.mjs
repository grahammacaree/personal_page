import {
  homeRouteConfig,
  pageTypeForDoc,
  publishPathForDoc,
  resolvePageType,
} from "./site-config.mjs";

/**
 * Routes to write under public/ — driven by site.config.json (home route + docTypes.publishPath).
 */
export function planPages({ siteConfig, docs }) {
  const home = homeRouteConfig(siteConfig);

  const pages = [
    {
      output: home.output,
      pageType: resolvePageType(siteConfig, home.pageType),
      sectionSlugs: home.sections,
      pageTitle: null,
    },
  ];

  for (const doc of docs) {
    const output = publishPathForDoc(siteConfig, doc);
    if (!output) continue;

    pages.push({
      output,
      pageType: pageTypeForDoc(siteConfig, doc),
      sectionSlugs: [doc.slug],
      pageTitle: doc.title,
    });
  }

  return pages;
}
