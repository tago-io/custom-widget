# TagoIO Custom Widget React SDK — Definition Document

## 1. Overview

### What it is

The TagoIO Custom Widget React SDK (@tago-io/custom-widget-react) is a React-specific wrapper around the core postMessage-based communication protocol used by TagoIO's Custom Widget system. It translates the imperative, callback-driven JS SDK into an idiomatic React API using a **Context Provider**, **Hooks**, and **utility functions**, so that developers can build Custom Widgets using standard React patterns without manually managing event listeners, callback registration, or global state.

The SDK **reimplements the postMessage bridge internally** rather than depending on @tago-io/custom-widget. The core JS SDK mutates window\.TagoIO and registers global listeners — patterns that conflict with React's lifecycle model. Reimplementing the \~60 lines of postMessage logic keeps the React package independent, avoids global side-effects, and gives full control over initialization timing (critical for Strict Mode and SSR).


### Design Principles

| Principle                           | Description                                                                                                                         |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Declarative over Imperative**     | Replace onStart(callback) / onRealtime(callback) registration with hooks that return reactive state.                                |
| **Zero Global Side-Effects**        | No window\.TagoIO mutation. All state lives inside a React context tree.                                                            |
| **TypeScript-First**                | Full type coverage exported from the package. Developers get IntelliSense out of the box.                                           |
| **Framework-Agnostic within React** | Works with Vite, Next.js, CRA, Remix, or any React 18+ project. No dependency on a specific bundler or meta-framework.              |
| **Incremental Adoption**            | Each hook is independent. Developers only import and use what they need.                                                            |
| **Realtime-Aware State**            | Built-in strategies for merging, replacing, or accumulating realtime data so developers don't have to hand-roll that logic.         |
| **No Styling Opinions**             | The SDK ships zero CSS. Widget styling is entirely the developer's responsibility (Tailwind, CSS Modules, styled-components, etc.). |
| **i18n-Ready**                      | Built-in integration with TagoIO's Dictionary system for multi-language widget support.                                             |


### Peer Dependencies

    {
      "peerDependencies": {
        "react": ">=18.0.0",
        "react-dom": ">=18.0.0"
      }
    }


### Optional Dependencies

    {
      "optionalDependencies": {
        "@tago-io/sdk": ">=1.0.0"
      }
    }

The @tago-io/sdk is optional and only required when using the Dictionary integration (useDictionary hook). The core SDK functionality works without it.

Zero other runtime dependencies. The unique-key generation for the message pool uses crypto.randomUUID() (available in all modern browsers and iframes).

***


## 2. Architecture

    ┌──────────────────────────────────────────────────────────────┐
    │  TagoIO Platform (parent window)                             │
    │  - Sends: widget config, realtime data, user info, errors    │
    │  - Receives: sendData, editData, deleteData, ready, etc.     │
    └────────────────────────┬─────────────────────────────────────┘
                             │ postMessage
    ┌────────────────────────▼─────────────────────────────────────┐
    │  <TagoIOProvider>          (React Context)                    │
    │  ┌─────────────────────────────────────────────────────────┐ │
    │  │  Message Bridge (internal, not exported)                 │ │
    │  │  - addEventListener("message", handler)                  │ │
    │  │  - window.parent.postMessage(msg, "*")                   │ │
    │  │  - Promise pool (Map<uuid, {resolve, reject}>)           │ │
    │  └──────────┬──────────────────────────────────────────────┘ │
    │             │ dispatches to React state                       │
    │  ┌──────────▼──────────────────────────────────────────────┐ │
    │  │  Context State (useReducer)                             │ │
    │  │  - widget: TWidget | null                               │ │
    │  │  - realtimeData: TRealtimeData[]                        │ │
    │  │  - userInformation: TUserInformation | null             │ │
    │  │  - blueprintDevices: TBlueprintDevicesSyncData | null   │ │
    │  │  - errors: TError[]                                     │ │
    │  │  - isReady: boolean                                     │ │
    │  │  - isLoading: boolean                                   │ │
    │  └──────────┬──────────────────────────────────────────────┘ │
    │             │ consumed via split contexts                     │
    │  ┌──────────▼──────────────────────────────────────────────┐ │
    │  │  Public Hooks                                           │ │
    │  │  useWidget / useRealtimeData / useUserInformation /     │ │
    │  │  useBlueprintDevices / useWidgetErrors /                │ │
    │  │  useSendData / useEditData / useDeleteData /            │ │
    │  │  useEditResourceData / useNavigation / useWidgetData /  │ │
    │  │  useDictionary                                         │ │
    │  └─────────────────────────────────────────────────────────┘ │
    │                                                              │
    │  Developer's Custom Widget Component Tree                    │
    └──────────────────────────────────────────────────────────────┘

