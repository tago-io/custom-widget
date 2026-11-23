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
- list **every Analysis Endpoint the viewer may call** (`endpoint.list`),
- call **any of them** with any method, path, query, and body (`endpoint.call`), which runs that Analysis's code and can write data,
- and `fetch()` any external origin.

All of it runs **as the person viewing the dashboard**, using their session. A user who can edit a dashboard but has little data access, plus a viewer who has a lot, is a privilege escalation path. The only client-side guard on a query id or an Analysis ID is a format check. That is a path-traversal guard, not an authorization check. Authorization is the API's alone.

The shell is also served from the API origin with `allow-same-origin`, so every custom dashboard in an account shares that origin's storage.

Treat uploading a shell the way you treat deploying code: review it, and permission it accordingly.

### What this SDK will never do

So future changes have something to point at:

- **Never** write `localStorage`, `sessionStorage`, or cookies. No result cache, no persisted theme, no telemetry.
- **Never** add a generic passthrough op, or wrap a new host op, without a separate security review. This SDK wraps the two `sql.*` ops and the two `endpoint.*` ops below, each after its own review, but the host bridge answers others too, such as `stream.open` and `stream.close`. A shell can post those without this SDK, so judge what a shell can reach by the host's ops, not by this package.
- **Never** retry an `endpoint.call`, or share one request between two calls. A call can write data, so a retry could save twice and a shared request would drop a save.
- **Never** add breadth helpers — no `runAll`, no `prefetchAll`, no find-query-by-name, no sub-second polling helper.
- **Never** handle tokens. The SDK never sees one, and the iframe URL carries none.

### What you must never do

`error.message` is API text forwarded verbatim, and column names, row keys, and query names all come from the database or from whoever wrote the query. Link parameters (`params`) come from whoever wrote the link. An Endpoint's `body` and `headers` come from whoever wrote the Analysis. **Never** put any of it through `innerHTML`, `eval`, or `new Function`. Render with text nodes. Every example here does.

A link parameter rendered as HTML is reflected XSS: anyone can send a viewer `?device=<img src=x onerror=...>`, and that script runs with the viewer's session on the shell's origin.

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

If your shell's Content-Security-Policy permits an external script, a CDN works too. The package's `unpkg` and `jsdelivr` fields point at the minified script build, so the bare package URL serves it:

```html
<script src="https://cdn.jsdelivr.net/npm/@tago-io/custom-dashboard@2.3.0"></script>
```

Pin an exact version as above. Your uploaded HTML is stored server-side and reloaded months later, and a moving URL silently changes what it runs.

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

### Calling an Analysis Endpoint

```ts
endpoint.list(options?): Promise<Array<{ id: string; name: string }>>
endpoint.call<TBody>(analysisID: string, request?: TEndpointRequest, options?): Promise<TEndpointCallResult<TBody>>
```

A Luau Analysis with its Endpoint turned on answers HTTP requests, and these ops reach it with the viewer's session, the way `sql.run` runs a query. `analysisID` is the Analysis's ID, the 24 characters at the end of its Endpoint URL. `endpoint.list` returns the Endpoints the viewer may call. In TagoRUN that is only the ones granted to the Run user.

The request is an HTTP request without headers:

```ts
{
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; // default "GET"
  path?: string; // below the Endpoint root, such as "/setpoint"; default "/"
  query?: Record<string, string | number | boolean | Array<string | number | boolean>>; // an array repeats its key
  body?: unknown; // a string is sent as text, anything else as JSON; not allowed with GET
}
```

The host adds the viewer's session token and sets the content type from the body. A shell cannot add a header of its own, such as a token or `Authorization`. A string body reaches the Analysis as `context.request.body`, with `scope` as nil. Any other body is encoded with JSON's rules before it is posted, so `toJSON()` applies, as for a `Date` inside an object.

The SDK checks the request before posting it, and rejects with `bad_request`, without a round trip, when it would fail or arrive wrong:

- **A body with `GET`**, the default method. The host refuses it; set `method`, usually to `"POST"`.
- **A body JSON cannot encode**, such as a `BigInt` or a cycle.
- **A body JSON would write as `{}`**, such as a `Map`, a `FormData`, a `Blob` or a class instance without `toJSON()`. Convert it to a plain object first, for example with `Object.fromEntries(formData)`.
- **A body whose JSON is a bare string**, such as a top-level `Date`, which the host would send as text. Put it in an object.
- **A query value that is not a string, a finite number or a boolean**, or an array of them. The message names the key. A key whose value is `undefined` is left out instead, the way JSON leaves one out of a body.

