/** Replace `{slug}`-style placeholders in config path strings. */
export function interpolatePath(pattern, doc) {
  return pattern.replace(/\{(\w+)\}/g, (_, key) => doc[key] ?? "");
}

export function normalizeBasePath(basePath) {
  if (!basePath || basePath === "/") return "/";
  return basePath.endsWith("/") ? basePath : `${basePath}/`;
}

export function chromeConfig(siteConfig) {
  const chrome = siteConfig.chrome;
  if (!chrome?.components?.topBar || !chrome?.components?.footer) {
    throw new Error(
      "site.config.json chrome.components must define topBar and footer component names"
    );
  }
  return chrome;
}

export function homeRouteConfig(siteConfig) {
  const home = siteConfig.home;
  if (!home?.output || !home?.pageType || !home?.sections) {
    throw new Error(
      "site.config.json home must define output, pageType, and sections"
    );
  }
  return home;
}

export function docTypeConfig(siteConfig, doc) {
  const cfg = siteConfig.docTypes?.[doc.type];
  if (!cfg) {
    throw new Error(`Unknown doc type "${doc.type}" for slug "${doc.slug}" — add to site.config.json docTypes`);
  }
  return cfg;
}

export function contentPathForDoc(siteConfig, doc) {
  return interpolatePath(docTypeConfig(siteConfig, doc).contentPath, doc);
}

export function publishPathForDoc(siteConfig, doc) {
  const cfg = docTypeConfig(siteConfig, doc);
  if (!cfg.publish) return null;
  if (!cfg.publishPath) {
    throw new Error(`docTypes.${doc.type} has publish: true but no publishPath`);
  }
  return interpolatePath(cfg.publishPath, doc);
}

/** Published URL for a manifest doc type listed under chrome.docRefs (e.g. cv, about). */
export function publishedDocHref(siteConfig, docs, basePath, refKey) {
  const manifestType = siteConfig.chrome?.docRefs?.[refKey];
  if (!manifestType) return "";

  const doc = docs.find((d) => d.type === manifestType);
  if (!doc) return "";

  const rel = publishPathForDoc(siteConfig, doc);
  if (!rel) return "";

  return `${normalizeBasePath(basePath)}${rel}`;
}

/** Same as publishedDocHref using build render context. */
export function publishedDocHrefFromCtx(ctx, refKey) {
  return publishedDocHref(ctx.siteConfig, ctx.docs, ctx.basePath, refKey);
}

/** pageTypes + docTypes chrome overrides (e.g. story → leftNav back). */
export function pageTypeForDoc(siteConfig, doc) {
  const docCfg = docTypeConfig(siteConfig, doc);
  const pageType = resolvePageType(siteConfig, docCfg.pageType ?? "default");
  if (docCfg.leftNav) {
    return { ...pageType, leftNav: docCfg.leftNav };
  }
  return pageType;
}

/** Merge pageTypes.* with optional extends chain. */
export function resolvePageType(siteConfig, typeName) {
  const types = siteConfig.pageTypes ?? {};
  const def = types[typeName];
  if (!def) {
    throw new Error(`Unknown pageType "${typeName}" — add to site.config.json pageTypes`);
  }
  if (def.extends) {
    const { extends: parent, ...rest } = def;
    const resolved = { ...resolvePageType(siteConfig, parent), ...rest };
    delete resolved.extends;
    return resolved;
  }
  const resolved = { ...def };
  delete resolved.extends;
  return resolved;
}

/** Homepage URL for a built page (respects basePath and nested publish paths). */
export function homePageHref(page, { siteConfig, basePath }) {
  const base = normalizeBasePath(basePath);
  const homeOut = homeRouteConfig(siteConfig).output;
  const depth = page.output.split("/").length - 1;
  if (base !== "/" || depth === 0) {
    return `${base}${homeOut}`;
  }
  return `${"../".repeat(depth)}${homeOut}`;
}