***


## 3. Modules, Components, and Hooks

### 3.1 \<TagoIOProvider> — Core Context Provider

The single required component. It wraps the entire widget application, initializes the postMessage bridge, and exposes all state through context.

    interface TagoIOProviderProps {
      children: React.ReactNode;

      /**
       * Options passed to the platform when signaling readiness.
       * Equivalent to the current `TagoIO.ready(options)`.
       * @example { displayHeader: false }
       */
      readyOptions?: TReadyOptions;

      /**
       * When true, automatically fills `bucket` and `origin`
       * on sendData/editData calls based on widget variables.
       * @default true
       */
      autoFill?: boolean;

      /**
       * Controls how incoming realtime data is merged with existing state.
       * - "replace": Each realtime event fully replaces the previous data.
       * - "append": New data is appended (with optional maxLength).
       * - "merge": Merges by matching `variable` + `origin`, updating existing
       *   records and appending new ones. This is the most common use case.
       * @default "merge"
       */
      realtimeStrategy?: "replace" | "append" | "merge";

      /**
       * When realtimeStrategy is "append", caps the maximum records kept in
       * state to prevent memory leaks in long-running dashboards.
       * @default 500
       */
      realtimeMaxRecords?: number;
    }

**Responsibilities:**

1. Registers the message event listener on mount, removes it on unmount.

2. Sends the { loaded: true, ...readyOptions } message to the parent **exactly once** on mount (uses a ref guard for Strict Mode safety). This is the equivalent of calling TagoIO.ready().

3. Parses incoming events and dispatches them into React state (useReducer internally).

4. Maintains the promise pool for sendData / editData / deleteData / editResourceData.

5. Guards all window access behind typeof window !== "undefined" checks for SSR safety.

**Why a single Provider:** Custom Widgets are self-contained iframe apps. A single provider keeps the mental model simple — one provider, one widget instance, one communication channel.

***


### 3.2 Hooks — Receiving Data

#### useWidget()

Returns the widget configuration received from onStart. This is the first piece of data the platform sends after ready().

    function useWidget(): {
      /** Full widget object. null until the platform sends onStart. */
      widget: TWidget | null;

      /** true until the first onStart payload arrives. */
      isLoading: boolean;

      /** Shortcut — widget.display.variables or []. */
      variables: TWidgetVariable[];

      /** Shortcut — extracted dashboard ID. */
      dashboardId: string | null;

      /** Shortcut — extracted widget ID. */
      widgetId: string | null;

      /** Shortcut — widget label. */
      label: string | null;
    };

**Usage pattern:** Access widget metadata, configured variables, dashboard ID, etc. isLoading lets you show a skeleton/loader while the platform initializes. Custom parameters set on the TagoIO dashboard are accessible through widget.display — the full object is always available for any custom properties the platform injects.

***


#### useRealtimeData()

Returns realtime data as managed by the chosen realtimeStrategy.

    function useRealtimeData(): {
      /** All realtime data groups currently in state. */
      data: TRealtimeData[];

      /**
       * Flattened convenience accessor: all `result` records across all
       * realtime groups, deduplicated by the merge strategy.
       */
      records: TDataRecord[];

      /** Number of realtime events received since mount. */
      eventCount: number;

      /** Timestamp of the last realtime event. */
      lastUpdatedAt: Date | null;

      /** Manually clear accumulated realtime data. */
      clear: () => void;
    };

**Why this matters:** One of the key challenges is that realtime pushes new data on top of existing data. The realtimeStrategy on the Provider handles this transparently:

| Strategy  | Behaviour                                                                              | Best for                                                     |
| --------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| "replace" | Each realtime event fully replaces the previous data                                   | Widgets that only show the latest snapshot                   |
| "append"  | New data is appended; capped by realtimeMaxRecords (FIFO)                              | Time-series / logging widgets                                |
| "merge"   | Merges by matching variable + origin, updating existing records and appending new ones | Dashboards showing "latest value per variable" (most common) |

