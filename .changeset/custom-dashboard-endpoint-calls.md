---
"@tago-io/custom-dashboard": minor
"@tago-io/custom-dashboard-react": minor
---

Custom Dashboards call Analysis Endpoints through the SDK. `endpoint.list()` returns the Endpoints the viewer may call, and `endpoint.call(analysisID, { method, path, query, body })` resolves `{ status, headers, body }` for every HTTP answer, 4xx and 5xx included, rejecting only when the call did not complete. A request the host would refuse, or that would not arrive as written, is refused with `bad_request` before posting, naming the cause, as with a body on a `GET` or a query array with a gap. A body follows JSON's rules, so a `Number`, `String` or `Boolean` object is sent as its value. Calls are never shared between identical requests or retried. `@tago-io/custom-dashboard-react` adds `useCallEndpoint()`, which returns `{ callEndpoint, isCalling, error, reset }` and follows the latest call.
