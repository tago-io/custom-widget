---
"@tago-io/custom-widget-core": minor
"@tago-io/custom-widget": minor
"@tago-io/custom-widget-react": minor
---

Call an Analysis Endpoint from a Custom Widget with the viewer's session, through `callEndpoint` on the core store, `window.TagoIO.callEndpoint` and the new `useCallEndpoint` hook: every HTTP answer except a redirect resolves with `{ status, headers, body }`, and the promise rejects with `{ code, message }` only when the call did not complete. The React data hooks also no longer stay busy after a StrictMode remount or when the reply arrives while an `<Activity>` hides them, and `useDictionary` loads under StrictMode.

Changes to check when you upgrade:

- `WidgetState.capabilities` is a new required field. Mocks and tests that build a `WidgetState` literal must add it, for example `capabilities: null`.
- `TMethod` gains `"call-endpoint"`, so an exhaustive `switch` over `TMethod` must handle it.
- A request made after the core store is destroyed now rejects at once instead of waiting forever. In React that means after `TagoIOProvider` unmounts, or while an `<Activity>` hides it. Code that calls `sendData`, `editData`, `deleteData` or `editResourceData` without handling the promise may see new unhandled rejections. A request whose message `postMessage` cannot copy already rejected; it now also leaves nothing pending.
- `useSendData`, `useEditData`, `useDeleteData` and `useEditResourceData` follow only the latest call, as `useCallEndpoint` does: with two calls in flight, the first reply no longer clears the busy flag or sets `error`. Their `reset()` now also detaches the call in flight, so its reply no longer changes their state.
- The `error` of those four hooks is typed `TError | Error | null`. A dashboard failure is still the plain `{ status: false, message }` reply, but a request that could not be posted, or that the provider stopped waiting for, rejects with an `Error`. Reading `error.message` still compiles; reading `status` or `result` needs a check first.
