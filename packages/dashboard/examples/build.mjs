/**
 * Turn each example into one uploadable file by inlining the built SDK.
 *
 * A custom dashboard is a single HTML document, so the script tag has to become script text.
 * Run `pnpm build` in this package first, then `node examples/build.mjs`.
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const examplesDir = dirname(fileURLToPath(import.meta.url));
const outDir = join(examplesDir, "dist");
const bundlePath = join(examplesDir, "..", "dist", "custom-dashboard.min.js");

const SCRIPT_TAG = /<script src="\.\.\/dist\/custom-dashboard\.min\.js"><\/script>/;

let bundle;
try {
  bundle = readFileSync(bundlePath, "utf8");
} catch {
  console.error(`Missing ${bundlePath}. Build the package first.`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const built = readdirSync(examplesDir)
  .filter((name) => name.endsWith(".html"))
  .map((name) => {
    const source = readFileSync(join(examplesDir, name), "utf8");
    if (!SCRIPT_TAG.test(source)) {
      return { name, inlined: false };
    }
    // Escape any closing tag inside the bundle so it cannot terminate the script element early.
    const safe = bundle.replace(/<\/script/gi, "<\\/script");
    writeFileSync(join(outDir, name), source.replace(SCRIPT_TAG, `<script>${safe}</script>`), "utf8");
    return { name, inlined: true };
  });

for (const { name, inlined } of built) {
  console.log(`${inlined ? "inlined " : "skipped "} ${name}`);
}
console.log(`\nUploadable files are in ${outDir}`);
