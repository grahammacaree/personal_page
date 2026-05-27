import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { publishPathForDoc } from "./lib/site-config.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function runBuild() {
  return new Promise((resolve, reject) => {
    const child = spawn("node", ["scripts/build.mjs"], {
      cwd: root,
      stdio: "pipe",
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `build exited ${code}`));
    });
  });
}

test("build writes core public artifacts", async () => {
  const siteConfig = JSON.parse(
    await readFile(path.join(root, "site.config.json"), "utf8")
  );
  const manifest = JSON.parse(
    await readFile(path.join(root, "docs.manifest.json"), "utf8")
  );

  await runBuild();

  await access(path.join(root, "public/index.html"));
  await access(path.join(root, "public/style.css"));
  await access(path.join(root, "public/assets/chevrons/left.svg"));
  await access(path.join(root, "public/llms.txt"));
  await access(path.join(root, "public/sitemap.xml"));
  await access(path.join(root, "public/robots.txt"));

  for (const doc of manifest.documents ?? []) {
    const output = publishPathForDoc(siteConfig, doc);
    if (!output) continue;
    await access(path.join(root, "public", output));
  }

  const indexHtml = await readFile(path.join(root, "public/index.html"), "utf8");
  const desc = siteConfig.description ?? "";
  assert.ok(desc, "site.config.json should define description for homepage meta");
  assert.match(
    indexHtml,
    new RegExp(`<meta name="description" content="${desc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`)
  );
  assert.match(indexHtml, /<link rel="canonical" href="https:\/\/grahammacaree\.com\/"/);
  assert.match(indexHtml, /"@type":"Person"/);
});
