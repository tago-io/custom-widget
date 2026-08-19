# TagoIO Custom Dashboard SDK

Build TagoIO Custom Dashboards: you upload one HTML file, TagoIO renders it as the whole dashboard canvas, and this SDK is how that page talks to the host.

The host speaks a small request/response `postMessage` protocol. Without an SDK you generate correlation ids, match responses to requests, and handle nine error codes by hand, and because the host drops responses in several situations without answering, a naive promise wrapper hangs forever. This package owns that plumbing and nothing else.

```js
const queries = await TagoDashboard.sql.list();
const result = await TagoDashboard.sql.run(queries[0].id, [{ key: "$1", value: "30" }]);

console.log(result.columns, result.rows);
```

## Read this first: the security model

**Uploading dashboard HTML is code-deployment-grade.** The page you upload can:

- enumerate **every saved TagoSQL query in the profile**, with names (`sql.list`),
- execute **any of them** with arbitrary parameters (`sql.run`),
- and `fetch()` any external origin.

All of it runs **as the person viewing the dashboard**, using their session. A user who can edit a dashboard but has little data access, plus a viewer who has a lot, is a privilege escalation path. The only client-side guard on a query id is a format check — that is a path-traversal guard, not an authorization check. Authorization is the API's alone.

The shell is also served from the API origin with `allow-same-origin`, so every custom dashboard in an account shares that origin's storage.

Treat uploading a shell the way you treat deploying code: review it, and permission it accordingly.

### What this SDK will never do

So future changes have something to point at:

- **Never** write `localStorage`, `sessionStorage`, or cookies. No result cache, no persisted theme, no telemetry.
- **Never** add a generic passthrough op, or wrap a new host op, without a separate security review. The two ops below are the entire attack surface.
- **Never** add breadth helpers — no `runAll`, no `prefetchAll`, no find-query-by-name, no sub-second polling helper.
- **Never** handle tokens. The SDK never sees one, and the iframe URL carries none.

### What you must never do

`error.message` is API text forwarded verbatim, and column names, row keys, and query names all come from the database or from whoever wrote the query. **Never** put any of it through `innerHTML`, `eval`, or `new Function`. Render with text nodes. Every example here does.

## Install

The uploaded dashboard is a single HTML file, so the code has to end up inside it. Two ways, both fully under your control:

**Bundle it.** Install from npm and let your bundler inline everything into one file:

```bash
npm install @tago-io/custom-dashboard
```

```js
import { createDashboardClient } from "@tago-io/custom-dashboard";
```