records gives a single flat array developers can .map() over directly.

***


#### useUserInformation()

Returns the user context synchronized by the platform.

    function useUserInformation(): {
      /** Full user information payload. null until first sync. */
      userInformation: TUserInformation | null;

      /** Shortcut — authentication token for direct API calls. */
      token: string | null;

      /** Shortcut — user's language code (e.g. "en-US", "pt-BR"). */
      language: string | null;

      /** Shortcut — TagoIO RUN base URL. */
      runURL: string | null;
    };

**Usage pattern:** Use language for i18n/date formatting (and to seed the useDictionary hook), token for direct API calls, runURL for building RUN links.

***


#### useBlueprintDevices()

Returns blueprint device configuration and selections.

    function useBlueprintDevices(): {
      /** Full sync payload. null until first sync. */
      blueprintDevices: TBlueprintDevicesSyncData | null;

      /** Shortcut — currently selected devices. */
      selected: TDashboardSelectedBlueprintDevices;

      /** Shortcut — blueprint device settings. */
      settings: TDashboardBlueprintDevice[];
    };

***


#### useWidgetErrors()

Returns errors dispatched by the platform.

    function useWidgetErrors(): {
      /** The most recent error, or null. */
      lastError: TError | null;

      /** All errors received since mount. */
      errors: TError[];

      /** Clear the error list. */
      clearErrors: () => void;
    };

***


### 3.3 Hooks — Sending Data

These hooks wrap the outbound operations with built-in loading/error state, following the useMutation pattern popular in React (TanStack Query, SWR, etc.).


#### useSendData()

    function useSendData(): {
      sendData: (records: TDataRecord | TDataRecord[]) => Promise<TData>;
      isSending: boolean;
      error: TError | null;
      reset: () => void;
    };


#### useEditData()

    function useEditData(): {
      editData: (records: TDataRecord | TDataRecord[]) => Promise<TData>;
      isEditing: boolean;
      error: TError | null;
      reset: () => void;
    };


#### useDeleteData()

    function useDeleteData(): {
      deleteData: (records: TDataRecord | TDataRecord[]) => Promise<TData>;
      isDeleting: boolean;
      error: TError | null;
      reset: () => void;
    };


#### useEditResourceData()

    function useEditResourceData(): {
      editResourceData: (records: TDataRecord | TDataRecord[]) => Promise<TData>;
      isEditing: boolean;
      error: TError | null;
      reset: () => void;
    };

**Auto-fill behaviour:** When autoFill is true on the Provider (default), useSendData and useEditData automatically populate bucket and origin fields on outbound records based on the widget's configured variables. useDeleteData and useEditResourceData do not auto-fill (matching core SDK behaviour).

***


### 3.4 Hooks — Navigation & Utilities

#### useNavigation()

    function useNavigation(): {
      /** Open a URL in the current window (navigate dashboards, external links). */
      openLink: (url: string) => void;

      /** Close the modal if the widget is rendered inside a header-button modal. */
      closeModal: () => void;
    };

***


### 3.5 Hooks — Internationalization

#### useDictionary(options?)

Integrates with the TagoIO Dictionary system for multi-language widget support. Automatically uses the user's language from useUserInformation() and token to initialize the Dictionary instance.

    interface UseDictionaryOptions {
      /**
       * Override the language detected from user information.
       * If not set, uses the language from useUserInformation().
       */
      language?: string;

      /**
       * Override the token used to initialize the Dictionary.
       * If not set, uses the token from useUserInformation().
       */
      token?: string;

      /**
       * Whether to eagerly fetch the dictionary on mount.
       * @default true
       */
      enabled?: boolean;
    }

    function useDictionary(options?: UseDictionaryOptions): {
      /**
       * Translate a string containing dictionary placeholders.
       * e.g. "Welcome #DICT.GREETING#!" → "Bem-vindo!"
       * Returns the original string while loading or if translation fails.
       */
      t: (text: string) => Promise<string>;

      /**
       * Synchronous version — returns from cache if available,
       * returns the raw input string if not yet loaded.
       */
      tSync: (text: string) => string;

      /** The underlying Dictionary instance, for advanced use cases. */
      dictionary: Dictionary | null;

      /** Whether the dictionary is currently loading. */
      isLoading: boolean;

      /** The active language code. */
      language: string | null;

      /** Error if dictionary initialization failed. */
      error: Error | null;
    };

