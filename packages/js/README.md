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
    <link rel="stylesheet" href="https://admin.tago.io/dist/custom-widget.min.css"> <!-- OPTIONAL -->
</head>
<body>
    <script>
        window.TagoIO.onStart(function(widget) {
            console.log('Widget started!', widget);
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
window.TagoIO.onStart(function(widget) {
    console.log('Widget config:', widget);
});

window.TagoIO.onRealtime(function(data) {
    console.log('New data:', data);
});

window.TagoIO.onError(function(error) {
    console.error('Error:', error);
});

// 2. Signal that your widget is ready
window.TagoIO.ready();
```

## API Reference

The SDK exposes everything through the global `window.TagoIO` object.

### Initialization

| Function | Direction | Description |
|----------|-----------|-------------|
| `TagoIO.ready(options)` | You send | Tells TagoIO your widget has finished loading. **Must be called** to activate your widget. |
| `TagoIO.onStart(callback)` | You receive | Called when TagoIO starts your widget. Provides configuration, variables, and settings. |
| `TagoIO.onError(callback)` | You receive | Called when API errors or widget issues occur. |

### Data Operations

> **Note**: These operations only work with data that is within the Custom Widget's configured settings and permissions.

| Function | Direction | Description |
|----------|-----------|-------------|
| `TagoIO.sendData(data, callback)` | You send | Send data to TagoIO devices |
| `TagoIO.editData(data, callback)` | You send | Edit existing device data |
| `TagoIO.deleteData(data, callback)` | You send | Delete device data |
| `TagoIO.editResourceData(data, callback)` | You send | Edit platform resources |

### Real-time Events

| Function | Direction | Description |
|----------|-----------|-------------|
| `TagoIO.onRealtime(callback)` | You receive | Called when new data arrives from connected devices |
| `TagoIO.onSyncUserInformation(callback)` | You receive | Called when user context or authentication updates |
| `TagoIO.onSyncBlueprintDevices(callback)` | You receive | Called when blueprint device configurations change |

### Utilities

| Function | Description |
|----------|-------------|
| `TagoIO.openLink(url)` | Navigate to other dashboards or external links |
| `TagoIO.closeModal()` | Close widget modal (for header button widgets) |
| `TagoIO.autoFill` | Boolean flag to enable/disable automatic device/bucket ID filling |

## Working with Real-time Data

```javascript
window.TagoIO.onRealtime(function(data) {
    data.forEach(function(dataGroup) {
        if (dataGroup.result) {
            dataGroup.result.forEach(function(dataPoint) {
                console.log('Variable:', dataPoint.variable);
                console.log('Value:', dataPoint.value);
                console.log('Time:', dataPoint.time);
            });
        }
    });
});
```

## Sending Data

```javascript
async function sendSensorData() {
    try {
        const result = await window.TagoIO.sendData({
            variable: 'temperature',
            value: 25.5,
            unit: '°C',
            time: new Date().toISOString()
        });
        console.log('Data sent successfully:', result);
    } catch (error) {
        console.error('Failed to send data:', error);
    }
}
```

## Blueprint Devices

```javascript
window.TagoIO.onSyncBlueprintDevices(function(blueprintData) {
    console.log('Blueprint settings:', blueprintData.settings);
    console.log('Selected devices:', blueprintData.selected);
});
```

## User Information

```javascript
window.TagoIO.onSyncUserInformation(function(userInfo) {
    console.log('User language:', userInfo.language);
    console.log('Has token:', !!userInfo.token);
    console.log('Run URL:', userInfo.runURL);
});
```

## Navigation

```javascript
// Navigate to another dashboard
window.TagoIO.openLink('https://admin.tago.io/dashboards/info/dashboard-id');

// Close modal (for header button widgets)
window.TagoIO.closeModal();
```

## TypeScript Support

The SDK includes TypeScript definitions. For TypeScript projects:

```typescript
import "@tago-io/custom-widget";

window.TagoIO.onStart((widget: TWidget) => {
    widget.display.variables.forEach((variable: TWidgetVariable) => {
        console.log(`Variable: ${variable.variable}, Device: ${variable.origin.id}`);
    });
});
```

## Error Handling

Always handle errors so your widget doesn't break silently:

```javascript
window.TagoIO.onError(function(error) {
    console.error('Widget error:', error);
    // Show something to the user so they know what happened
});
```

## Performance Tips

- Use `window.TagoIO.autoFill = true` to automatically handle device/bucket IDs
- Throttle high-frequency updates to avoid UI jank
- Clean up timers and event listeners when the widget is destroyed
- Limit stored data to prevent memory issues

## Examples

This package includes 7 HTML examples in the [`examples/`](./examples/) folder:

| Example | What it shows |
|---------|---------------|
| `basic-widget.html` | Minimal setup and widget lifecycle |
| `read-data.html` | Displaying real-time device data |
| `read-resource.html` | Accessing user info and blueprint devices |
| `read-entity.html` | Complex structured data handling |
| `send-data.html` | Sending data back to devices |
| `time-interval.html` | Time-based data analysis |
| `custom-units.html` | Unit conversions and formatting |

## External Project Examples

- [Boilerplate Project](https://github.com/tago-io/custom-widget-boilerplate) — Basic boilerplate using Preact
- [SendData Widget](https://github.com/tago-io/custom-widget-example-send-data) — Sending data from a Custom Widget
- [Wizard Widget](https://github.com/tago-io/custom-widget-example-wizard) — Multi-step wizard demo
- [ECharts Custom Gauge](https://github.com/tago-io/custom-gauge-tutorial) — Custom gauge with ECharts

## License

Apache-2.0 — see [LICENSE.md](../../LICENSE.md) for details.
