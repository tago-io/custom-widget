export type TMethod = "delete" | "edit" | "edit-resource" | "send" | "open-link" | "close-modal";

export type TUserInformation = {
  token: string | null;
  language: string | null;
  runURL: string | null;
};

export type TDashboardBlueprintDevice = {
  name: string;
  id: string;
  placeholder?: string;
  label?: string;
  use_item_label_tag?: boolean;
  tag_to_replace?: string;
  conditions: Array<{ key: string; value: string }>;
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
  metadata?: Record<string, any>;
  /** @deprecated Only relevant for Legacy devices. */
  origin?: string;
  /** @deprecated Only relevant for Legacy devices. */
  bucket?: string;
  time: string;
};

/**
 * Input type for mutation hooks. Unlike TDataRecord, `id` and `time` are optional
 * since they are typically server-generated when sending new data.
 */
export type TDataRecordInput = Omit<TDataRecord, "id" | "time"> & {
  id?: string;
  time?: string;
};

export type TRealtimeData = {
  data?: {
    variable: string[];
    origin?: string;
    bucket?: string;
  };
  result?: TDataRecord[];
};

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
  variables?: TDataRecord[] | TDataRecordInput[];
  key?: string;
  options?: TReadyOptions;
  url?: string;
  method?: TMethod;
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
