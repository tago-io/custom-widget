import * as shortid from "shortid";
import { autoFillRecords } from "./utils";

declare global {
  interface Window {
    /**
     * Send and receive data from the widget and variables from TagoIO
     */
    TagoIO: TTagoIO;
  }
}

window.TagoIO = {} as TTagoIO;

/**
 * When window.TagoIO.autoFill = true, you don't have to pass a `bucket` and `origin` key inside of your
 * objects in `sendData`. TagoIO will auto fill those fields automatically for you.
 *
 * If you want to set a specific bucket and device, you must set `window.TagoIO.autoFill` = false, and then pass
 * a `bucket` and `origin` key to the objects in the `sendData` function.
 */
window.TagoIO.autoFill = true;

let funcRealtime: TRealtimeCallback;
let funcStart: TStartCallback;
let funcError: TErrorCallback;
let funcSyncUserInfo: TUserInformationCallback;
let widgetVariables: TWidgetVariable[];

const pool: Array<(data: TData | null, error?: TError) => void> = [];

/**
 * eventListener function that receives messages sent by the parent component
 * @param event event coming from the parent component
 */
const receiveMessage = (event: TEvent): void => {
  const { data } = event;
  if (data) {
    if (data.userInformation && funcSyncUserInfo) {
      funcSyncUserInfo(data.userInformation);
    }

    if (data.widget) {
      widgetVariables = data.widget.display.variables;

      if (funcStart) {
        funcStart(data.widget);
      }
    }

    if (data.realtime && funcRealtime) {
      funcRealtime(data.realtime);
    }

    if (data.status && data.key && pool[data.key] && typeof pool[data.key] === "function") {
      pool[data.key](data);
    }

    if (data.status === false) {
      if (funcError) {
        funcError(data);
      }
      if (data.key && pool[data.key]) {
        pool[data.key](null, data);
      }
    }
  }
};
window.addEventListener("message", receiveMessage, false);

/**
 * Send message to parent component
 * @param message message to send
 */
const sendMessage = (message: TMessage): void => {
  window.parent.postMessage(message, "*");
};

const onReady = (options: TReadyOptions) => {
  sendMessage({ loaded: true, ...options });
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

const sendData = (variables: TDataRecord | TDataRecord[], callback?: TSendDataCallback): Promise<TData> | void => {
  // generates a unique key to run the callback or promisse
  const uniqueKey: string = shortid.generate();
  pool[uniqueKey] = callback || null;
  const vars = Array.isArray(variables) ? variables : [variables];

  let autoFillArray: TDataRecord[] = [];
  if (window.TagoIO.autoFill) {
    console.info(
      "AutoFill is enabled, the bucket and origin id will be automatically generated based on the variables of the widget, this option can be disabled by setting window.TagoIO.autoFill = false."
    );

    // converts the variables to autofill
    autoFillArray = autoFillRecords(vars, widgetVariables);
  } else {
    vars.map((vari) => {
      if (!vari.bucket || !vari.origin) {
        console.error("AutoFill is disabled, the data must contain a bucket and origin key!");
      }
    });
  }

  sendMessage({
    variables: window.TagoIO.autoFill ? autoFillArray : vars,
    key: uniqueKey,
  });

  // If a callback is not passed it returns the promise
  if (window.Promise && !callback) {
    return new Promise((resolve: (data: TData) => void, reject: (data: TError) => void) => {
      pool[uniqueKey] = (success: TData, error: TError): void => {
        if (error) reject(error);
        resolve(success);
      };
    });
  }
};

const editData = (variables: TDataRecord | TDataRecord[], callback?: TSendDataCallback): Promise<TData> | void => {
  // generates a unique key to run the callback or promisse
  const uniqueKey: string = shortid.generate();
  pool[uniqueKey] = callback || null;
  const vars = Array.isArray(variables) ? variables : [variables];

  let autoFillArray: TDataRecord[] = [];
  if (window.TagoIO.autoFill) {
    console.info(
      "AutoFill is enabled, the bucket and origin id will be automatically generated based on the variables of the widget, this option can be disabled by setting window.TagoIO.autoFill = false."
    );

    // converts the variables to autofill
    autoFillArray = autoFillRecords(vars, widgetVariables);
  } else {
    vars.map((vari) => {
      if (!vari.bucket || !vari.origin) {
        console.error("AutoFill is disabled, the data must contain a bucket and origin key!");
      }
    });
  }

  sendMessage({
    variables: window.TagoIO.autoFill ? autoFillArray : vars,
    method: "edit",
    key: uniqueKey,
  });

  // If a callback is not passed it returns the promise
  if (window.Promise && !callback) {
    return new Promise((resolve: (data: TData) => void, reject: (data: TError) => void) => {
      pool[uniqueKey] = (success: TData, error: TError): void => {
        if (error) reject(error);
        resolve(success);
      };
    });
  }
};

const deleteData = (variables: TDataRecord | TDataRecord[], callback?: TSendDataCallback): Promise<TData> | void => {
  // generates a unique key to run the callback or promisse
  const uniqueKey: string = shortid.generate();
  pool[uniqueKey] = callback || null;
  const vars = Array.isArray(variables) ? variables : [variables];

  sendMessage({
    variables: vars,
    method: "delete",
    key: uniqueKey,
  });

  // If a callback is not passed it returns the promise
  if (window.Promise && !callback) {
    return new Promise((resolve: (data: TData) => void, reject: (data: TError) => void) => {
      pool[uniqueKey] = (success: TData, error: TError): void => {
        if (error) reject(error);
        resolve(success);
      };
    });
  }
};

const editResourceData = (
  variables: TDataRecord | TDataRecord[],
  callback?: TSendDataCallback
): Promise<TData> | void => {
  const uniqueKey: string = shortid.generate();
  pool[uniqueKey] = callback || null;
  const variablesToEdit = Array.isArray(variables) ? variables : [variables];

  sendMessage({
    variables: variablesToEdit,
    method: "edit-resource",
    key: uniqueKey,
  });

  if (window.Promise && !callback) {
    return new Promise((resolve: (data: TData) => void, reject: (data: TError) => void) => {
      pool[uniqueKey] = (success: TData, error: TError): void => {
        if (error) reject(error);
        resolve(success);
      };
    });
  }
};

const openLink: TTagoIO["openLink"] = (url) => {
  sendMessage({ method: "open-link", url });
};

// Bind functions to the `window.TagoIO` object for access in the Custom Widget code.
window.TagoIO.ready = onReady;
window.TagoIO.onStart = onStart;
window.TagoIO.onRealtime = onRealtime;
window.TagoIO.onError = onError;
window.TagoIO.onSyncUserInformation = onSyncUserInformation;
window.TagoIO.sendData = sendData;
window.TagoIO.editData = editData;
window.TagoIO.deleteData = deleteData;
window.TagoIO.editResourceData = editResourceData;
window.TagoIO.openLink = openLink;

export { receiveMessage, sendMessage, onStart, onRealtime, onError, sendData, editData, deleteData, editResourceData };
