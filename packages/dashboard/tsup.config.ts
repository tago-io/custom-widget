import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["cjs", "esm"],
    dts: true,
    clean: true,
    sourcemap: true,
  },
  {
    entry: { "custom-dashboard": "src/global.ts" },
    format: ["iife"],
    platform: "browser",
    minify: false,
    clean: false,
    outDir: "dist",
    outExtension: () => ({ js: ".js" }),
  },
  {
    entry: { "custom-dashboard.min": "src/global.ts" },
    format: ["iife"],
    platform: "browser",
    minify: true,
    clean: false,
    outDir: "dist",
    outExtension: () => ({ js: ".js" }),
  },
]);
