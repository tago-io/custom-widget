# @tago-io/custom-widget

The JavaScript SDK for building TagoIO Custom Widgets. Works with plain HTML, vanilla JS, or any framework — no build step required.

## Installation

### CDN (Recommended for beginners)

Include the SDK directly in your HTML file:

```html
<!DOCTYPE html>
<html>
  <head>
    <title>My Custom Widget</title>
    <script src="https://admin.tago.io/dist/custom-widget.min.js"></script>
    <link rel="stylesheet" href="https://admin.tago.io/dist/custom-widget.min.css" />
    <!-- OPTIONAL -->
  </head>
  <body>
    <script>
      window.TagoIO.onStart(function (widget) {
        console.log("Widget started!", widget);
      });

      window.TagoIO.ready();
    </script>
  </body>
</html>
```

### NPM

For projects using webpack or other build tools:

```bash
npm install @tago-io/custom-widget --save
```

Then import in your entry file:

```javascript
import "@tago-io/custom-widget";
import "@tago-io/custom-widget/dist/custom-widget.css"; // OPTIONAL
```

## Getting Started

Every custom widget follows the same basic pattern:

1. **Tell TagoIO your widget is ready** with `TagoIO.ready()`
2. **Receive data** through callbacks like `onStart`, `onRealtime`, etc.
3. **Send data** back to devices when needed

```javascript
// 1. Set up your callbacks first
window.TagoIO.onStart(function (widget) {
  console.log("Widget config:", widget);
});

window.TagoIO.onRealtime(function (data) {
  console.log("New data:", data);
});

window.TagoIO.onError(function (error) {
  console.error("Error:", error);
});

// 2. Signal that your widget is ready
window.TagoIO.ready();
```

## API Reference

The SDK exposes everything through the global `window.TagoIO` object.

### Initialization

