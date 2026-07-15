---
"@tago-io/custom-widget-core": minor
"@tago-io/custom-widget": minor
"@tago-io/custom-widget-react": minor
---

Support reading and refreshing platform resources (device list, users, entities, entity lists) from the realtime channel.

- **core**: new `TResource`, `TResourceType`, `TResourceFilter`, `TResourceRecord`, and `TResourceGroup` types; `TRealtimeData` now carries an optional `resource` descriptor. The `merge` realtime strategy keys resource blocks separately and replaces them wholesale, so multiple resource collections no longer collide on updates. New `refresh-resources` outbound method and `WidgetStore.refreshResources()`.
- **js**: new `window.TagoIO.refreshResources()` to ask the parent to re-fetch resource collections on demand; the updated data arrives via `onRealtime`.
- **react**: new `useResourceData()` hook exposing typed resource groups with a `getByType` helper and a `refresh()` function; `useRealtimeData().records` no longer mixes in resource items.
- **examples**: `read-resource` (React + JS) now reads real platform resources and has a refresh button; the previous widget-config / user-info / blueprint-devices demo moved to `read-widget-info`.