**How it works internally:**

1. Reads token and language from useUserInformation() (or from override options).

2. Once both are available, instantiates new Dictionary({ token, language }) from @tago-io/sdk.

3. Caches translated strings internally so that tSync can return results synchronously after the first async resolution.

4. Re-initializes the Dictionary when language changes (user switches language in the dashboard).

**Graceful degradation:** If @tago-io/sdk is not installed, the hook logs a warning and returns a no-op t function that returns the input string unchanged. The rest of the SDK works without it.

***


### 3.6 High-Level Convenience Hook

#### useWidgetData()

A single "batteries-included" hook for the most common scenario: reading widget config + realtime data together. It handles the initial loading state and realtime accumulation in one call.

    function useWidgetData(): {
      /** Widget config (null while loading). */
      widget: TWidget | null;

      /** Whether the widget has started. */
      isLoading: boolean;

      /** Flattened, deduplicated data records from all realtime events. */
      records: TDataRecord[];

      /** Number of realtime pushes received. */
      realtimeEventCount: number;

      /** Timestamp of last realtime push. */
      lastUpdatedAt: Date | null;

      /** All errors. */
      errors: TError[];
    };

This is the hook most developers will reach for first. It covers \~80% of use cases with a single import. Internally it composes useWidget(), useRealtimeData(), and useWidgetErrors().

***


## 4. Exported Utilities

These are **pure functions** (no React dependency) exported from the package. They can be used in components, helpers, reducers, or tests.


### 4.1 autoFillRecords(records, widgetVariables)

Automatically fills device, origin, and bucket fields on outbound data records based on the widget's configured variables.

    function autoFillRecords(
      records: TDataRecord[],
      widgetVariables: TWidgetVariable[]
    ): TDataRecord[];


### 4.2 groupByVariable(records)

Groups a flat array of TDataRecord\[] by variable name. Extremely common when rendering charts or tables.

    function groupByVariable(
      records: TDataRecord[]
    ): Record<string, TDataRecord[]>;


### 4.3 groupByDevice(records)

Groups records by device (or origin ID).

    function groupByDevice(
      records: TDataRecord[]
    ): Record<string, TDataRecord[]>;


### 4.4 getLatestByVariable(records)

Returns only the most recent record for each unique variable name. Useful for "current value" displays.

    function getLatestByVariable(
      records: TDataRecord[]
    ): Record<string, TDataRecord>;


### 4.5 formatValue(value, options)

A lightweight locale-aware formatter for numeric values with unit display.

    interface FormatValueOptions {
      decimals?: number;
      unit?: string;
      locale?: string;        // e.g. "en-US", "pt-BR"
      notation?: "standard" | "compact" | "scientific";
    }

    function formatValue(
      value: string | number | boolean | undefined,
      options?: FormatValueOptions
    ): string;

**Examples:**

    formatValue(1234.5, { decimals: 1, unit: "°C", locale: "en-US" });
    // → "1,234.5 °C"

    formatValue(1234.5, { decimals: 1, unit: "°C", locale: "pt-BR" });
    // → "1.234,5 °C"

    formatValue(1500000, { notation: "compact", locale: "en-US" });
    // → "1.5M"


### 4.6 formatDate(date, options)

A locale-aware date/time formatter. Uses Intl.DateTimeFormat under the hood.

    type DateFormatPreset = "date" | "time" | "datetime" | "relative" | "iso";

    interface FormatDateOptions {
      /** User locale. @default "en-US" */
      locale?: string;

      /**
       * Preset format or custom Intl.DateTimeFormat options.
       * - "date": date only (e.g. "02/13/2026")
       * - "time": time only (e.g. "3:45 PM")
       * - "datetime": date + time (e.g. "02/13/2026, 3:45 PM")
       * - "relative": relative time (e.g. "5 minutes ago", "in 2 hours")
       * - "iso": ISO 8601 string (e.g. "2026-02-13T15:45:00.000Z")
       * - Intl.DateTimeFormatOptions: custom format object
       * @default "datetime"
       */
      format?: DateFormatPreset | Intl.DateTimeFormatOptions;

      /**
       * Timezone override.
       * If not set, uses the browser's local timezone.
       * @example "America/Sao_Paulo"
       */
      timezone?: string;
    }

    function formatDate(
      date: Date | string | number,
      options?: FormatDateOptions
    ): string;