| Function                   | Direction   | Description                                                                                                                  |
| -------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `TagoIO.ready(options)`    | You send    | Tells TagoIO your widget has finished loading. **Must be called** to activate your widget.                                   |
| `TagoIO.onStart(callback)` | You receive | Called when TagoIO starts your widget. Provides configuration, variables, and settings.                                      |
| `TagoIO.onError(callback)` | You receive | Called when the dashboard reports a failed request ([Error Handling](#error-handling)). Platform API errors do not reach it. |

### Data Operations

> **Note**: These operations only work with data that is within the Custom Widget's configured settings and permissions.

| Function                                  | Direction | Description                                                                                                                              |
| ----------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `TagoIO.sendData(data, callback)`         | You send  | Send one record or an array to the devices bound to the widget ([Sending Data](#sending-data))                                           |
| `TagoIO.editData(data, callback)`         | You send  | Change stored records: each needs its `id`, its `variable` and the new `value` ([Editing and deleting data](#editing-and-deleting-data)) |
| `TagoIO.deleteData(data, callback)`       | You send  | Delete stored records, given as `"<recordId>:<deviceId>"` strings ([Editing and deleting data](#editing-and-deleting-data))              |
| `TagoIO.editResourceData(data, callback)` | You send  | Edit platform resource rows (devices, users, entities)                                                                                   |
| `TagoIO.refreshResources()`               | You send  | Ask the dashboard to load the widget's resource rows again. No reply: any rows it loads arrive through `onRealtime`                      |

`sendData`, `editData`, `deleteData` and `editResourceData` return a Promise, or `undefined` when you pass a `callback`, which then receives `(data)` on success and `(null, error)` on failure.

### Real-time Events

| Function                                  | Direction   | Description                                                                                                                                        |
| ----------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TagoIO.onRealtime(callback)`             | You receive | Called with every data and resource block the widget has, each time that set changes ([Working with Real-time Data](#working-with-real-time-data)) |
| `TagoIO.onSyncUserInformation(callback)`  | You receive | Called after each `ready()` with the viewer's token, language, runURL and preferences                                                              |
| `TagoIO.onSyncBlueprintDevices(callback)` | You receive | Not called: the dashboard does not send blueprint device data ([Blueprint Devices](#blueprint-devices))                                            |

### Utilities

| Function                    | Description                                                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `TagoIO.openLink(url)`      | Open a dashboard in the same tab or a web page in a new tab ([Navigation](#navigation))                                             |
| `TagoIO.closeModal()`       | Close the modal a header button opened the widget in. Does nothing on a dashboard tile                                              |
| `TagoIO.runAnalysis(scope)` | Run the Analysis selected in the widget settings, with `scope` as its input. No reply ([Running an Analysis](#running-an-analysis)) |
| `TagoIO.autoFill`           | `true` by default: `sendData` and `editData` fill each record's `device` and `origin` from the widget's bound variables             |

## Working with Real-time Data

Each `onRealtime` call carries every block the widget has, not only what changed, so rebuild your view from it instead of appending to what you have. Data blocks hold their records in `result`. Resource blocks (device, user and entity rows) have `resource` instead of `data`.

```javascript
window.TagoIO.onRealtime(function (data) {
  data.forEach(function (dataGroup) {
    // Resource blocks hold rows, not data records.
    if (dataGroup.resource || !dataGroup.result) {
      return;
    }
    dataGroup.result.forEach(function (dataPoint) {
      console.log("Variable:", dataPoint.variable);
      console.log("Value:", dataPoint.value);
      console.log("Time:", dataPoint.time);
    });
  });
});
```

## Sending Data

With `autoFill` on (the default), a record needs only its `variable` and `value`: the SDK adds `device` and `origin` from the widget's binding for that variable, and `bucket` when the binding has one.

```javascript
// No request times out by itself, and some failures get no reply.
function withTimeout(promise, ms) {
  let timeoutId;
  const timeout = new Promise(function (resolve, reject) {
    timeoutId = setTimeout(function () {
      reject(new Error("No reply from TagoIO after " + ms / 1000 + " seconds."));
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(function () {
    clearTimeout(timeoutId);
  });
}

async function sendSensorData() {
  try {
    const reply = await withTimeout(
      window.TagoIO.sendData({ variable: "temperature", value: 25.5, unit: "°C" }),
      10000
    );
    // The promise resolves even when the platform refused the write, so check each entry.
    const refused = reply.result.filter(function (entry) {
      return entry.status === "rejected";
    });
    if (refused.length > 0) {
      console.error("Not stored:", refused[0].reason);
      return;
    }
    console.log("Data stored:", reply.result);
  } catch (error) {
    console.error("Failed to send data:", error.message);
  }
}
```

Plan for the following:

- **Send after `onStart`, and only bound variables.** The SDK drops a record whose variable is not bound to the widget. When it drops every record, as it does before the widget settings arrive, the promise never settles.
- **A variable bound on several devices is written to each.** The SDK makes one record per device the variable is bound on. To write to one device only, turn `autoFill` off and pass `origin` ([Editing and deleting data](#editing-and-deleting-data)).
- **A resolved promise does not prove the write.** `result` holds one entry per request the dashboard made to the platform: `{ status: "fulfilled", value }` or `{ status: "rejected", reason }`.
- **Stop waiting after a while.** No request times out by itself, and some failures get no reply, so race each call against a timer, as `withTimeout` does.
- **Rejections are plain objects.** A record whose `variable`, `origin` and `bucket` match none of the widget's bindings rejects with the dashboard's reply, `{ status: false, message: "Invalid variable" }`, not an `Error`, so read `error.message`. The same reply also reaches `onError`.

## Editing and deleting data

Edit and delete the records `onRealtime` delivers. `editData` takes each record's `id` and `variable` with the new `value`. `deleteData` takes `"<recordId>:<deviceId>"` strings, one or an array, so one call can delete records from several devices.

```javascript
// withTimeout is the helper from Sending Data.
async function changeValue(record, value) {
  try {
    // autoFill adds device and origin from the widget's binding for record.variable.
    await withTimeout(window.TagoIO.editData({ id: record.id, variable: record.variable, value: value }), 10000);
    console.log("Saved");
  } catch (error) {
    console.error("Not saved:", error.message);
  }
}

async function removeRecord(record) {
  try {
    await withTimeout(window.TagoIO.deleteData(record.id + ":" + record.device), 10000);
    console.log("Deleted");
  } catch (error) {
    console.error("Not deleted:", error.message);
  }
}
```

To choose the device yourself, turn `autoFill` off. `sendData` and `editData` then send records exactly as you write them, and the dashboard accepts a record only when its `variable`, `origin` and `bucket` match one of the widget's bindings, so copy them from `widget.display.variables`:

```javascript
window.TagoIO.autoFill = false;

let bindings = [];
window.TagoIO.onStart(function (widget) {
  bindings = widget.display.variables;
});

function sendToDevice(deviceId, value) {
  const binding = bindings.find(function (item) {
    return item.variable === "temperature" && item.origin.id === deviceId;
  });
  if (!binding) {
    throw new Error("temperature is not bound to device " + deviceId);
  }
  return window.TagoIO.sendData({
    variable: "temperature",
    value: value,
    origin: binding.origin.id,
    bucket: binding.origin.bucket,
  });
}
```

Plan for the following:

- **`editData` goes through `autoFill` like `sendData`.** The record's variable must be bound to the widget, and a variable bound on several devices sends one edit per device. `deleteData` ignores `autoFill`: each string names its device.
- **With `autoFill` off, every record needs `origin`.** A record without it makes the call throw before any Promise exists, so `.catch()` never sees the error: wrap the call in `try`/`catch`.
- **A resolved promise means the platform accepted the change.** When the platform refuses an edit or a delete, the dashboard shows an error toast and never replies, so the promise stays pending: race it against a timeout.
- **`"Failed to delete"` reaches only `onError`.** The dashboard sends it without the request key, so no promise settles for it.
- **Keep confirmed changes on screen.** Realtime may not bring an edit or a delete back, and a later push can still carry the old record. Apply what you confirmed on top of each new snapshot until realtime shows it, as `edit-delete-data.html` does.

## Editing Resources

The payload identity key depends on the resource type. Only columns listed in the resource's `editable` array are accepted; the platform enforces this server-side.

```javascript
async function saveRows() {
  // Device row: identity key is `device`
  await window.TagoIO.editResourceData({ device: "DEVICE_ID", name: "New name", "tags.type": "sensor" });

  // User row: identity key is `user`
  await window.TagoIO.editResourceData({ user: "USER_ID", phone: "+1 555 0100" });

  // Entity row: row `id` plus the entity block id (resource.id)
  await window.TagoIO.editResourceData({ id: "ROW_ID", entity: "ENTITY_ID", status: "closed" });
}
```

Plan for the following:

- **Keep entity rows and device or user rows in separate calls.** The dashboard sends all the rows of one call to a single endpoint.
- **Rows do not update by themselves.** After a save, call `refreshResources()` to load device, user and entity_list rows again. Nothing replies to it, and any rows it loads arrive through `onRealtime`.
- **Check entity results.** An entity edit can resolve even when the platform refused it: `result.status` holds the HTTP status, and `result.data` the API answer, which can carry `status: false`.
- **Stop waiting after a while.** The promise settles only when the dashboard answers, so race it against a timeout, as in [Sending Data](#sending-data).

## Running an Analysis

`runAnalysis(scope)` runs the Analysis selected in the widget settings, under **Options** > **Run analysis when sending data**. The widget gets the ID of that Analysis in `widget.analysis_run`.

```javascript
// Markup: <button id="run" type="button" disabled>Run Analysis</button>
window.TagoIO.onStart(function (widget) {
  // The dashboard ignores runAnalysis while no Analysis is selected.
  document.getElementById("run").disabled = !widget.analysis_run;
});

document.getElementById("run").addEventListener("click", function () {
  // The Analysis receives this array as its scope.
  window.TagoIO.runAnalysis([{ zone: "north" }]);
});
```

Plan for the following:

- **Nothing runs without a selected Analysis.** The dashboard ignores the call while `widget.analysis_run` is empty, so keep the control disabled until it is set.
- **No reply comes back.** `runAnalysis` returns nothing, and the widget never learns whether the Analysis ran or failed. To show a result, have the Analysis write to a variable the widget reads, and watch `onRealtime` for the new record.
- **Send the scope as an array of plain objects.** The Analysis receives that array as its `scope`. A single object arrives wrapped in an array, and a string does not arrive as sent. The dashboard removes the `source`, `displayValue` and `orderingValue` keys from each item, and a `source` value can also rewrite or drop the item, so leave those keys out.

## Blueprint Devices

The dashboard does not send blueprint device data to custom widgets, so `onSyncBlueprintDevices` is never called. On a blueprint dashboard, read the selected devices from the widget's variables instead: each `origin.id` is the device selected for that variable's blueprint device, and it is `undefined` until the viewer selects one.

```javascript
window.TagoIO.onStart(function (widget) {
  widget.display.variables.forEach(function (item) {
    console.log(item.variable, "comes from device", item.origin.id);
  });
});
```

## User Information

User information arrives once after each `ready()`, right after `onStart`. `token` is the viewer's own session token: keep it out of logs and third-party requests.

```javascript
window.TagoIO.onSyncUserInformation(function (userInfo) {
  console.log("User language:", userInfo.language);
  console.log("Has token:", !!userInfo.token);
  console.log("Run URL:", userInfo.runURL);
});
```

## Navigation

`openLink(url)` asks the dashboard to open a link, and `closeModal()` asks it to close the modal the widget is in. Both return nothing, and no reply comes back.

```javascript
// Markup: three <button type="button"> elements with the ids used below.
// A dashboard, in the same tab. The query string preselects a blueprint device on it.
document.getElementById("open-dashboard").addEventListener("click", function () {
  window.TagoIO.openLink("/dashboards/info/DASHBOARD_ID?IDENTIFIER=DEVICE_ID");
});

// A web page, in a new tab.
document.getElementById("open-docs").addEventListener("click", function () {
  window.TagoIO.openLink("https://docs.tago.io/docs/tagoio/widgets/custom-widget/");
});

// The modal a header button opened this widget in.
document.getElementById("close").addEventListener("click", function () {
  window.TagoIO.closeModal();
});
```

Plan for the following:

- **Dashboards open in the same tab.** A link that contains `/dashboards/info/<dashboardId>` opens that dashboard in the current tab, without a page reload, and keeps the query string. The dashboard drops everything before `/dashboards/`, so the relative form works on the Admin, TagoRUN and TagoDeploy domains alike. Keep `/info/`: the `/dashboards/<id>` address the browser bar shows is not treated as a dashboard link.
- **Blueprint devices are picked by Identifier.** To preselect a device on a blueprint dashboard, add `?<identifier>=<deviceId>` to the link, where `<identifier>` is the Identifier of one of that dashboard's blueprint devices.
- **Web pages open in a new tab.** Any other full `https://` URL opens in a new tab. The dashboard page opens that tab, and browsers block it when the click was not recent, so call `openLink` in the click handler itself, not after awaiting a request or a timer.
- **Some links are not supported.** These do nothing useful: Admin pages other than dashboards (`https://admin.tago.io/devices/<id>`), `mailto:` and `tel:` links, bare e-mail addresses, and relative paths that are not dashboard links. In a dashboard embedded in another site, `openLink` does nothing at all. In the TagoRUN mobile app, or a custom-branded app built on it, the dashboard hands the link to the app.
- **`closeModal` only closes a widget modal.** A header button set to open a widget shows it in a modal, and `closeModal` closes that modal. On a dashboard tile it does nothing, and the widget cannot tell which of the two it is in. A header button set to open an iframe loads the page in a plain iframe, where `onStart` never fires and `closeModal` does nothing.
- **Closing removes the widget from the page.** Let a pending `sendData` or `editData` call settle before `closeModal`, or its reply is lost.

## Scanning QR codes and barcodes

Inside the TagoRUN mobile app, or a custom-branded app built on it, a widget can open the device scanner. This is the one platform capability the SDK does not wrap, so both the request and the reply are plain `postMessage`. The SDK's own listener ignores them, so a listener of your own runs alongside it.

```javascript
// Ask for a scan.
window.parent.postMessage({ method: "barcode" }, "*");

window.addEventListener("message", function (event) {
  // Opened outside a dashboard, `window.parent` is this page, so skip its own request.
  if (event.source === window) {
    return;
  }

  // The reply echoes the method you asked for, with the decoded string in `data`.
  if (event.data && event.data.method === "barcode") {
    console.log("Scanned:", event.data.data);
  }
});
```

`barcode` and `qrcode` open the same scanner, which reads QR codes and 1D barcodes alike. What changes is the reply: a widget that asks for `barcode` is answered with `barcode`.

Plan for the following:

- **It only works inside the mobile app.** Everywhere else, a mobile browser included, the request is dropped in silence. No reply, no error.
- **The reply comes when the user is done, if at all.** It arrives only after the user has aimed and scanned, and no reply is documented for a scan the user cancels. Give the user a way to stop waiting instead of treating a slow reply as a failure.
- **The reply carries no `key`.** The SDK matches data-operation replies by the `key` it sends, but a scan reply never carries one, so it cannot be matched to its request. Keep a single request in flight, and ignore a reply you are no longer waiting for.

## TypeScript Support

`@tago-io/custom-widget` ships no type declarations, so `window.TagoIO` has no type in a TypeScript project. The data types it works with, such as `TWidget`, `TRealtimeData` and `TDataRecord`, are typed in `@tago-io/custom-widget-core`. Install it and declare the members you call:

```bash
npm install @tago-io/custom-widget-core --save-dev
```

```typescript
import "@tago-io/custom-widget";
import type { TRealtimeData, TWidget } from "@tago-io/custom-widget-core";

declare global {
  interface Window {
    TagoIO: {
      onStart(callback: (widget: TWidget) => void): void;
      onRealtime(callback: (data: TRealtimeData[]) => void): void;
      ready(): void;
    };
  }
}

window.TagoIO.onStart((widget) => {
  widget.display.variables.forEach((variable) => {
    console.log(`Variable: ${variable.variable}, Device: ${variable.origin.id}`);
  });
});

window.TagoIO.ready();
```

The React SDK, `@tago-io/custom-widget-react`, ships its own type declarations.

## Error Handling

`onError` receives every failure the dashboard reports with `status: false`. A record whose `variable`, `origin` and `bucket` match none of the widget's bindings gets `"Invalid variable"`, which also rejects that call's promise. `"Failed to delete"` arrives without a request key, so no promise settles for it and it shows up only here. Platform API errors on `sendData`, `editData` and `deleteData` never reach `onError`: check results and set timeouts, as in [Sending Data](#sending-data).

```javascript
window.TagoIO.onError(function (error) {
  console.error("Widget error:", error.message);
  // Show something to the user so they know what happened
});
```

## Performance Tips

- Rebuild your view from each `onRealtime` call instead of appending to it: every call carries the full data set
- Throttle high-frequency updates to avoid UI jank
- Clean up timers and event listeners when the widget is destroyed
- Limit stored data to prevent memory issues

## Examples

This package includes HTML examples in the [`examples/`](./examples/) folder:

| Example                 | What it shows                                          |
| ----------------------- | ------------------------------------------------------ |
| `basic-widget.html`     | Minimal setup and widget lifecycle                     |
| `read-data.html`        | Displaying real-time device data                       |
| `read-resource.html`    | Read platform resources (device list, users, entities) |
| `read-widget-info.html` | Widget config, user info, and blueprint devices        |
| `read-entity.html`      | Complex structured data handling                       |
| `send-data.html`        | Sending data back to devices                           |
| `time-interval.html`    | Time-based data analysis                               |
| `custom-units.html`     | Unit conversions and formatting                        |
| `scan-code.html`        | Scanning a QR code or barcode with the mobile app      |
| `edit-delete-data.html` | Editing and deleting the records a widget receives     |
| `edit-resource.html`    | Editing device, user and entity rows, then refreshing  |
| `navigation.html`       | Opening dashboards and web pages, closing a modal      |
| `run-analysis.html`     | Running the widget's Analysis, showing what it writes  |

## External Project Examples

- [Boilerplate Project](https://github.com/tago-io/custom-widget-boilerplate) — Basic boilerplate using Preact
- [SendData Widget](https://github.com/tago-io/custom-widget-example-send-data) — Sending data from a Custom Widget
- [Wizard Widget](https://github.com/tago-io/custom-widget-example-wizard) — Multi-step wizard demo
- [ECharts Custom Gauge](https://github.com/tago-io/custom-gauge-tutorial) — Custom gauge with ECharts

## License

Apache-2.0 — see [LICENSE.md](../../LICENSE.md) for details.
