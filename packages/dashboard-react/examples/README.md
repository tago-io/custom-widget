# React SDK Examples

Simple examples showing how to use `@tago-io/custom-dashboard-react` in your custom dashboards.

Each file is a self-contained React component you can copy into your project.

| Example                                | What it shows                                                         |
| -------------------------------------- | --------------------------------------------------------------------- |
| [run-query.tsx](./run-query.tsx)       | List the saved TagoSQL queries, pick one, run it, render the result   |
| [query-params.tsx](./query-params.tsx) | Positional `$1` parameters, and letting stored defaults fill the rest |
| [theme.tsx](./theme.tsx)               | Following the host's theme, including a correct first paint           |

## How to use these

1. Copy the example file into your React project
2. Install the SDK: `npm install @tago-io/custom-dashboard-react react react-dom`
3. Render the `App` component from the example as your root component (or adapt it to fit your app)

Every example follows the same pattern:

- Wrap your app in `<DashboardProvider>` (once, at the top level)
- Use hooks like `useSqlQueries()`, `useSqlQuery()`, `useTheme()` inside your components
- Render server text — `error.message`, column names, row values — as text, never as HTML

## Building for upload

A custom dashboard is **one** uploaded HTML file, so your build has to inline everything — this is the difference from a custom widget, which is hosted as a folder of assets. With Vite, [`vite-plugin-singlefile`](https://github.com/richardtallent/vite-plugin-singlefile) turns `npm run build` into a single `dist/index.html` you can upload as-is:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: "./",
});
```
