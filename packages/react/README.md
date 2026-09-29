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
  realtimeMaxRecords={1000} // "append" only: how many realtime blocks to keep, not records (default: 1000)
  allowedOrigins={["https://admin.tago.io"]} // optional: drops messages from every other origin
  readyOptions={{ header: { color: "#333" } }}
  dictionary={MyDictionary} // optional: a class whose instances have translate(text), see i18n
>
  <App />
</TagoIOProvider>
```

The provider reads its props once, when it mounts.

Plan for the following:

- **Keep `"merge"`, or use `"replace"`.** The dashboard sends the widget's whole data set in every realtime message, so `"append"` stacks copies of it.
- **`allowedOrigins` must list every origin the dashboard runs on.** Messages from any other origin are dropped, replies included, so a TagoRUN domain, custom domain or TagoDeploy host missing from the list leaves the widget loading and every call pending. Leave it out unless you know them all.

## Hooks

### Receiving Data

| Hook                        | Description                                                                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useWidget()`               | `{ widget, isLoading, variables, dashboardId, widgetId, label }`. `isLoading` stays `true` until the widget settings arrive                                         |
| `useRealtimeData(options?)` | `{ data, records, eventCount, lastUpdatedAt, clear }`: the realtime blocks and their records, with an optional `selector`                                           |
| `useResourceData()`         | `{ resources, getByType, refresh, eventCount, lastUpdatedAt }`: platform resources (device list, users, entities)                                                   |
| `useUserInformation()`      | `{ userInformation, token, language, runURL, customPreferences, preferences }`, empty until it arrives after the widget settings                                    |
| `useBlueprintDevices()`     | `{ blueprintDevices, selected, settings }`, always empty: the dashboard does not send blueprint device data. Read the selected devices from `useWidget().variables` |
| `useWidgetErrors()`         | `{ lastError, errors, clearErrors }`: the failures the dashboard reports ([Widget errors](#widget-errors))                                                          |
| `useWidgetData()`           | Convenience: combines widget + realtime + errors                                                                                                                    |

### Filtering realtime data

Every realtime message re-renders the components that call `useRealtimeData`, with or without a `selector`, because `eventCount` changes on each one. Filter `records` where you render them: each record carries its own `variable` and `device`.

```tsx
const { records } = useRealtimeData();
const temperatures = records.filter((record) => record.variable === "temperature");
```

`selector` receives the realtime blocks and returns the ones to keep, and `data` and `records` then hold only those. Return blocks from the array it receives, as `filter` does: a selector that builds new block objects makes React re-render until it throws.

### Mutations

| Hook                    | Returns                                         |
| ----------------------- | ----------------------------------------------- |
| `useSendData()`         | `{ sendData, isSending, error, reset }`         |
| `useEditData()`         | `{ editData, isEditing, error, reset }`         |
| `useDeleteData()`       | `{ deleteData, isDeleting, error, reset }`      |
| `useEditResourceData()` | `{ editResourceData, isEditing, error, reset }` |

Each function returns a Promise that settles when the dashboard answers. The busy flag is `true` while a call waits for that answer, `error` holds the last rejection, and `reset()` clears both without cancelling the call.

What each function takes:

- `sendData(records)`: one record or an array, such as `{ variable: "temperature", value: 25.5, unit: "°C" }`.
- `editData(records)`: each record's `id` and `variable` with the new `value`, such as `{ id: record.id, variable: record.variable, value: 30 }`.
- `deleteData(records)`: records with `id` and `device`, such as the ones in `useRealtimeData().records`. The hook sends each one as a `"<recordId>:<deviceId>"` string.
- `editResourceData(rows)`: see [Editing resources](#editing-resources).

```tsx
// No request times out by itself, and some failures get no reply.
function withTimeout<T>(promise: Promise<T>, ms = 10_000): Promise<T> {
  let timeoutId = 0;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(`No reply from TagoIO after ${ms / 1000} seconds.`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}

function SendButton() {
  const { sendData, isSending, reset } = useSendData();
  const [status, setStatus] = useState("");

  async function send() {
    try {
      const reply = await withTimeout(sendData({ variable: "temperature", value: 25.5, unit: "°C" }));
      // The promise resolves even when the platform refused the write, so check each entry.
      const refused = (reply.result as unknown as PromiseSettledResult<unknown>[]).filter(
        (entry): entry is PromiseRejectedResult => entry.status === "rejected"
      );
      setStatus(refused.length > 0 ? `Not stored: ${refused[0].reason?.message ?? refused[0].reason}` : "Stored.");
    } catch (error) {
      reset(); // isSending stays true while no reply comes
      setStatus(`Not sent: ${(error as { message?: string }).message}`);
    }
  }

  return (
    <button type="button" disabled={isSending} onClick={() => void send()}>
      {status || "Send"}
    </button>
  );
}

function RecordActions({ record }: { record: TDataRecord }) {
  const { editData, isEditing, reset: resetEdit } = useEditData();
  const { deleteData, isDeleting, reset: resetDelete } = useDeleteData();
  const [status, setStatus] = useState("");

  async function setToZero() {
    try {
      // useEditData adds device and origin from the widget's binding for record.variable.
      await withTimeout(editData({ id: record.id, variable: record.variable, value: 0 }));
      setStatus("Saved.");
    } catch (error) {
      resetEdit();
      setStatus(`Not saved: ${(error as { message?: string }).message}`);
    }
  }

  async function remove() {
    try {
      await withTimeout(deleteData(record));
      setStatus("Deleted.");
    } catch (error) {
      resetDelete();
      setStatus(`Not deleted: ${(error as { message?: string }).message}`);
    }
  }

  return (
    <p>
      <button type="button" disabled={isEditing} onClick={() => void setToZero()}>
        Set to 0
      </button>{" "}
      <button type="button" disabled={isDeleting} onClick={() => void remove()}>
        Delete
      </button>{" "}
      {status}
    </p>
  );
}
```

Plan for the following:

- **Send after the widget settings arrive, and only bound variables.** Wait until `useWidget().isLoading` is `false`. `useSendData` and `useEditData` fill each record's `device` and `origin` from the widget's binding for its variable, and drop a record whose variable is not bound. When they drop every record, the promise never settles.
- **A variable bound on several devices is written to each.** The hooks make one record per device the variable is bound on, and they always fill records this way. To write to a single device, bind the variable on that device only.
- **A resolved `sendData` does not prove the write.** `result` holds one entry per request the dashboard made to the platform: `{ status: "fulfilled", value }` or `{ status: "rejected", reason }`. The `TData` type does not describe it, hence the cast above.
- **A resolved `editData` or `deleteData` means the platform accepted the change.** When the platform refuses one, the dashboard shows an error toast and never replies: the promise stays pending and the busy flag stays `true`. Race each call against a timeout, and call `reset()` when it fires.
- **Rejections are plain objects.** A record whose `variable`, `origin` and `bucket` match none of the widget's bindings rejects with the dashboard's reply, `{ status: false, message: "Invalid variable" }`, not an `Error`, so read `error.message`. The same reply also reaches `useWidgetErrors`.
- **Keep confirmed changes on screen.** Realtime may not bring an edit or a delete back, and a later push can still carry the old record. Apply what you confirmed on top of `records` until realtime shows it, as `edit-delete-data.tsx` does.

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

Plan for the following:

- **Keep entity rows and device or user rows in separate calls.** The dashboard sends all the rows of one call to a single endpoint.
- **Rows do not update by themselves.** After a save, call `refresh()` from `useResourceData()` to load device, user and entity_list rows again. Nothing replies to it, and any rows it loads arrive through `useResourceData()`.
- **Check entity results.** An entity edit can resolve even when the platform refused it: `result.status` holds the HTTP status, and `result.data` the API answer, which can carry `status: false`.
- **Stop waiting after a while.** The promise settles only when the dashboard answers, so race it against a timeout, as `withTimeout` does above.

### Widget errors

`useWidgetErrors()` returns `{ lastError, errors, clearErrors }`. It receives every failure the dashboard reports with `status: false`. A record whose `variable`, `origin` and `bucket` match none of the widget's bindings gets `"Invalid variable"`, which also rejects that call's promise. `"Failed to delete"` arrives without a request key, so no promise settles for it and it shows up only here. Platform API errors on `sendData`, `editData` and `deleteData` never reach it. Entries are plain objects with a `message`, not `Error` instances.

`clearErrors()` empties the list for every component under the provider. A mutation hook's `reset()` does not touch it.

```tsx
function ErrorBanner() {
  const { lastError, clearErrors } = useWidgetErrors();

  if (!lastError) return null;

  return (
    <p role="alert">
      {lastError.message}{" "}
      <button type="button" onClick={clearErrors}>
        Dismiss
      </button>
    </p>
  );
}
```

### Navigation

`useNavigation()` returns `{ openLink, closeModal }`. `openLink(url)` asks the dashboard to open a link, and `closeModal()` asks it to close the modal the widget is in. Both return nothing, and no reply comes back.

```tsx
import { TagoIOProvider, useNavigation } from "@tago-io/custom-widget-react";

function App() {
  return (
    <TagoIOProvider>
      <Links />
    </TagoIOProvider>
  );
}

function Links() {
  const { openLink, closeModal } = useNavigation();

  // Wrap openLink in an arrow function: onClick={openLink} would pass the click event as the URL.
  return (
    <div>
      {/* A dashboard, in the same tab. The query string preselects a blueprint device on it. */}
      <button type="button" onClick={() => openLink("/dashboards/info/DASHBOARD_ID?IDENTIFIER=DEVICE_ID")}>
        Open dashboard
      </button>
      {/* A web page, in a new tab. */}
      <button type="button" onClick={() => openLink("https://docs.tago.io/docs/tagoio/widgets/custom-widget/")}>
        Open the docs
      </button>
      {/* The modal a header button opened this widget in. */}
      <button type="button" onClick={closeModal}>
        Close
      </button>
    </div>
  );
}
```

Plan for the following:

- **Dashboards open in the same tab.** A link that contains `/dashboards/info/<dashboardId>` opens that dashboard in the current tab, without a page reload, and keeps the query string. The dashboard drops everything before `/dashboards/`, so the relative form works on the Admin, TagoRUN and TagoDeploy domains alike. Keep `/info/`: the `/dashboards/<id>` address the browser bar shows is not treated as a dashboard link.
- **Blueprint devices are picked by Identifier.** To preselect a device on a blueprint dashboard, add `?<identifier>=<deviceId>` to the link, where `<identifier>` is the Identifier of one of that dashboard's blueprint devices.
- **Web pages open in a new tab.** Any other full `https://` URL opens in a new tab. The dashboard page opens that tab, and browsers block it when the click was not recent, so call `openLink` in the click handler itself, not after awaiting a request or a timer.
- **Use `openLink`, not a plain link.** An `<a href>` navigates the widget's own frame, not the dashboard around it.
- **Some links are not supported.** These do nothing useful: Admin pages other than dashboards (`https://admin.tago.io/devices/<id>`), `mailto:` and `tel:` links, bare e-mail addresses, and relative paths that are not dashboard links. In a dashboard embedded in another site, `openLink` does nothing at all. In the TagoRUN mobile app, or a custom-branded app built on it, the dashboard hands the link to the app.
- **`closeModal` only closes a widget modal.** A header button set to open a widget shows it in a modal, and `closeModal` closes that modal. On a dashboard tile it does nothing, and the widget cannot tell which of the two it is in. A header button set to open an iframe loads the page in a plain iframe, where `useWidget().isLoading` stays `true` and `closeModal` does nothing.
- **Closing removes the widget from the page.** Let a pending `sendData` or `editData` call settle before `closeModal`, or its reply is lost.

### Running an Analysis

`useRunAnalysis()` returns only `{ runAnalysis }`: no busy flag, no error and no promise. `runAnalysis(scope)` runs the Analysis selected in the widget settings, under **Options** > **Run analysis when sending data**. The widget gets the ID of that Analysis in `widget.analysis_run`.

```tsx
function RunButton() {
  const { widget } = useWidget();
  const { runAnalysis } = useRunAnalysis();
  const [requested, setRequested] = useState(false);

  // The dashboard ignores runAnalysis while no Analysis is selected.
  const hasAnalysis = Boolean(widget?.analysis_run);

  return (
    <button
      type="button"
      disabled={!hasAnalysis}
      onClick={() => {
        // The Analysis receives this array as its scope.
        runAnalysis([{ zone: "north" }]);
        setRequested(true);
      }}
    >
      {requested ? "Requested" : "Run Analysis"}
    </button>
  );
}
```

Plan for the following:

- **Nothing runs without a selected Analysis.** The dashboard ignores the call while `widget.analysis_run` is empty, so keep the control disabled until it is set.
- **No reply comes back.** `runAnalysis` returns nothing, and the widget never learns whether the Analysis ran or failed. To show a result, have the Analysis write to a variable the widget reads, and watch `useRealtimeData` for the new record.
- **Send the scope as an array of plain objects.** The Analysis receives that array as its `scope`. A single object arrives wrapped in an array, and a string does not arrive as sent. The dashboard removes the `source`, `displayValue` and `orderingValue` keys from each item, and a `source` value can also rewrite or drop the item, so leave those keys out.
- **Wrap it in an arrow function.** `onClick={runAnalysis}` would send the click event as the scope, which the browser cannot copy into a message, so the call throws.

### i18n

`useDictionary(options?)` returns `{ t, tSync, dictionary, isLoading, language, error }`, and it does not translate text:

- `tSync(text)` returns `text` unchanged.
- `t(text)` resolves to `text` unchanged, unless the class passed as the provider's `dictionary` prop creates instances with a `translate(text)` method. The `Dictionary` class from `@tago-io/sdk` has no such method, so with it `t` returns the input too.
- `language` is `options.language` when you pass it, and otherwise the viewer's language from user information.

To show labels in the viewer's language, keep your own translations and pick them by language:

```tsx
const LABELS: Record<string, { save: string }> = {
  en: { save: "Save" },
  pt: { save: "Salvar" },
};

function SaveLabel() {
  const { language } = useUserInformation();
  // language is a locale tag such as "pt-BR", and null until user information arrives.
  const labels = LABELS[language?.split(/[-_]/)[0] ?? "en"] ?? LABELS.en;
  return <span>{labels.save}</span>;
}
```

## Formatting and grouping helpers

`@tago-io/custom-widget-react` re-exports these helpers from `@tago-io/custom-widget-core`. The JavaScript SDK does not include them.

```ts
declare function formatValue(
  value: string | number | boolean | undefined,
  options?: {
    locale?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    style?: "decimal" | "currency" | "percent" | "unit";
    currency?: string;
    unit?: string;
  }
): string;

declare function formatDate(
  date: string | Date | number,
  options?: {
    locale?: string;
    dateStyle?: "full" | "long" | "medium" | "short";
    timeStyle?: "full" | "long" | "medium" | "short";
    relative?: boolean;
  }
): string;

declare function groupByDevice(records: TDataRecord[]): Record<string, TDataRecord[]>; // key: device ID
declare function groupByVariable(records: TDataRecord[]): Record<string, TDataRecord[]>; // key: variable name
declare function getLatestByVariable(records: TDataRecord[]): Record<string, TDataRecord>; // newest record per variable
```

```tsx
function LatestTemperatures() {
  const { records } = useRealtimeData();
  const { language } = useUserInformation();
  // Intl rejects tags such as "pt_BR", and undefined uses the browser's language.
  const locale = language?.replace("_", "-");

  return (
    <ul>
      {Object.entries(groupByDevice(records)).map(([deviceId, deviceRecords]) => {
        const latest = getLatestByVariable(deviceRecords).temperature;
        if (!latest) return null;
        const value = formatValue(latest.value, { locale, maximumFractionDigits: 1 });
        const unit = latest.unit ? ` ${latest.unit}` : "";
        return (
          <li key={deviceId}>
            {deviceId}: {value}
            {unit}, {formatDate(latest.time, { locale, relative: true })}
          </li>
        );
      })}
    </ul>
  );
}
```

Plan for the following:

- **Group by device before picking the latest reading.** `getLatestByVariable` and `groupByVariable` key by variable name alone, so records from different devices with the same variable merge. `groupByDevice` keys by each record's `device`, falling back to `origin`. `getLatestByVariable` compares `time` as text.
- **`formatValue` does not know TagoIO units.** Numbers and numeric strings go through `Intl.NumberFormat`. Other strings come back unchanged, booleans as `"true"` or `"false"`, `undefined` as `""` and an empty string as `"0"`. With `style: "unit"`, Intl expects a unit such as `"celsius"`: a unit like `"°C"` makes it fail, and you get the plain number. Append `record.unit` yourself.
- **`formatDate` uses the browser's time zone.** It has no time zone option, and it reads a number as milliseconds. `relative: true` prints text such as `"5 minutes ago"`, and `"now"`, in English, for anything under a second.
- **User information arrives after the widget settings.** Until it does, `language` is `null`, and a `locale` of `undefined` uses the browser's language.

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
- **[edit-delete-data.tsx](./examples/edit-delete-data.tsx)**: Edit and delete the data records a widget receives
- **[navigation.tsx](./examples/navigation.tsx)**: Open a dashboard or web page, or close a widget modal
- **[run-analysis.tsx](./examples/run-analysis.tsx)**: Run the widget's Analysis and show the data it writes
- **[format-data.tsx](./examples/format-data.tsx)**: Format the latest readings in the viewer's language

## Re-exports

All types and utilities from `@tago-io/custom-widget-core` are re-exported, so you only need one import source.

## License

Apache-2.0 — see [LICENSE.md](../../LICENSE.md) for details.
