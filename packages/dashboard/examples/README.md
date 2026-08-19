# Examples

Each example loads the SDK with `<script src="../dist/custom-dashboard.min.js">`, which works when you open it locally. A custom dashboard is uploaded as **one** HTML document, so before uploading, inline that script:

```bash
pnpm build            # from packages/dashboard
node examples/build.mjs
```

That writes uploadable copies to `examples/dist/`. Upload one via the dashboard's gear menu → **Upload new HTML**.

| File                   | What it shows                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `hello-dashboard.html` | The starting point: list saved queries, run one, render the table, handle errors, follow the theme.                 |
| `error-handling.html`  | One button per outcome, plus a live log of every message in both directions. Useful when something is not behaving. |
| `dev-host.html`        | A stand-in host so you can build without uploading. Open this one, not the shell.                                   |

## Developing without uploading

Open `dev-host.html` in a browser. It frames your shell, answers `dashboard:ready` with a theme, and serves canned rows for `sql.list` and `sql.run`. It deliberately mirrors two host behaviors that are easy to miss otherwise: a request with an empty `id` gets no answer at all, and an unknown query id comes back as `not_found`.

Opened directly, with no host at all, the SDK reports `isEmbedded === false` and fails every call immediately with `no_host` rather than leaving you watching a spinner.
