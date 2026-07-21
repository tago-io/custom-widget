# React SDK Examples

Simple examples showing how to use `@tago-io/custom-widget-react` in your custom widgets.

Each file is a self-contained React component you can copy into your project.

| Example                                        | What it shows                                          |
| ---------------------------------------------- | ------------------------------------------------------ |
| [read-data.tsx](./read-data.tsx)               | Display real-time data from devices                    |
| [send-data.tsx](./send-data.tsx)               | Send data back to devices with a form                  |
| [read-resource.tsx](./read-resource.tsx)       | Read platform resources (device list, users, entities) |
| [edit-resource.tsx](./edit-resource.tsx)       | Edit resource rows driven by the `editable` columns    |
| [read-widget-info.tsx](./read-widget-info.tsx) | Widget config, user info, and blueprint devices        |

## How to use these

1. Copy the example file into your React project
2. Make sure you have the SDK installed: `npm install @tago-io/custom-widget-react`
3. Render the `App` component from the example as your root component (or adapt it to fit your app)

Every example follows the same pattern:

- Wrap your app in `<TagoIOProvider>` (once, at the top level)
- Use hooks like `useWidget()`, `useRealtimeData()`, `useSendData()` inside your components

## Looking for JavaScript examples?

Check out the [JavaScript SDK examples](../../js/examples/) — they cover the same use cases using plain HTML and `window.TagoIO`.
