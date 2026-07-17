---
"@tago-io/custom-widget-core": minor
"@tago-io/custom-widget": minor
"@tago-io/custom-widget-react": minor
---

Type resource edits. `editResourceData` (core, `window.TagoIO`, and `useEditResourceData`) now takes `TResourceEditInput` — the device/user/entity payload shapes the platform actually accepts (`{ device, ...fields }`, `{ user, ...fields }`, `{ id, entity, ...fields }`) — instead of the data-record `TDataRecordInput`, which never matched the resource endpoint. Compile-time-only change; the wire format is unchanged. Adds the `edit-resource.tsx` React example showing `editable`-driven inline editing.