**Every HTTP answer resolves**, 4xx and 5xx included, as `{ status, headers, body }`. That is what lets a form show the field errors of a `422`. Check `status` before reading `body`, which is parsed when the response is JSON and text otherwise:

```js
const answer = await TagoDashboard.endpoint.call(ANALYSIS_ID, {
  method: "POST",
  path: "/setpoint",
  body: { setpoint: input.value },
});

// The body is whatever the Analysis answered, or the platform's own error, so read it defensively.
if (answer.status === 422) {
  feedback.textContent = answer.body?.errors?.setpoint ?? "Invalid setpoint.";
} else if (answer.status >= 400) {
  feedback.textContent = answer.body?.error ?? `Request failed (${answer.status}).`;
} else {
  const saved = answer.body?.setpoint;
  feedback.textContent = typeof saved === "number" ? `Saved: ${saved} C` : "Saved.";
}
```

The call **rejects only when it did not complete**: the host refused the request (`bad_request`), could not make it, as with a redirect it refuses to follow or a network failure (`api_error`), or never answered (`no_response`, `aborted`). After `api_error`, `no_response`, or `aborted`, the Analysis may have run, so the outcome is unknown. Read the state back before calling again. The SDK never retries a call for you.

**Calls are never shared.** Identical reads in flight share one request, but two identical calls are two requests, since each one may be a save.

A viewer without access gets an answer, not a rejection. In TagoRUN a Run user needs **Call Endpoint** on the Analysis in Access Management. Without it, the Endpoint is missing from `endpoint.list` and a call answers `404`. To hide a form the viewer cannot use, check the list first:

```js
const endpoints = await TagoDashboard.endpoint.list();
saveButton.disabled = !endpoints.some((endpoint) => endpoint.id === ANALYSIS_ID);
```

