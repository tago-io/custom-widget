export type TMethod =
  | "delete"
  | "edit"
  | "edit-resource"
  | "send"
  | "open-link"
  | "close-modal"
  | "run-analysis"
  | "refresh-resources";

/** GeoJSON Point location format. */
export type TLocationGeoJSON = {
  type: "Point";
  coordinates: [number, number];
};

/** Latitude/Longitude location format. Used when sending data to the API. */
export type TLocationLatLng = {
  lat: number;
  lng: number;
};

/** Metadata for a data record, with well-known keys for TagoIO visualization features. */
export type TMetadata = {
  color?: string;
  x?: string | number;
  y?: string | number;
  label?: string;
  file?: { url: string; md5: string; path: string };
  icon?: string;
  fixed_position?: Record<string, { color: string; icon: string; value: string; x: string; y: string }>;
  sentValues?: Array<{ label: string; value: string | number | boolean }>;
  old_value?: string | number | boolean;
  // biome-ignore lint/suspicious/noExplicitAny: Metadata is an open-ended type that allows arbitrary extra fields
  [key: string]: any;
};

export type TUserPreferences = {
  timezone?: string;
  language?: string;
  date_format?: string;
  time_format?: string;
  decimal_separator?: string;
};

export type TUserInformation = {
  token: string | null;
  language: string | null;
  runURL: string | null;
  custom_preferences?: Record<string, string>;
  preferences?: TUserPreferences;
};

export type TDashboardBlueprintDevice = {
  name: string;
  id: string;
  placeholder?: string;
  label?: string;
  use_item_label_tag?: boolean;
  tag_to_replace?: string;
  conditions: Array<{ key: string; value: string }>;
  filter_conditions?: Array<{ blueprint_device: string; tag_key: string; type: string }>;
  hide_when_empty?: boolean;
};

export type TDevice = {
  id: string;
  name: string;
  tags?: Array<{ key: string; value: string }>;
};

export type TDashboardSelectedBlueprintDevice = {
  name: string;
  device: TDevice | null;
};

export type TDashboardSelectedBlueprintDevices = Record<string, TDashboardSelectedBlueprintDevice | null>;

export type TBlueprintDevicesSyncData = {
  selected: TDashboardSelectedBlueprintDevices;
  settings: TDashboardBlueprintDevice[];
};

export type TWidgetVariable = {
  variable: string;
  origin: {
    id: string;
    /** @deprecated Only for Legacy devices. */
    bucket?: string;
  };
};

/** Data query configuration for a widget's variable origin. */
export type TWidgetData = {
  origin: string;
  qty?: number;
  timezone?: string;
  variables?: string;
  /** @deprecated Only for Legacy devices. */
  bucket?: string;
  query?: "min" | "max" | "count" | "avg" | "sum";
  start_date?: string;
  end_date?: string;
  overwrite?: boolean;
};

export type TWidget = {
  id: string;
  dashboard: string;
  analysis_run?: string | null;
  display: {
    header_buttons?: [];
    help?: string;
    url?: string;
    variables: TWidgetVariable[];
    watermark?: boolean;
    user?: { id?: string };
  };
  data?: TWidgetData[];
  realtime?: boolean | null;
  label?: string;
  type?: string;
};

export type TResultData = {
  value?: string[];
  action: {
    type?: string;
    payload?: string[];
  };
};

export type TData = {
  status: boolean;
  result: TResultData[];
  key: string;
};

export type TReadyOptions = {
  header?: {
    absolute?: boolean;
    color?: string;
  };
};

export type TError = {
  status: boolean;
  message: string;
  result: TDataRecord[];
  key: string;
};

export type TDataRecord = {
  id: string;
  variable: string;
  value?: string | number | boolean;
  group?: string;
  device?: string;
  unit?: string;
  location?: TLocationGeoJSON;
  metadata?: TMetadata;
  /** @deprecated Only relevant for Legacy devices. */
  origin?: string;
  /** @deprecated Only relevant for Legacy devices. */
  bucket?: string;
  time: string;
  /** Server-determined timestamp for when the record was created. */
  created_at?: string;
};

/**
 * Input type for mutation hooks. Unlike TDataRecord, `id` and `time` are optional
 * since they are typically server-generated when sending new data.
 * The `location` field also accepts a LatLng format for convenience.
 */
export type TDataRecordInput = Omit<TDataRecord, "id" | "time" | "location"> & {
  id?: string;
  time?: string;
  location?: TLocationGeoJSON | TLocationLatLng | null;
};

