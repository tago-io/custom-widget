# @tago-io/custom-widget-core

## 2.3.0

### Patch Changes

- feac263: Compare every record field when merging realtime updates. Edits that changed only `metadata`, `location`, `group`, `unit` or another field outside `id`, `variable`, `value` and `time` were treated as identical and dropped, so a widget kept showing the old record until the page reloaded.

## 2.2.0

### Minor Changes

- a6e9440: Add React support for editing resources with typed resource edit payloads via `editResourceData`. Removes `entity_list` from the edit surface and fixes resource editing examples to resolve tag and param columns and preserve numeric entity values on edit.

## 2.1.0

### Minor Changes

- af21db0: Add support for reading platform resources in realtime, with `refreshResources` for on-demand resource updates and resource exclusion in `useWidgetData`. Resource result values are now typed as JSON.
