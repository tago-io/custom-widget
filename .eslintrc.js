module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: 6,
    sourceType: "module",
    ecmaFeatures: {
      jsx: false,
    },
  },
  env: {
    browser: true,
    commonjs: true,
  },
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "import"],
  extends: [
    "eslint:recommended",
    "plugin:prettier/recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:import/recommended",
    "plugin:import/typescript",
  ],
  rules: {
    "@typescript-eslint/interface-name-prefix": 0,
    eqeqeq: [2, "smart"],
    "no-alert": 2,
    "no-unused-vars": 0,
    "@typescript-eslint/no-unused-vars": [1, { argsIgnorePattern: "^_", ignoreRestSiblings: true }],
    "import/order": 2,
    "import/newline-after-import": 2,
    "import/no-unresolved": 0,
  },
};
