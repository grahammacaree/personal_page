import sharp from "sharp";

export const FAVICON_PNG_NAME = "favicon-48.png";
export const FAVICON_PNG_SIZE = 48;

/** Rasterize site/favicon.svg for Google Search and legacy clients. */
export async function writeFaviconPng(svgPath, outPath) {
  await sharp(svgPath)
    .resize(FAVICON_PNG_SIZE, FAVICON_PNG_SIZE)
    .png()
    .toFile(outPath);
}
