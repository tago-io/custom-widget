## Thin wrapper context

```tsx
function WidgetProvider({ children }: WidgetProviderProps) {
  const [state, dispatch] = useReducer(widgetReducer, initialState);const isReadySent = useRef(false);

  const refresh = () => {
    globalThis.TagoIO.ready();
  };

  useEffect(() => {
    if (typeof globalThis.TagoIO === "undefined") return;
    if (isReadySent.current) return;

    isReadySent.current = true;

    globalThis.TagoIO.onStart((widget: Widget) => {
      const userId = String(widget?.display?.user?.id ?? "");
      dispatch({ type: "SET_READY", payload: { userId } });
    });

    globalThis.TagoIO.onSyncUserInformation((user: TUserInformation) => {
      if (user) {
        dispatch({ type: "SET_USER_INFORMATION", payload: user });
      }
    });

    globalThis.TagoIO.onRealtime((realtimeData: any[]) => {
      for (const block of realtimeData) {
        if (block?.resource?.type === "device") {
          dispatch({
            type: "SET_DEVICES",
            payload: (block.result as SkyloDevice[]) ?? [],
          });
        } else if (block?.resource?.type === "entity") {
          dispatch({
            type: "SET_ENTITIES",
            payload: (block.result as SkyloEntity[]) ?? [],
          });
        } else if (block?.data || block?.result) {
          const results: any[] = block.result ?? [];
          const appKeyRecord = results.find(
            (r: any) => r.variable === "user_appkey",
          );
          if (appKeyRecord) {
            dispatch({
              type: "SET_APP_KEY",
              payload: {
                userAppKey: String(appKeyRecord.value ?? ""),
              },
            });
          }
        }
      }
    });

    globalThis.TagoIO.ready();
  }, []);

  return (
    <WidgetContext.Provider value={{ ...state, refresh }}>
      {children}
    </WidgetContext.Provider>
  );
}
```

This context will trigger re-renders for EVERYTHING under the context's tree when data arrives, because with `onRealtime` each data update (even a single new record added on a single device) messages the **FULL** "resolved data" array to the custom widget.

`useReducer` is not incorrect here but it doesn't solve anything, `useState` would have the same problems.

### Problem

This is **not good for library code**, because if a custom widget receives 10 data items per second the widget will re-render in full every second with 10 new items

Context like this shifts the burden of optimizing performance entirely to the developer using our library, because our context is "naive"

Even other components that don't even use `widgetData` will be affected, and developer will have to deal with `memo()` constantly to try to mitigate this.

Using the current/old custom widget SDK would be preferred since it allows more control

For example, if the developer does something like:

```tsx
// custom widget "main component"
// composes with different sub-components
function MyWidget() {
  return (
    <WidgetContext>
      <TagoDataComponent />
      <ExternalDataChart />
    </WidgetContext>
  );
}
 
function TagoDataComponent() {
  // this is a wrapper over `useContext`
  const { data } = useRealtimeData();

  // every re-render runs this
  // this "normalizeFunction" is an example where it would only use data from a specific device (from `widgetData`)
  const myNormalizedData = normalizeFunction(data, { onlyDeviceID: "never-updated-device-id" });

  // every change to `data` runs this
  // which with current context implementation, happens in every data update even
  // if the data comes to a device this component doesn't even use, for example "heavy-updated-device-id"
  const memoizedNormalizedData = useMemo(() => {
    return normalizeFunction(data, { onlyDeviceID: "never-updated-device-id" });
  }, [data]);

  return (
    <div>
      thing using data here
    </div>
  );
}

// developer of custom widget wants this component to be a chart
// fetching data from a different source (not related to TagoIO)
// this component is using context so it WILL re-render on every TagoIO data update
// even when it doesn't use anything from "widget data"
function ExternalDataChart() {
  const { data: externalData } = useQueryHook("https://my.site.com/data");
  // this is a wrapper over `useContext`, same context of data
  const { data: user } = useUserInformation();
  
  // this function may be doing heavy logic
  const normalizedData = normalizeChartData(externalData);

  const memoizedNormalizedData = useMemo(() => {
    normalizeChartData(externalData);
  }, [externalData]);

  return (
    <ChartFromExternalData data={normalizedData} />
  );
}
```

### Solution

- Do not put everything in context, we could have a context for data that updates infrequently and the developer would be safe to use it (e.g. user information, widget structure)

- Create data flow + widget update diagrams covering from the initial load, each data update
  - Ideally, we should have a diagram for a custom using only one device/variable, and another scenario using three device/variable pairs
  - This step is important to design the library core

- Study libraries like https://preactjs.com/guide/v10/signals/ and https://github.com/nanostores/nanostores, and also `useSyncExternalStore`
  - This is a decision to make, signals is a good pattern but it requires well-designed implementation (or just use a good library)
  - We could design our own state system combining `useSyncExternalStore` + regular JS variable which doesn't trigger updates + a selector pattern, also requires well-designed implementation
    - e.g. I can in my widget use `const { data } = useWidgetData()` to "subscribe" to everything
    - e.g. or `const { data } = useWidgetData({ selector: (data) => data.filter((dataItem) => dataItem.origin === "some-device");` to only "subscribe" to specific updates


- It's hard to give suggestions on good DX/UX before we have at least a diagram or POC that shows these approaches so we can review / give feedback, context is too simple and I've outlined the main issues (there are other minor ones)