**Examples:**

    formatDate("2026-02-13T15:45:00Z", { locale: "en-US", format: "datetime" });
    // → "02/13/2026, 3:45 PM"

    formatDate("2026-02-13T15:45:00Z", { locale: "pt-BR", format: "date" });
    // → "13/02/2026"

    formatDate("2026-02-13T15:45:00Z", { locale: "en-US", format: "time" });
    // → "3:45 PM"

    formatDate("2026-02-13T15:45:00Z", {
      locale: "en-US",
      format: "relative",
    });
    // → "5 minutes ago" (depends on current time)

    formatDate("2026-02-13T15:45:00Z", { format: "iso" });
    // → "2026-02-13T15:45:00.000Z"

    formatDate("2026-02-13T15:45:00Z", {
      locale: "de-DE",
      format: { weekday: "long", year: "numeric", month: "long", day: "numeric" },
    });
    // → "Freitag, 13. Februar 2026"

    formatDate("2026-02-13T15:45:00Z", {
      locale: "en-US",
      format: "datetime",
      timezone: "America/Sao_Paulo",
    });
    // → "02/13/2026, 12:45 PM"

**Relative time implementation:** Uses Intl.RelativeTimeFormat to produce human-readable relative strings. Automatically selects the best unit (seconds, minutes, hours, days, months, years) based on the difference from Date.now().


### 4.7 Type Exports

All types from the current types.d.ts are re-exported for consumers:

    export type {
      TWidget,
      TWidgetVariable,
      TDataRecord,
      TRealtimeData,
      TUserInformation,
      TBlueprintDevicesSyncData,
      TDashboardBlueprintDevice,
      TDashboardSelectedBlueprintDevices,
      TDashboardSelectedBlueprintDevice,
      TDevice,
      TData,
      TError,
      TReadyOptions,
      TResultData,
    };

***


## 5. Package Exports Map

    @tago-io/custom-widget-react
    │
    │  Components
    ├── TagoIOProvider              (component)
    │
    │  Hooks — Receiving Data
    ├── useWidget                   (hook)
    ├── useRealtimeData             (hook)
    ├── useUserInformation          (hook)
    ├── useBlueprintDevices         (hook)
    ├── useWidgetErrors             (hook)
    ├── useWidgetData               (hook, convenience)
    │
    │  Hooks — Sending Data
    ├── useSendData                 (hook)
    ├── useEditData                 (hook)
    ├── useDeleteData               (hook)
    ├── useEditResourceData         (hook)
    │
    │  Hooks — Navigation
    ├── useNavigation               (hook)
    │
    │  Hooks — Internationalization
    ├── useDictionary               (hook, requires @tago-io/sdk)
    │
    │  Utilities — Data
    ├── autoFillRecords             (utility)
    ├── groupByVariable             (utility)
    ├── groupByDevice               (utility)
    ├── getLatestByVariable         (utility)
    │
    │  Utilities — Formatting
    ├── formatValue                 (utility)
    ├── formatDate                  (utility)
    │
    │  Types
    └── types                       (all TypeScript types)

***


## 6. Abstracted Example — Full Widget

A complete example showing how a developer builds a multi-language temperature dashboard widget. This covers all major challenges: widget initialization, realtime data, user settings, custom parameters, data mutations, i18n with Dictionary, and error handling.


### Entry point

    import React from "react";
    import ReactDOM from "react-dom/client";
    import { TagoIOProvider } from "@tago-io/custom-widget-react";
    import { App } from "./App";

    ReactDOM.createRoot(document.getElementById("root")!).render(
      <TagoIOProvider
        realtimeStrategy="merge"
        realtimeMaxRecords={200}
        autoFill
      >
        <App />
      </TagoIOProvider>
    );


