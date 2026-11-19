# TagoIO Custom Widget & Custom HTML SDKs

Build your own pages that run inside TagoIO. Two products, two protocols, four packages:

- A **custom widget** is one tile on a dashboard. The host pushes it configuration and live data.
- A **Custom HTML** page is a single HTML file you upload that replaces the _entire_ dashboard canvas. Nothing is pushed to it; it asks the host for what it needs over a request/response bridge.

Jump to [Custom HTML](#custom-html) if you are building the second kind.

## Custom Widgets

A custom widget is a webpage (loaded in an iframe) that can display data, collect user input, and communicate with the TagoIO platform.

This repository provides two SDKs — pick the one that fits your project:

|              | JavaScript SDK                           | React SDK                      |
| ------------ | ---------------------------------------- | ------------------------------ |
| **Best for** | Plain HTML, vanilla JS, or any framework | React applications             |
| **Package**  | `@tago-io/custom-widget`                 | `@tago-io/custom-widget-react` |
| **Approach** | Callbacks on `window.TagoIO`             | Hooks and a Provider component |

## Quick Start — JavaScript

No build step needed. Add the script tag and start coding:

```html
<script src="https://admin.tago.io/dist/custom-widget.min.js"></script>
<script>
  window.TagoIO.onStart(function (widget) {
    console.log("Widget started!", widget);
  });

  window.TagoIO.onRealtime(function (data) {
    console.log("New data:", data);
  });

  window.TagoIO.ready();
</script>
```

See the full API and more examples in the [JavaScript SDK docs](./packages/js/README.md).

## Quick Start — React

Install the package:

```bash
npm install @tago-io/custom-widget-react react react-dom
```

Wrap your app in the provider and use hooks to access data:

```jsx
import { TagoIOProvider, useWidget, useRealtimeData } from "@tago-io/custom-widget-react";

function App() {
  return (
    <TagoIOProvider>
      <Dashboard />
    </TagoIOProvider>
  );
}

function Dashboard() {
  const { widget, isLoading } = useWidget();
  const { records } = useRealtimeData();

  if (isLoading) return <p>Loading...</p>;

  return (
    <div>
      <h1>{widget?.label}</h1>
      <ul>
        {records.map((r) => (
          <li key={r.id}>
            {r.variable}: {r.value}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

See the full API and more examples in the [React SDK docs](./packages/react/README.md).

## Custom HTML

A Custom HTML page is one HTML file you upload; TagoIO renders it as the whole dashboard canvas. The host does not push data — your page asks for it, running saved TagoSQL queries through a `postMessage` bridge under the viewer's session.

|              | JavaScript SDK                     | React SDK                    |
| ------------ | ---------------------------------- | ---------------------------- |
| **Best for** | Plain HTML, no build step          | React applications           |
| **Package**  | `@tago-io/custom-html`             | `@tago-io/custom-html-react` |
| **Approach** | Promises on `window.TagoDashboard` | A provider and hooks         |

```js
const queries = await TagoDashboard.sql.list();
const result = await TagoDashboard.sql.run(queries[0].id, [{ key: "$1", value: "30" }]);

console.log(result.columns, result.rows);
```

**Before you build one, read the [security model](./packages/html/README.md#read-this-first-the-security-model).** An uploaded Custom HTML page can enumerate and execute every saved TagoSQL query in the profile, as the person viewing it. Uploading one is code-deployment-grade.

Full docs: [JavaScript](./packages/html/README.md) · [React](./packages/html-react/README.md)

## Examples

Both SDKs include ready-to-use examples you can copy into your project:

- **Widget, JavaScript** — HTML files covering common patterns: [packages/js/examples/](./packages/js/examples/)
- **Widget, React** — Simple `.tsx` files for reading data, sending data, and accessing resources: [packages/react/examples/](./packages/react/examples/)
- **Custom HTML, JavaScript** — uploadable HTML, plus a local dev host so you can build without uploading: [packages/html/examples/](./packages/html/examples/)
- **Custom HTML, React** — copy-paste `.tsx` components: [packages/html-react/examples/](./packages/html-react/examples/)

### External Project Examples

Complete project implementations you can clone and explore:

- [Boilerplate Project](https://github.com/tago-io/custom-widget-boilerplate) — Basic boilerplate using Preact
- [SendData Widget](https://github.com/tago-io/custom-widget-example-send-data) — Sending data from a Custom Widget
- [Wizard Widget](https://github.com/tago-io/custom-widget-example-wizard) — Multi-step wizard demo
- [ECharts Custom Gauge](https://github.com/tago-io/custom-gauge-tutorial) — Custom gauge with ECharts

## Repository Structure

This is a monorepo managed with [pnpm workspaces](https://pnpm.io/workspaces):

```
packages/
  js/               → @tago-io/custom-widget            (widget, JavaScript)
  react/            → @tago-io/custom-widget-react      (widget, React)
  core/             → @tago-io/custom-widget-core       (widget internals)
  html/             → @tago-io/custom-html              (Custom HTML, JavaScript)
  html-react/       → @tago-io/custom-html-react        (Custom HTML, React)
```

The two product families are independent: the Custom HTML packages share no code with the widget packages, because the protocols have nothing in common.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) 10+

### Setup

```bash
pnpm install
```

### Common Commands

```bash
# Build all packages
pnpm build

# Run all tests
pnpm test

# Type-check all packages
pnpm check:types

# Lint all packages
pnpm lint
```

## Contributing

We welcome contributions! Here's the short version:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Ensure everything passes: `pnpm test`
5. Commit and push
6. Open a Pull Request

## Support

- [Help Documentation](https://help.tago.io/portal/en/kb/articles/450-custom-widget) — Complete guide on creating custom widgets
- [Community Forum](https://community.tago.io) — Ask questions and share knowledge
- [Issue Tracker](https://github.com/tago-io/custom-widget/issues) — Report bugs and request features
- [Support Email](mailto:support@tago.io) — Direct technical support

## License

Apache-2.0 — see [LICENSE.md](LICENSE.md) for details.

---

**Made by [TagoIO Inc.](https://tago.io)**
