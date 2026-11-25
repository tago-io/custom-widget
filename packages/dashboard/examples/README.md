# Examples

Each example loads the SDK with `<script src="../dist/custom-dashboard.min.js">`, which works when you open it locally. A custom dashboard is uploaded as **one** HTML document, so before uploading, inline that script:

```bash
pnpm build            # from packages/dashboard
node examples/build.mjs
```

That writes uploadable copies to `examples/dist/`. Upload one via the dashboard's gear menu → **Upload new HTML**.

| File                   | What it shows                                                                                                                                                                                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hello-dashboard.html` | The starting point: list saved queries, run one, render the table, handle errors, follow the theme.                                                                                                                                                             |
| `error-handling.html`  | One button per outcome, plus a live log of every message in both directions. Useful when something is not behaving.                                                                                                                                             |
| `link-params.html`     | Read the link's querystring and scope a query to `?device=`, following URL changes without a reload.                                                                                                                                                            |
| `setpoint-form.html`   | Save a form through an Analysis Endpoint and show the field errors of its `422`, from the docs.tago.io recipe [Validate a Custom Dashboard form](https://docs.tago.io/docs/tagoio/analysis/endpoints/recipes/validate-dashboard-form). Set `ANALYSIS_ID` first. |
| `dev-host.html`        | A stand-in host so you can build without uploading. Open this one, not the shell.                                                                                                                                                                               |

## Developing without uploading

Open `dev-host.html` in a browser. It frames your shell, answers `dashboard:ready` with a theme and the link params you type, and serves canned rows for `sql.list` and `sql.run`. It deliberately mirrors two host behaviors that are easy to miss otherwise: a request with an empty `id` gets no answer at all, and an unknown query id comes back as `not_found`.

It also lists one mock Endpoint for `endpoint.list`, `cccccccccccccccccccccccc`, and answers `endpoint.call` the way the recipe's Analysis does: `POST /setpoint` with a setpoint from 5 to 30 gets `200`, any other value gets `422` with the field error, and any other method or path gets `404`. Set `ANALYSIS_ID` in `setpoint-form.html` to that ID to try the form here. Like the real host, it refuses a `.` or `..` path segment and a body sent with `GET` as `bad_request`.

Opened directly, with no host at all, the SDK reports `isEmbedded === false` and fails every call immediately with `no_host` rather than leaving you watching a spinner.
