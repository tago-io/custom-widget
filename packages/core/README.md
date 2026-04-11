# @tago-io/custom-widget-core

Framework-agnostic core for TagoIO Custom Widget SDKs. Provides the postMessage bridge, external store, realtime strategies, type definitions, and utility functions shared by all framework adapters.

## Installation

```bash
npm install @tago-io/custom-widget-core
```

> Most consumers should install `@tago-io/custom-widget-react` instead, which re-exports everything from core.

## API

### WidgetStore

The central state manager. Handles communication with the TagoIO platform via postMessage and maintains widget state.

```typescript
import { WidgetStore } from "@tago-io/custom-widget-core";

const store = new WidgetStore({
  realtimeStrategy: "merge", // "replace" | "append" | "merge"
  realtimeMaxRecords: 1000, // max records for "append" strategy
  allowedOrigins: ["https://admin.tago.io"], // optional origin validation
  readyOptions: { header: { color: "#333" } },
});

store.initialize(); // sends ready signal to platform
store.subscribe(() => console.log(store.getSnapshot()));
```

### MessageBridge

Low-level postMessage communication with origin validation and request/response correlation.

### Realtime Strategies

Pure functions for handling incoming realtime data:

- **replace** — swap entire array (latest snapshot)
- **append** — concatenate with FIFO cap
- **merge** — structural sharing, only new references for changed records

### Utilities

```typescript
import {
  autoFillRecords,
  groupByVariable,
  groupByDevice,
  getLatestByVariable,
  formatValue,
  formatDate,
  shallowEqual,
} from "@tago-io/custom-widget-core";
```

### Types

All types are exported: `TWidget`, `TDataRecord`, `TDataRecordInput`, `TRealtimeData`, `TUserInformation`, `WidgetState`, etc.
