---
"@tago-io/custom-widget-core": patch
---

Compare every record field when merging realtime updates. Edits that changed only `metadata`, `location`, `group`, `unit` or another field outside `id`, `variable`, `value` and `time` were treated as identical and dropped, so a widget kept showing the old record until the page reloaded.
