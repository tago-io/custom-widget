# @tago-io/custom-widget-react

Build TagoIO Custom Widgets with React. This SDK gives you a set of hooks and a Provider component so you can read device data, send data, and access platform resources using familiar React patterns.

If you're looking for the plain JavaScript version, see [@tago-io/custom-widget](../js/README.md).

## Installation

```bash
npm install @tago-io/custom-widget-react react react-dom
```

## Quick Start

Wrap your app in `<TagoIOProvider>`, then use hooks to access data:

```jsx
import { TagoIOProvider, useWidget, useRealtimeData } from "@tago-io/custom-widget-react";

function App() {
  return (
    <TagoIOProvider>
      <Dashboard />
    </TagoIOProvider>
  );
}

function Dashboard() {
  const { widget, isLoading } = useWidget();
  const { records } = useRealtimeData();

  if (isLoading) return <p>Loading...</p>;

  return (
    <div>
      <h1>{widget?.label}</h1>
      <ul>
        {records.map((r) => (
          <li key={r.id}>
            {r.variable}: {r.value}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## Provider

```tsx
<TagoIOProvider
  realtimeStrategy="merge" // "replace" | "append" | "merge" (default: "merge")
  realtimeMaxRecords={1000} // max records for "append" strategy
  allowedOrigins={["https://admin.tago.io"]} // optional origin validation
  readyOptions={{ header: { color: "#333" } }}
  dictionary={Dictionary} // optional: Dictionary class from @tago-io/sdk
>
  <App />
</TagoIOProvider>
```

## Hooks

### Receiving Data

| Hook                        | Description                                                     |
| --------------------------- | --------------------------------------------------------------- |
| `useWidget()`               | Widget config, loading state, variables, IDs                    |
| `useRealtimeData(options?)` | Realtime data with optional selector for filtering              |
| `useResourceData()`         | Platform resources (device list, users, entities) + `refresh()` |
| `useUserInformation()`      | User token, language, runURL                                    |
| `useBlueprintDevices()`     | Blueprint device selections and settings                        |
| `useWidgetErrors()`         | Error accumulation with clear                                   |
| `useWidgetData()`           | Convenience: combines widget + realtime + errors                |

### Selective Subscriptions

Components only re-render when their specific data slice changes:

```tsx
// Only re-renders when temperature data changes
const { records } = useRealtimeData({
  selector: (data) => data.filter((d) => d.data?.variable?.includes("temperature")),
});
```

### Mutations

| Hook                    | Description                                            |
| ----------------------- | ------------------------------------------------------ |
| `useSendData()`         | Send data records to devices                           |
| `useEditData()`         | Edit existing data records                             |
| `useDeleteData()`       | Delete data records                                    |
| `useEditResourceData()` | Edit platform resource rows (devices, users, entities) |

Each returns its mutation function plus a busy flag, `error`, and `reset` — e.g. `useSendData()` returns `{ sendData, isSending, error, reset }` and `useEditResourceData()` returns `{ editResourceData, isEditing, error, reset }`.

#### Editing resources

The payload identity key depends on the resource type, and only columns listed in the resource's `editable` array are accepted (enforced server-side):

```tsx
const { editResourceData } = useEditResourceData();

// Device row — identity key is `device`
await editResourceData({ device: "DEVICE_ID", name: "New name", "tags.type": "sensor" });

// User row — identity key is `user`
await editResourceData({ user: "USER_ID", phone: "+1 555 0100" });

// Entity row — row `id` plus the entity block id (resource.id)
await editResourceData({ id: "ROW_ID", entity: "ENTITY_ID", status: "closed" });
```

### Navigation

```tsx
const { openLink, closeModal } = useNavigation();
```

### i18n

```tsx
import { Dictionary } from "@tago-io/sdk";

// In provider:
<TagoIOProvider dictionary={Dictionary}>

// In component:
const { t, tSync, language } = useDictionary();
const translated = await t("Hello");
```

## Scanning QR codes and barcodes

Inside the TagoRUN mobile app, or a custom-branded app built on it, a widget can open the device scanner. This is the one platform capability the SDK does not wrap, so both the request and the reply are plain `postMessage`. The provider's own listener ignores them, so your listener runs alongside it.

```tsx
function ScanButton() {
  const [code, setCode] = useState("");

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      // Opened outside a dashboard, `window.parent` is this page, so skip its own request.
      if (event.source === window) {
        return;
      }

      // The reply echoes the method you asked for, with the decoded string in `data`.
      if (event.data?.method === "barcode") {
        setCode(event.data.data);
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Ask for a scan.
  return (
    <button type="button" onClick={() => window.parent.postMessage({ method: "barcode" }, "*")}>
      {code || "Scan barcode"}
    </button>
  );
}
```

`barcode` and `qrcode` open the same scanner, which reads QR codes and 1D barcodes alike. What changes is the reply: a widget that asks for `barcode` is answered with `barcode`.

Plan for the following:

- **It only works inside the mobile app.** Everywhere else, a mobile browser included, the request is dropped in silence. No reply, no error.
- **The reply comes when the user is done, if at all.** It arrives only after the user has aimed and scanned, and no reply is documented for a scan the user cancels. Give the user a way to stop waiting instead of treating a slow reply as a failure.
- **The reply carries no `key`.** The SDK matches data-operation replies by the `key` it sends, but a scan reply never carries one, so it cannot be matched to its request. Keep a single request in flight, and ignore a reply you are no longer waiting for.

## Examples

The [`examples/`](./examples/) folder has ready-to-use `.tsx` files you can copy into your project:

- **[read-data.tsx](./examples/read-data.tsx)** — Display real-time data from devices
- **[send-data.tsx](./examples/send-data.tsx)** — Send data back to devices with a form
- **[read-resource.tsx](./examples/read-resource.tsx)** — Read platform resources (device list, users, entities)
- **[edit-resource.tsx](./examples/edit-resource.tsx)** — Edit resource rows driven by the `editable` columns
- **[read-widget-info.tsx](./examples/read-widget-info.tsx)** — Widget config, user info, and blueprint devices
- **[scan-code.tsx](./examples/scan-code.tsx)** — Scan a QR code or barcode with the mobile app

## Re-exports

All types and utilities from `@tago-io/custom-widget-core` are re-exported, so you only need one import source.

## License

Apache-2.0 — see [LICENSE.md](../../LICENSE.md) for details.
