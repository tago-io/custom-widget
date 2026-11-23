---
"@tago-io/custom-dashboard": minor
"@tago-io/custom-dashboard-react": minor
---

Custom Dashboards call Analysis Endpoints through the SDK. `endpoint.list()` returns the Endpoints the viewer may call, and `endpoint.call(analysisID, { method, path, query, body })` resolves `{ status, headers, body }` for every HTTP answer, 4xx and 5xx included, rejecting only when the call did not complete. Calls are never shared between identical requests or retried. `@tago-io/custom-dashboard-react` adds `useCallEndpoint()`, which returns `{ callEndpoint, isCalling, error, reset }` and follows the latest call.
