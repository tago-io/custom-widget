---
"@tago-io/custom-widget-core": minor
"@tago-io/custom-widget": minor
"@tago-io/custom-widget-react": minor
---

Support reading platform resources (device list, users, entities, entity lists) from the realtime channel.

- **core**: new `TResource`, `TResourceType`, `TResourceFilter`, `TResourceRecord`, and `TResourceGroup` types; `TRealtimeData` now carries an optional `resource` descriptor. The `merge` realtime strategy keys resource blocks separately and replaces them wholesale, so multiple resource collections no longer collide on updates.
- **react**: new `useResourceData()` hook exposing typed resource groups with a `getByType` helper; `useRealtimeData().records` no longer mixes in resource items.
- **examples**: `read-resource` (React + JS) now reads real platform resources; the previous widget-config / user-info / blueprint-devices demo moved to `read-widget-info`.
