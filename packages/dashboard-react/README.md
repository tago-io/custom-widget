# TagoIO Custom Dashboard SDK — React

React bindings for [`@tago-io/custom-dashboard`](../dashboard). A provider, three hooks, and nothing else.

> **Read [the security model](../dashboard/README.md#read-this-first-the-security-model) in the core package first.** Uploading dashboard HTML is code-deployment-grade, and every viewer runs it under their own session.

## Install

```bash
npm install @tago-io/custom-dashboard-react react react-dom
```

A custom dashboard is one uploaded HTML file, so build to a single file — with Vite, [`vite-plugin-singlefile`](https://github.com/richardtallent/vite-plugin-singlefile) does it. The snippets in [`examples/`](./examples) show the hooks in use; wire them into your own Vite project and point `base` at `"./"`.

## Quick start

```tsx
import { DashboardProvider, useSqlQueries, useSqlQuery } from "@tago-io/custom-dashboard-react";

function App() {
  const { queries } = useSqlQueries();
  const { data, isLoading, error } = useSqlQuery(queries[0]?.id ?? null);

  if (isLoading) return <p>Loading…</p>;
  if (error) return <p>{error.message}</p>;

  return (
    <table>
      <thead>
        <tr>
          {data?.columns.map((column) => (
            <th key={column}>{column}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data?.rows.map((row, index) => (
          <tr key={index}>
            {data.columns.map((column) => (
              <td key={column}>{String(row[column] ?? "")}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

createRoot(document.getElementById("root")).render(
  <DashboardProvider>
    <App />
  </DashboardProvider>
);
```

## Hooks

| Hook                                      | Returns                                                          |
| ----------------------------------------- | ---------------------------------------------------------------- |
| `useSqlQueries()`                         | `{ queries, isLoading, error, refetch }`                         |
| `useSqlQuery(queryID, params?, options?)` | `{ data, isLoading, error, refetch }` — pass `null` to stay idle |
| `useDashboardTheme()`                     | `"dark" \| "light"`                                              |
| `useDashboardStyle()`                     | the host's style object                                          |
| `useDashboardParams()`                    | the parent page's querystring, read-only, string values          |
| `useDashboardClient()`                    | the underlying client, for imperative calls                      |

`params` is the wire shape, `[{ key: "$1", value: "30" }]`. A fresh array literal on every render is fine — the hook keys off the serialized contents, not the array's identity.

`data` is kept across a refetch, so a refreshing table does not blink. `refetch` never throws; the outcome lands in `error`.

## Theme

`useDashboardTheme()` gives you the value; applying it is yours, because your CSS contract is not the SDK's to invent:

```tsx
const theme = useDashboardTheme();
useEffect(() => {
  document.documentElement.dataset.theme = theme;
}, [theme]);
```

For a correct first paint, set it before React mounts — Vite's module entry is deferred, so a one-line script in `<head>` beats an effect:

```html
<script>
  document.documentElement.dataset.theme =
    new URLSearchParams(location.search).get("theme") === "dark" ? "dark" : "light";
</script>
```

`useDashboardTheme` re-renders only on a real change: the host re-sends the current theme on any `<html>` class mutation, and those are filtered out before they reach React.

## Link parameters

`useDashboardParams()` returns the querystring of the page that shows your dashboard, so a link such as `/dashboards/<id>?device=6a1f...` can open it scoped to one device:

```tsx
const { device } = useDashboardParams();
const { data } = useSqlQuery(device ? QUERY_ID : null, device ? [{ key: "$1", value: device }] : []);
```

It starts as `{}`, fills in after the handshake, and re-renders when the parent URL changes without a reload, so the first render sees `{}` even on a scoped link. Values are strings, a key the link does not carry is `undefined`, and the host never forwards its own keys. Anyone can write the link, so render values as text, never through `dangerouslySetInnerHTML`. The [core README](../dashboard/README.md#link-parameters) lists them and covers what does not survive the trip. The name is not `useParams` on purpose: a router's `useParams` reads path segments, and this reads the querystring.

## Where this package stops

It owns React concerns only — lifecycle, context, subscription-to-render, and discarding superseded responses. **There is no cache**, no `staleTime`, no query keys, no window-focus refetch, no retry policy, no invalidation.

If you want caching, use a library built for it. The client throws on failure precisely so it drops into one:

```tsx
const client = useDashboardClient();
useQuery({
  queryKey: ["sql", queryID, params],
  queryFn: () => client.sql.run(queryID, params),
});
```

There is no automatic retry either. `not_found`, `forbidden`, `bad_request`, and `unknown_op` are never transient, and silently re-running SQL doubles the load. `refetch()` is the retry, and a button is what should trigger it.

## Sharing a client

`<DashboardProvider>` creates, starts, and stops its own client. To share one with non-React code, create it yourself and pass it as `client`:

```tsx
import { DashboardClient, DashboardProvider } from "@tago-io/custom-dashboard-react";

const client = new DashboardClient({ autoStart: true });
startLegacyWidgets(client); // your non-React code

createRoot(document.getElementById("root")).render(
  <DashboardProvider client={client}>
    <App />
  </DashboardProvider>
);
```

That client stays yours. The provider never starts or stops it, so the other code keeps getting answers after the React tree unmounts. Start it before rendering: a hook's call on a client that is not running rejects with `aborted`. Call `client.stop()` once nothing uses it. Options set on the provider, such as `timeoutMs`, apply only to a client it creates.

## StrictMode

Supported, with one dev-only wrinkle: StrictMode mounts, unmounts, and mounts again, so the shell announces itself twice. That is deliberate: making the client's `stop()` irreversible to avoid it would leave it dead after the first cleanup. The host answers every announcement, so the only cost is one extra theme message in development. Queries do not run twice: the first mount's calls wait for the provider to start the client, and the teardown cancels them before they are sent.

## License

Apache-2.0 — see [LICENSE.md](../../LICENSE.md) for details.