[`examples/setpoint-form.html`](./examples/setpoint-form.html) is the whole form, built on the docs.tago.io recipe [Validate a Custom Dashboard form](https://docs.tago.io/docs/tagoio/analysis/endpoints/recipes/validate-dashboard-form). The Endpoint's own limits on body size, execution time, and calls per minute are in [Using Endpoints](https://docs.tago.io/docs/tagoio/analysis/endpoints/using-endpoints). A call past one of them resolves with the status the Endpoint answers, such as `413`, `429`, or `504`.

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

### Link parameters

```ts
params.get(): Readonly<Partial<Record<string, string>>>
params.subscribe(listener): () => void
```

The host forwards the querystring of the page that shows your dashboard, so a link can open it already scoped. A link to `/dashboards/<id>?device=6a1f...` hands the shell `{ device: "6a1f..." }`:

```js
let latest = 0;

function render() {
  const run = ++latest;
  const { device } = TagoDashboard.params.get();
  if (!device) {
    show("Pick a device.");
    return;
  }
  // A reply for an earlier device can land after the current one; drop it.
  TagoDashboard.sql.run(QUERY_ID, [{ key: "$1", value: device }]).then(
    (result) => run === latest && draw(result),
    (error) => run === latest && show(error.message)
  );
}

render();
TagoDashboard.params.subscribe(render);
```

- **Every value is a string**, so it goes straight into a `sql.run` param. Read numbers and dates from a string yourself. A key the link does not carry is absent, which is why the type is `Partial`.
- **It starts as `{}`.** The host sends the map after the handshake, and only when the URL has a key to forward, so the first `render()` sees `{}` even on a scoped link and the map follows about one round trip later. A shell cannot tell that first `{}` from a link with no params, so avoid spending a query on it.
- **It follows the URL.** When the parent page changes its querystring without reloading, subscribers fire with the new map. Removing every key gives you `{}`.
- **It is read-only.** The map is frozen and has no prototype, and only the host window can change it; a message from any other frame is ignored. Check a key with `"device" in params` or `Object.hasOwn`, not `params.hasOwnProperty`, and copy it with `{ ...params }` before handing it to code that expects a plain object or calls `String()` on it.
- **Some keys never arrive.** The host keeps its own: `tab`, `tabKey`, `edit`, `panel`, `dialog`, `period_start`, `period_end`, `prompt`, `user`, `anonymousToken`, `by_token`, `byToken`, `bytoken`, `redirect_to`, `redirect`, `debug_url` and `local_login`. Name yours something else; for a time range, `from` and `to` work.
- **Keep values plain.** Admin and TagoRUN parse the URL differently before forwarding it, so `null`, JSON, quoted strings and bracket keys (`?f[a]=b`) do not come through the same in both. Neither do repeated keys: `?site=a&site=b` gives `{ site: "b" }` in Admin and no `site` at all in TagoRUN. Ids, numbers, words and ISO dates come through the same.

A querystring is user input. Anyone can edit the link, so treat a value as a request, never as proof of access: the query still runs with the viewer's permissions, and its result is what to trust. Render it as text, never as HTML (see [What you must never do](#what-you-must-never-do)).

### Lifecycle

```ts
start(): void   // attach the listener and announce the shell, starting params from {}. Idempotent.
stop(): void    // detach, fail everything in flight, clear timers. Reversible.
isEmbedded: boolean
```

The `<script>` build starts automatically. Opened outside a dashboard, `isEmbedded` is `false` and every call fails immediately with `no_host` rather than hanging.

A call made while the client is not running, before the first `start()` or after `stop()`, waits one microtask for a `start()` and then rejects with `aborted`, instead of waiting out the timeout for an answer nobody would read. The microtask is for React: a provider starts its client after its children's first effects, and StrictMode and a revealed `<Activity>` remount the children before the provider restarts it, all in the same tick. A `stop()` also fails a call that is still waiting, so it never reaches the host.

## Errors

Every failure throws a `TagoDashboardError` with a `code`. The `Raised by` column is not decoration: two codes come from either side, and knowing which side you are looking at changes what you do about it.

| Code           | Raised by | Meaning                                                                                                                                                                                                                                                   |
| -------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `not_found`    | Host      | The saved query does not exist                                                                                                                                                                                                                            |
| `forbidden`    | Host      | The viewer cannot access that query's resource                                                                                                                                                                                                            |
| `bad_params`   | Host      | **See below. This one is not what it sounds like**                                                                                                                                                                                                        |
| `plan_limit`   | Host      | The profile's plan does not allow this execution                                                                                                                                                                                                          |
| `timeout`      | Host      | The query ran past its execution deadline, server side                                                                                                                                                                                                    |
| `rate_limited` | Host      | Too many executions. Back off and retry                                                                                                                                                                                                                   |
| `unknown_op`   | Host      | This SDK is newer than the dashboard host                                                                                                                                                                                                                 |
| `api_error`    | Both      | Host: the query failed to execute, or an Endpoint call could not complete. SDK: the reply was malformed                                                                                                                                                   |
| `bad_request`  | Both      | SDK: the query id or Analysis ID failed its local format check, or the Endpoint request failed a local check (see [Calling an Analysis Endpoint](#calling-an-analysis-endpoint)), and nothing was sent. Host: some other part of the payload was rejected |
| `no_response`  | SDK       | The host never answered at all. See [Timeouts](#timeouts)                                                                                                                                                                                                 |
| `no_host`      | SDK       | The page is not running inside a dashboard                                                                                                                                                                                                                |
| `aborted`      | SDK       | `stop()` was called while the request was in flight, or the client was not running when the call was made                                                                                                                                                 |
| `internal`     | SDK       | The SDK could not issue the request                                                                                                                                                                                                                       |

In practice `bad_request` reaches you from the SDK, not the host: the query id and the Analysis ID are checked before anything is posted, so an invalid one costs no round trip. And an `api_error` whose message mentions a malformed reply is the SDK telling you the host answered with something it could not read, which is a different problem from a query that failed.

An Endpoint's HTTP errors are not in this table: `endpoint.call` resolves them with their status. It rejects only with `bad_request`, `api_error`, `unknown_op`, and the SDK's own codes, and after `api_error`, `no_response`, or `aborted` the Analysis may have run. See [Calling an Analysis Endpoint](#calling-an-analysis-endpoint).

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

`endpoint.call` keeps the same backstop. An Endpoint answers `504` once its script runs past 30 seconds, so inside the default 60 seconds a call comes back unless the host lost the answer. For a call, `no_response` means the outcome is unknown, not that the save failed: the Analysis may have run, so read the state back before calling again. Without the backstop, a lost answer would leave the form waiting until the page reloads. To wait that long anyway, pass `{ timeoutMs: 0 }` to the call. A client-level `timeoutMs` bounds calls too, so a client tuned below 30 seconds for SQL reports `no_response` for an Endpoint that is still running: pass a longer `timeoutMs` to `endpoint.call` in that case.

## Local development

Opened directly, the page has no host, so `sql.*` and `endpoint.*` fail fast with `no_host` and one console note. `examples/dev-host.html` frames your shell and answers the protocol with canned rows and one mock Endpoint, `cccccccccccccccccccccccc`, which answers `POST /setpoint` like the recipe's Analysis, so you can build without uploading.

## License

Apache-2.0 — see [LICENSE.md](../../LICENSE.md) for details.
