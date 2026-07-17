/**
 * TagoIO Custom Widget SDK
 *
 * Thin adapter over @tago-io/custom-widget-core that exposes the imperative
 * callback-based API on `window.TagoIO` for use in plain JavaScript widgets.
 */

import { WidgetStore, autoFillRecords } from "@tago-io/custom-widget-core";
import type {
  TBlueprintDevicesSyncData,
  TData,
  TDataRecord,
  TDataRecordInput,
  TError,
  TEventData,
  TReadyOptions,
  TRealtimeData,
  TResourceDeviceEdit,
  TResourceEditInput,
  TResourceEntityEdit,
  TResourceEntityListEdit,
  TResourceUserEdit,
  TUserInformation,
  TWidget,
  TWidgetVariable,
  WidgetState,
} from "@tago-io/custom-widget-core";

type TRealtimeCallback = (data: TRealtimeData[]) => void;
type TErrorCallback = (eventData: TEventData) => void;
type TStartCallback = (widget: TWidget) => void;
type TSendDataCallback = (data: TData | null, error?: TError) => void;
type TUserInformationCallback = (userInformation: TUserInformation) => void;
type TSyncBlueprintDevicesCallback = (blueprintDevices: TBlueprintDevicesSyncData) => void;

type TTagoIO = {
  onError: (callback: TErrorCallback) => void;
  onStart: (callback: TStartCallback) => void;
  onRealtime: (callback: TRealtimeCallback) => void;
  onSyncUserInformation: (callback: TUserInformationCallback) => void;
  onSyncBlueprintDevices: (callback: TSyncBlueprintDevicesCallback) => void;
  sendData: (dataToSend: TDataRecord | TDataRecord[], callback?: TSendDataCallback) => Promise<TData> | undefined;
  deleteData: (dataToDelete: string | string[], callback?: TSendDataCallback) => Promise<TData> | undefined;
  editData: (dataToEdit: TDataRecord | TDataRecord[], callback?: TSendDataCallback) => Promise<TData> | undefined;
  editResourceData: (
    dataToEdit: TResourceEditInput | TResourceEditInput[],
    callback?: TSendDataCallback
  ) => Promise<TData> | undefined;
  autoFill: boolean;
  ready: (options: TReadyOptions) => void;
  openLink: (url: string) => void;
  closeModal: () => void;
  runAnalysis: (scope?: unknown) => void;
  refreshResources: () => void;
};

declare global {
  interface Window {
    TagoIO: TTagoIO;
  }
}

const store = new WidgetStore();

window.TagoIO = {} as TTagoIO;
window.TagoIO.autoFill = true;

let funcRealtime: TRealtimeCallback | null = null;
let funcStart: TStartCallback | null = null;
let funcError: TErrorCallback | null = null;
let funcSyncUserInfo: TUserInformationCallback | null = null;
let funcSyncBlueprintDevices: TSyncBlueprintDevicesCallback | null = null;

let prevState: WidgetState = store.getSnapshot();

store.subscribe(() => {
  const state = store.getSnapshot();

  if (state.userInformation && state.userInformation !== prevState.userInformation && funcSyncUserInfo) {
    funcSyncUserInfo(state.userInformation);
  }

  if (state.blueprintDevices && state.blueprintDevices !== prevState.blueprintDevices && funcSyncBlueprintDevices) {
    funcSyncBlueprintDevices(state.blueprintDevices);
  }

  if (state.widget && state.widget !== prevState.widget && funcStart) {
    funcStart(state.widget);
  }

  if (state.realtimeData !== prevState.realtimeData && state.realtimeData.length > 0 && funcRealtime) {
    funcRealtime(state.realtimeData);
  }

  if (state.errors.length > prevState.errors.length && funcError) {
    const newError = state.errors[state.errors.length - 1];
    funcError(newError as unknown as TEventData);
  }

  prevState = state;
});

const onReady = (options: TReadyOptions) => {
  store.getBridge().send({ loaded: true, ...options });
};

const onStart = (callback: TStartCallback): void => {
  funcStart = callback;
};

const onRealtime = (callback: TRealtimeCallback): void => {
  funcRealtime = callback;
};

const onError = (callback: TErrorCallback): void => {
  funcError = callback;
};

const onSyncUserInformation = (callback: TUserInformationCallback) => {
  funcSyncUserInfo = callback;
};

const onSyncBlueprintDevices = (callback: TSyncBlueprintDevicesCallback) => {
  funcSyncBlueprintDevices = callback;
};

