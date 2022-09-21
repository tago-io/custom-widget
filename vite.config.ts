import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Enable Vitest's globals (e.g. describe, it, etc) to be used in tests without importing.
    globals: true,
    environment: "jsdom",
  },
});
