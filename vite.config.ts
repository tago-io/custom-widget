import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["packages/*/tests/**/*.test.{ts,tsx}", "packages/*/src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.{ts,tsx}"],
      exclude: ["packages/*/src/**/index.ts"],
    },
  },
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    printWidth: 120,
    tabWidth: 2,
    useTabs: false,
    semi: true,
    singleQuote: false,
    trailingComma: "es5",
    insertFinalNewline: true,
    sortImports: {},
    ignorePatterns: ["**/dist/**", "**/node_modules/**", "**/coverage/**"],
  },
  lint: {
    ignorePatterns: ["**/dist/**", "**/node_modules/**", "**/coverage/**"],
    plugins: ["typescript", "react", "import"],
    options: {
      typeAware: true,
    },
    categories: {
      correctness: "error",
      suspicious: "error",
    },
    rules: {
      "eslint/eqeqeq": "error",
      "react/exhaustive-deps": "error",
      "react/react-in-jsx-scope": "off",
      "typescript/no-unsafe-type-assertion": "off",
      "typescript/unbound-method": "off",
    },
  },
});