With Vite, [`vite-plugin-singlefile`](https://github.com/richardtallent/vite-plugin-singlefile) turns `npm run build` into a single uploadable `dist/index.html`.

**Or paste it.** Copy the contents of `dist/custom-dashboard.min.js` into a `<script>` tag. No build step, and the page keeps working regardless of what any CDN does. This is what the examples in `examples/` do.

If your shell's Content-Security-Policy permits an external script, a CDN works too — pin an exact version, because your uploaded HTML is stored server-side and reloaded months later, and a moving URL silently changes what it runs.

## API

### Getting data

```ts
sql.list(options?): Promise<Array<{ id: string; name: string }>>
sql.run<TRow>(queryID: string, params?: TQueryParam[], options?): Promise<TSqlRunResult<TRow>>
```

`params` is the wire shape, exactly as TagoSQL defines it — positional placeholders and string values:

```js
await TagoDashboard.sql.run(queryID, [
  { key: "$1", value: "2026-08-01" },
  { key: "$2", value: "30" },
]);
```

The SDK does not reshape or convert it. Values are strings because [the API says they are](https://docs.tago.io/docs/tagoio/tagosql/parameters); if you have a `Date`, call `.toISOString()`. Send a subset and the query's stored defaults fill the rest; send none and every default applies.

`sql.run` returns:

```ts
{
  columns: string[];
  rows: Record<string, unknown>[];
  meta: { row_count: number | null; execution_ms: number | null; served_from_cache: boolean };
}
```

`TRow` is a type-level assertion for your own convenience. Nothing validates row contents at runtime.

### Theme

```ts
theme.get(): "dark" | "light"
theme.subscribe(listener): () => void
getInitialTheme(search?): "dark" | "light"
```

The SDK reports the theme; **applying it is yours**, because your CSS contract is not the SDK's to invent:

```js
document.documentElement.dataset.theme = TagoDashboard.theme.get();
TagoDashboard.theme.subscribe(() => {
  document.documentElement.dataset.theme = TagoDashboard.theme.get();
});
```

`getInitialTheme()` reads the theme the host puts on the shell URL, which is available before any message arrives — that is what lets you paint the right theme on the very first frame instead of flashing.

Subscribers fire only on a real change. The host re-sends the current theme on any `<html>` class mutation, and the SDK filters those out.

### Lifecycle

```ts
start(): void   // attach the listener and announce the shell. Idempotent.
stop(): void    // detach, fail everything in flight, clear timers. Reversible.
isEmbedded: boolean
```

The `<script>` build starts automatically. Opened outside a dashboard, `isEmbedded` is `false` and every call fails immediately with `no_host` rather than hanging.

## Errors

Every failure throws a `TagoDashboardError` with a `code`. The `Raised by` column is not decoration: two codes come from either side, and knowing which side you are looking at changes what you do about it.

| Code           | Raised by | Meaning                                                                                                                  |
| -------------- | --------- | ------------------------------------------------------------------------------------------------------------------------ |
| `not_found`    | Host      | The saved query does not exist                                                                                           |
| `forbidden`    | Host      | The viewer cannot access that query's resource                                                                           |
| `bad_params`   | Host      | **See below. This one is not what it sounds like**                                                                       |
| `plan_limit`   | Host      | The profile's plan does not allow this execution                                                                         |
| `timeout`      | Host      | The query ran past its execution deadline, server side                                                                   |
| `rate_limited` | Host      | Too many executions. Back off and retry                                                                                  |
| `unknown_op`   | Host      | This SDK is newer than the dashboard host                                                                                |
| `api_error`    | Both      | Host: the query failed to execute. SDK: the reply was malformed                                                          |
| `bad_request`  | Both      | SDK: the query id failed its local format check, and nothing was sent. Host: some other part of the payload was rejected |
| `no_response`  | SDK       | The host never answered at all. See [Timeouts](#timeouts)                                                                |
| `no_host`      | SDK       | The page is not running inside a dashboard                                                                               |
| `aborted`      | SDK       | `stop()` was called while the request was in flight                                                                      |
| `internal`     | SDK       | The SDK could not issue the request                                                                                      |

In practice `bad_request` reaches you from the SDK, not the host: the query id is checked before anything is posted, so an invalid one costs no round trip. And an `api_error` whose message mentions a malformed reply is the SDK telling you the host answered with something it could not read, which is a different problem from a query that failed.

**`timeout` and `no_response` are different failures, and the remedy is opposite.** A `timeout` is the server saying the query ran too long, so narrow it. A `no_response` is the dashboard never answering, so only the SDK's own backstop bounded the wait. Branch on the wrong one and you tell someone to fix a query that was fine.

A code you do not recognize is forwarded verbatim rather than flattened, so a host newer than your copy of the SDK still reports what it meant. That is why `TDashboardErrorCode` is open ended. Narrow to `TKnownErrorCode` when you want an exhaustive `switch`.

**`bad_params` still covers more than parameters.** A row-limit refusal, a too-wide time window, an inactive query and a genuine bad parameter all arrive here, because the host peels off only the statuses it recognizes and folds every other `4xx` into this one code. A `422` lands here as readily as a `400`. The server's message says which. Timeouts, rate limits and plan caps used to land here too; they now have the three codes above.

```js
try {
  await TagoDashboard.sql.run(queryID);
} catch (error) {
  if (error.code === "not_found") {
    show("That query no longer exists.");
  } else {
    show(error.message); // textContent, never innerHTML
  }
}
```

## Timeouts

TagoSQL enforces its own execution deadline and answers with an error, so a slow _query_ always comes back. What has no timeout is the _transport_: if the dashboard is reloaded, navigated away from, or remounted while a request is in flight, the host discards the answer and never tells you.

So each request carries a generous backstop (60s, configurable per client or per call, `0` to disable) that rejects with `no_response`. It exists to catch a wedged host, not to bound your query — a query that genuinely runs too long comes back from the server as `timeout` instead.

A `no_response` cancels nothing: the query keeps running server-side. If its answer turns up afterwards the SDK ignores it, and logs one `console.debug` naming the request, so a late reply is distinguishable from a query that quietly did nothing.

## Local development

Opened directly, the page has no host, so `sql.*` fails fast with `no_host` and one console note. `examples/dev-host.html` frames your shell and answers the protocol with canned rows, so you can build without uploading.

## License

Apache-2.0 — see [LICENSE.md](../../LICENSE.md) for details.