/** Kind of platform resource a realtime block can carry. */
export type TResourceType = "device" | "user" | "entity" | "entity_list";

/** A JSON-serializable value. Platform payloads arrive as JSON, so resource fields use this. */
export type TJSONValue = string | number | boolean | null | TJSONValue[] | { [key: string]: TJSONValue };

/** Filter shape a resource block may carry. The platform picks the representation per resource type. */
export type TResourceFilter = Array<{ key: string; value: string }> | Record<string, TJSONValue> | string;

/**
 * Descriptor of a resource block pushed by the platform (device list, users, entities...).
 * Present on a TRealtimeData block instead of `data` when the block is a resource collection.
 */
export type TResource = {
  type: TResourceType;
  id?: string;
  index?: string;
  view?: string[];
  editable?: string[];
  filter?: TResourceFilter;
  amount?: number;
  orderBy?: string;
};

/**
 * A single item inside a resource block. Keys are data-driven (the requested `view` picks them),
 * so this is an open record of JSON values rather than a fixed shape.
 */
export type TResourceRecord = Record<string, TJSONValue>;

/**
 * A realtime block. Carries either data variables (`data`) or a platform resource collection (`resource`);
 * `result` holds the matching rows (TDataRecord[] for data blocks, TResourceRecord[] for resource blocks).
 */
export type TRealtimeData = {
  data?: {
    variable: string[];
    origin?: string;
    bucket?: string;
  };
  resource?: TResource;
  result?: TDataRecord[] | TResourceRecord[];
};

/** A TRealtimeData block that carries a resource collection, narrowed so `resource`/`result` are guaranteed. */
export type TResourceGroup = {
  resource: TResource;
  result: TResourceRecord[];
};

/** Edit payload for a device row. Identity key is `device` (the device ID). */
export type TResourceDeviceEdit = {
  device: string;
  name?: string;
  active?: boolean;
} & { [tag: `tags.${string}`]: string | boolean | undefined } & {
  [param: `param.${string}`]: string | boolean | undefined;
};

/** Edit payload for a user row. Identity key is `user` (the user ID). */
export type TResourceUserEdit = {
  user: string;
  name?: string;
  phone?: string;
  company?: string;
  password?: string;
  language?: string;
  timezone?: string;
} & { [tag: `tags.${string}`]: string | undefined };

/**
 * Edit payload for an entity data row: the row's own `id` plus the entity block ID
 * (`resource.id` on the TResourceGroup). Remaining keys are the edited fields.
 */
export type TResourceEntityEdit = {
  id: string;
  entity: string;
} & { [field: string]: TJSONValue | undefined };

/** Edit payload for an entity_list row. Rows are entities themselves, so the identity key is `entity`. */
export type TResourceEntityListEdit = {
  entity: string;
} & { [field: string]: TJSONValue | undefined };

/** Input for editResourceData. The platform only accepts columns listed in the resource's `editable`. */
export type TResourceEditInput =
  | TResourceDeviceEdit
  | TResourceUserEdit
  | TResourceEntityEdit
  | TResourceEntityListEdit;

export type TEventData = {
  realtime?: TRealtimeData[];
  widget?: TWidget;
  status?: boolean;
  key?: string;
  message?: string;
  userInformation?: TUserInformation;
  blueprintDevices?: TBlueprintDevicesSyncData;
  result?: TDataRecord[] | TResultData[];
};

export type TMessage = {
  loaded?: boolean;
  variables?: TDataRecord[] | TDataRecordInput[] | TResourceEditInput[] | string[];
  key?: string;
  options?: TReadyOptions;
  url?: string;
  method?: TMethod;
  scope?: unknown;
};

export type WidgetState = {
  widget: TWidget | null;
  realtimeData: TRealtimeData[];
  userInformation: TUserInformation | null;
  blueprintDevices: TBlueprintDevicesSyncData | null;
  errors: TError[];
  isReady: boolean;
  realtimeEventCount: number;
  lastRealtimeAt: number | null;
};

export type RealtimeStrategy = "replace" | "append" | "merge";

export type StoreOptions = {
  allowedOrigins?: string[];
  realtimeStrategy?: RealtimeStrategy;
  realtimeMaxRecords?: number;
  readyOptions?: TReadyOptions;
};

export type InboundMessage = TEventData;

export type OutboundMessage = TMessage;