### Application component

    import {
      useWidget,
      useRealtimeData,
      useUserInformation,
      useSendData,
      useWidgetErrors,
      useNavigation,
      useDictionary,
      getLatestByVariable,
      groupByVariable,
      formatValue,
      formatDate,
    } from "@tago-io/custom-widget-react";
    import type { TDataRecord } from "@tago-io/custom-widget-react";

    export function App() {
      const { widget, isLoading, variables } = useWidget();
      const { records, lastUpdatedAt, clear } = useRealtimeData();
      const { language } = useUserInformation();
      const { lastError } = useWidgetErrors();
      const { sendData, isSending } = useSendData();
      const { openLink } = useNavigation();

      // Dictionary integration — auto-uses token + language from user info
      const { tSync } = useDictionary();

      // Determine locale from user information
      const locale = language ?? "en-US";

      // ----- Loading state -----
      if (isLoading) {
        return <div className="loading">{tSync("#DICT.LOADING#")}</div>;
      }

      // ----- Derived data -----
      const latestValues = getLatestByVariable(records);
      const groupedData = groupByVariable(records);

      // ----- Custom parameters (from widget display config) -----
      const headerUrl = widget?.display?.url;

      // ----- Handlers -----
      const handleSendReading = async () => {
        await sendData({
          variable: "temperature",
          value: 22.5,
          unit: "°C",
          time: new Date().toISOString(),
        } as TDataRecord);
      };

      return (
        <div className="widget-container">
          {/* Error banner */}
          {lastError && (
            <div className="error-banner">
              {tSync("#DICT.ERROR#")}: {lastError.message}
            </div>
          )}

          {/* Widget header info */}
          <header>
            <h1>{widget?.label ?? tSync("#DICT.DEFAULT_TITLE#")}</h1>
            <p>
              {tSync("#DICT.TRACKING#")} {variables.length} variable(s) ·{" "}
              {tSync("#DICT.LAST_UPDATE#")}:{" "}
              {lastUpdatedAt
                ? formatDate(lastUpdatedAt, { locale, format: "datetime" })
                : tSync("#DICT.WAITING#")}
            </p>
          </header>

          {/* Current readings */}
          <section className="current-readings">
            <h2>{tSync("#DICT.CURRENT_VALUES#")}</h2>
            {Object.entries(latestValues).map(([variable, record]) => (
              <div key={variable} className="reading-card">
                <strong>{variable}</strong>
                <span className="value">
                  {formatValue(record.value, {
                    decimals: 1,
                    unit: record.unit,
                    locale,
                  })}
                </span>
                <small>
                  {formatDate(record.time, { locale, format: "relative" })}
                </small>
              </div>
            ))}
          </section>

          {/* Historical data grouped by variable */}
          <section className="history">
            <h2>{tSync("#DICT.HISTORY#")}</h2>
            {Object.entries(groupedData).map(([variable, variableRecords]) => (
              <div key={variable}>
                <h3>
                  {variable} ({variableRecords.length} records)
                </h3>
                <table>
                  <thead>
                    <tr>
                      <th>{tSync("#DICT.VALUE#")}</th>
                      <th>{tSync("#DICT.TIME#")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variableRecords.slice(-10).map((record) => (
                      <tr key={record.id}>
                        <td>
                          {formatValue(record.value, {
                            decimals: 2,
                            unit: record.unit,
                            locale,
                          })}
                        </td>
                        <td>
                          {formatDate(record.time, { locale, format: "datetime" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            <button onClick={clear}>{tSync("#DICT.CLEAR_HISTORY#")}</button>
          </section>

          {/* Send data */}
          <section>
            <button onClick={handleSendReading} disabled={isSending}>
              {isSending ? tSync("#DICT.SENDING#") : tSync("#DICT.SEND_READING#")}
            </button>
          </section>

          {/* Navigation */}
          {headerUrl && (
            <button onClick={() => openLink(headerUrl)}>
              {tSync("#DICT.OPEN_DASHBOARD#")}
            </button>
          )}
        </div>
      );
    }

***


## 7. Addressing the Key Challenges

### 7.1 Capturing Widget Result Data

**Current JS SDK pain point:** The developer must manually call onStart(callback) and store the widget object in a variable, then call onRealtime(callback) and manually merge data arrays.

**React SDK solution:** useWidget() returns the widget config as reactive state with an isLoading flag. useRealtimeData() returns already-merged records. The developer never manages listener registration or state accumulation.


### 7.2 Dealing with Realtime

**Current JS SDK pain point:** Each onRealtime call gives an incremental payload. The developer must decide: replace? append? deduplicate? This logic is duplicated across every widget.

**React SDK solution:** The realtimeStrategy prop on \<TagoIOProvider> handles this at the infrastructure level:

- "replace" — for widgets that only show the latest snapshot.

- "append" — for time-series/logging widgets (capped by realtimeMaxRecords).

- "merge" — for dashboards showing "latest value per variable" (deduplicates by variable + origin, keeping the most recent record).

The developer picks a strategy once and the hook returns the correct state shape.


### 7.3 User Settings (Date/Time Format, Language)

**Current JS SDK pain point:** The developer must call onSyncUserInformation(callback), store the result, and manually pass language into toLocaleString() calls scattered across the codebase.

**React SDK solution:** useUserInformation() exposes language as reactive state. The formatDate() utility accepts a locale parameter with preset formats ("date", "time", "datetime", "relative", "iso") or custom Intl.DateTimeFormatOptions, with optional timezone override. The formatValue() utility handles locale-aware number formatting. Together they eliminate scattered toLocaleString() calls:

    // Before (JS SDK)
    const date = new Date(record.time);
    const formatted = date.toLocaleString(storedLanguage);

    // After (React SDK)
    formatDate(record.time, { locale: language, format: "datetime" });
    formatDate(record.time, { locale: language, format: "relative" }); // "5 min ago"


### 7.4 Custom Widget Parameters

**Current JS SDK pain point:** Custom parameters set on the TagoIO dashboard are buried inside the widget.display object received in onStart. Developers must know the exact shape and path.

**React SDK solution:** useWidget() returns the full widget object, and the destructured convenience fields (variables, label, dashboardId) cover the most common needs. The widget.display object remains fully accessible for any custom properties the platform injects. This is platform-configuration-dependent and will be documented clearly.


### 7.5 Multi-Language / i18n

**Current JS SDK pain point:** Developers who want multi-language widgets must manually instantiate the TagoIO Dictionary, manage the token and language lifecycle, and handle async translations.

**React SDK solution:** useDictionary() automatically reads token and language from useUserInformation(), instantiates the Dictionary, caches translations, and provides both async (t) and synchronous (tSync) translation functions. When the user switches language in the dashboard, the hook re-initializes automatically.

| Topic                     | Decision / Recommendation                                                                                                                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Core SDK dependency**   | **Reimplement the bridge internally.** The core SDK mutates window\.TagoIO and registers global listeners — patterns that conflict with React's lifecycle. The \~60 lines of postMessage logic are trivial to reimplement and keeps the React package independent. |
| **CSS / Styling**         | **Ship zero CSS.** Widget styling is entirely the developer's responsibility. This keeps the SDK truly agnostic.                                                                                                                                                   |
| **Dictionary dependency** | **Optional peer.** @tago-io/sdk is listed as an optional dependency. The useDictionary hook dynamically imports it and degrades gracefully when not installed.                                                                                                     |
| **Strict Mode**           | The Provider must handle React 18 Strict Mode double-mount. The ready() message is sent once (ref guard). Event listeners are cleaned up idempotently.                                                                                                             |
| **SSR**                   | Short-circuit gracefully if window is undefined. Only initialize the bridge on the client side.                                                                                                                                                                    |
| **Versioning**            | **Independent versioning** recommended. The React SDK and core JS SDK have different release cadences and breaking-change surfaces.                                                                                                                                |
| **Bundle format**         | Ship ESM and CJS builds with tree-shaking support. Consumers who only need useRealtimeData should not pull in mutation-hook code.                                                                                                                                  |
| **React version floor**   | React 18+ (for useId, Strict Mode behaviour, concurrent features). React 17 could be supported but would require polyfills and increase maintenance burden — not recommended.                                                                                      |
| crypto.randomUUID()       | Available in all modern browsers and iframe contexts. No polyfill needed. Falls back to a simple UUID v4 implementation if unavailable (edge case for very old webviews).                                                                                          |
| Intl.RelativeTimeFormat   | Used by formatDate with format: "relative". Supported in all modern browsers. No polyfill planned; documents minimum browser requirements.                                                                                                                         |
