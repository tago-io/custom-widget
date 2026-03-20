import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { "custom-widget": "src/custom-widget.ts" },
    format: ["iife"],
    platform: "browser",
    minify: false,
    clean: true,
    outDir: "dist",
    outExtension: () => ({ js: ".js" }),
  },
  {
    entry: { "custom-widget.min": "src/custom-widget.ts" },
    format: ["iife"],
    platform: "browser",
    minify: true,
    outDir: "dist",
    clean: false,
    outExtension: () => ({ js: ".js" }),
  },
]);