function getWidgetVariables(): TWidgetVariable[] {
  return store.getSnapshot().widget?.display?.variables ?? [];
}

function prepareRecords(variables: TDataRecord | TDataRecord[]): TDataRecordInput[] {
  const vars = Array.isArray(variables) ? variables : [variables];

  if (window.TagoIO.autoFill) {
    console.info(
      "AutoFill is enabled, the origin id will be automatically generated based on the variables of the widget, this option can be disabled by setting window.TagoIO.autoFill = false."
    );
    return autoFillRecords(vars, getWidgetVariables());
  }

  const invalid = vars.filter((v) => !v.origin);
  if (invalid.length > 0) {
    throw new Error(
      `AutoFill is disabled. ${invalid.length} record(s) missing required "origin" field. ` +
        "Either enable autoFill or provide this field."
    );
  }
  return vars;
}

function wrapMutation(
  method: (records: TDataRecordInput | TDataRecordInput[]) => Promise<TData>,
  records: TDataRecordInput[],
  callback?: TSendDataCallback
): Promise<TData> | undefined {
  const promise = method.call(store, records);

  if (callback) {
    promise.then(
      (data) => callback(data),
      (error) => callback(null, error as TError)
    );
    return undefined;
  }

  return promise;
}

const sendData = (variables: TDataRecord | TDataRecord[], callback?: TSendDataCallback): Promise<TData> | undefined => {
  const records = prepareRecords(variables);
  return wrapMutation(store.sendData.bind(store), records, callback);
};

const editData = (variables: TDataRecord | TDataRecord[], callback?: TSendDataCallback): Promise<TData> | undefined => {
  const records = prepareRecords(variables);
  return wrapMutation(store.editData.bind(store), records, callback);
};

const deleteData = (variables: string | string[], callback?: TSendDataCallback): Promise<TData> | undefined => {
  const vars = Array.isArray(variables) ? variables : [variables];
  const promise = store.deleteData(vars);

  if (callback) {
    promise.then(
      (data) => callback(data),
      (error) => callback(null, error as TError)
    );
    return undefined;
  }

  return promise;
};

const editResourceData = (
  variables: TResourceEditInput | TResourceEditInput[],
  callback?: TSendDataCallback
): Promise<TData> | undefined => {
  const vars = Array.isArray(variables) ? variables : [variables];
  const promise = store.editResourceData(vars);

  if (callback) {
    promise.then(
      (data) => callback(data),
      (error) => callback(null, error as TError)
    );
    return undefined;
  }

  return promise;
};

const openLink: TTagoIO["openLink"] = (url) => {
  store.openLink(url);
};

const closeModal: TTagoIO["closeModal"] = () => {
  store.closeModal();
};

const runAnalysis: TTagoIO["runAnalysis"] = (scope) => {
  store.runAnalysis(scope);
};

const refreshResources: TTagoIO["refreshResources"] = () => {
  store.refreshResources();
};

window.TagoIO.ready = onReady;
window.TagoIO.onStart = onStart;
window.TagoIO.onRealtime = onRealtime;
window.TagoIO.onError = onError;
window.TagoIO.onSyncUserInformation = onSyncUserInformation;
window.TagoIO.onSyncBlueprintDevices = onSyncBlueprintDevices;
window.TagoIO.sendData = sendData;
window.TagoIO.editData = editData;
window.TagoIO.deleteData = deleteData;
window.TagoIO.editResourceData = editResourceData;
window.TagoIO.openLink = openLink;
window.TagoIO.closeModal = closeModal;
window.TagoIO.runAnalysis = runAnalysis;
window.TagoIO.refreshResources = refreshResources;

export {
  closeModal,
  deleteData,
  editData,
  editResourceData,
  onError,
  onRealtime,
  onStart,
  onSyncBlueprintDevices,
  onSyncUserInformation,
  openLink,
  refreshResources,
  runAnalysis,
  sendData,
};

export type {
  TBlueprintDevicesSyncData,
  TData,
  TDataRecord,
  TDataRecordInput,
  TError,
  TErrorCallback,
  TEventData,
  TReadyOptions,
  TRealtimeCallback,
  TRealtimeData,
  TResourceDeviceEdit,
  TResourceEditInput,
  TResourceEntityEdit,
  TResourceEntityListEdit,
  TResourceUserEdit,
  TSendDataCallback,
  TStartCallback,
  TSyncBlueprintDevicesCallback,
  TTagoIO,
  TUserInformation,
  TUserInformationCallback,
  TWidget,
  TWidgetVariable,
};
