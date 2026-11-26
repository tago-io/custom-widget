---
"@tago-io/custom-dashboard": minor
"@tago-io/custom-dashboard-react": minor
---

Custom Dashboards call Analysis Endpoints through the SDK. `endpoint.list()` returns the Endpoints the viewer may call, and `endpoint.call(analysisID, { method, path, query, body })` resolves `{ status, headers, body }` for every HTTP answer, 4xx and 5xx included, rejecting only when the call did not complete. Before posting, the SDK checks the body and the query and rejects with `bad_request`: a body on a `GET`, a body JSON cannot encode or would send as `{}` or as text, and a query value that is not a string, a finite number or a boolean, or an array of them, such as an array with a gap, naming its key. A body follows JSON's rules, so a `Number`, `String` or `Boolean` object inside it is sent as its value. Calls are never shared between identical requests or retried. `@tago-io/custom-dashboard-react` adds `useCallEndpoint()`, which returns `{ callEndpoint, isCalling, error, reset }` and follows the latest call.
