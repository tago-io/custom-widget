/**
 * TagoIO Custom Widget SDK
 *
 * This is the main entry point for the TagoIO Custom Widget SDK. It provides a JavaScript
 * interface for creating interactive widgets that can be embedded in TagoIO dashboards.
 *
 * The SDK handles communication between your widget and the TagoIO platform through
 * a postMessage-based messaging system.
 */

import * as shortid from "shortid";
import { autoFillRecords } from "./utils";

/**
 * Global type declaration for the TagoIO SDK interface
 * This makes the TagoIO object available on the window object
 */
declare global {
  interface Window {
    /**
     * Send and receive data from the widget and variables from TagoIO
     */
    TagoIO: TTagoIO;
  }
}

// Initialize the global TagoIO object
window.TagoIO = {} as TTagoIO;

/**
 * AutoFill Configuration
 *
 * When window.TagoIO.autoFill = true, you don't have to pass a `bucket` and `origin` key inside of your
 * objects in `sendData`. TagoIO will auto fill those fields automatically for you.
 *
 * If you want to set a specific bucket and device, you must set `window.TagoIO.autoFill` = false, and then pass
 * a `bucket` and `origin` key to the objects in the `sendData` function.
 */
window.TagoIO.autoFill = true;

// Internal callback function storage
let funcRealtime: TRealtimeCallback;
let funcStart: TStartCallback;
let funcError: TErrorCallback;
let funcSyncUserInfo: TUserInformationCallback;
let funcSyncBlueprintDevices: TSyncBlueprintDevicesCallback;

// Widget variables storage - populated when the widget starts
let widgetVariables: TWidgetVariable[];

/**
 * Promise/callback pool for tracking async operations
 * Each operation gets a unique key to match requests with responses
 */
const pool: Array<(data: TData | null, error?: TError) => void> = [];

/**
 * Event listener function that receives messages sent by the parent component
 *
 * This is the core communication handler that processes all messages from the TagoIO platform,
 * including widget initialization, real-time data updates, user information, and operation responses.
 *
 * @param event - Event coming from the parent component containing data and metadata
 */
const receiveMessage = (event: TEvent): void => {
  const { data } = event;
  if (data) {
    // Handle user information synchronization
    if (data.userInformation && funcSyncUserInfo) {
      funcSyncUserInfo(data.userInformation);
    }

    // Handle blueprint devices synchronization
    if (data.blueprintDevices && funcSyncBlueprintDevices) {
      funcSyncBlueprintDevices(data.blueprintDevices);
    }

    // Handle widget initialization and configuration
    if (data.widget) {
      widgetVariables = data.widget.display.variables;

      if (funcStart) {
        funcStart(data.widget);
      }
    }

    // Handle real-time data updates
    if (data.realtime && funcRealtime) {
      funcRealtime(data.realtime);
    }

    // Handle successful operation responses
    if (data.status && data.key && pool[data.key] && typeof pool[data.key] === "function") {
      pool[data.key](data);
    }

    // Handle error responses
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

// Register the message event listener for parent-child communication
window.addEventListener("message", receiveMessage, false);

/**
 * Send message to parent component
 *
 * This function handles all outbound communication from the widget to the TagoIO platform,
 * using the postMessage API to send data across iframe boundaries.
 *
 * @param message - Message object to send to the parent component
 */
const sendMessage = (message: TMessage): void => {
  window.parent.postMessage(message, "*");
};

/**
 * Signal that the widget is ready and optionally configure display options
 *
 * This function should be called when your widget has finished loading and is ready to receive data.
 * It can also be used to configure widget appearance such as header colors.
 *
 * @param options - Configuration options for the widget display
 */
const onReady = (options: TReadyOptions) => {
  sendMessage({ loaded: true, ...options });
};

/**
 * Register a callback function to handle widget startup
 *
 * This callback is triggered when the widget is initialized and receives its configuration
 * from the TagoIO platform. Use this to set up your widget's initial state.
 *
 * @param callback - Function to call when the widget starts, receives widget configuration
 */
const onStart = (callback: TStartCallback): void => {
  funcStart = callback;
};

/**
 * Register a callback function to handle real-time data updates
 *
 * This callback is triggered whenever new data arrives for the variables configured
 * in your widget. Use this to update your widget's display with live data.
 *
 * @param callback - Function to call when real-time data is received
 */
const onRealtime = (callback: TRealtimeCallback): void => {
  funcRealtime = callback;
};

/**
 * Register a callback function to handle errors
 *
 * This callback is triggered when operations fail or other errors occur.
 * Use this to display error messages or handle error conditions gracefully.
 *
 * @param callback - Function to call when errors occur
 */
const onError = (callback: TErrorCallback): void => {
  funcError = callback;
};

/**
 * Register a callback function to receive user information
 *
 * This callback provides access to information about the current user viewing the widget,
 * such as user ID, name, and permissions. Useful for personalizing the widget experience.
 *
 * @param callback - Function to call when user information is available
 */
const onSyncUserInformation = (callback: TUserInformationCallback) => {
  funcSyncUserInfo = callback;
};

/**
 * Register a callback function to receive blueprint device information
 *
 * This callback provides access to blueprint device configurations that can be used
 * for device selection or configuration within your widget.
 *
 * @param callback - Function to call when blueprint devices information is available
 */
const onSyncBlueprintDevices = (callback: TSyncBlueprintDevicesCallback) => {
  funcSyncBlueprintDevices = callback;
};

/**
 * Send data to TagoIO devices
 *
 * This is the primary function for sending data from your widget back to TagoIO devices.
 * It supports both callback and Promise patterns for handling responses.
 *
 * When autoFill is enabled, the function automatically determines the target device and bucket
 * based on the widget's variable configuration. When disabled, you must specify these manually.
 *
 * @param variables - Single data record or array of data records to send
 * @param callback - Optional callback function to handle the response
 * @returns Promise when no callback is provided, void when callback is provided
 */
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

/**
 * Edit existing data in TagoIO devices
 *
 * This function allows you to modify existing data records in TagoIO devices.
 * Similar to sendData, it supports both callback and Promise patterns.
 *
 * @param variables - Single data record or array of data records to edit
 * @param callback - Optional callback function to handle the response
 * @returns Promise when no callback is provided, void when callback is provided
 */
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

/**
 * Delete data from TagoIO devices
 *
 * This function allows you to remove data records from TagoIO devices.
 * Use with caution as deleted data cannot be recovered.
 *
 * @param variables - Single data record or array of data records to delete
 * @param callback - Optional callback function to handle the response
 * @returns Promise when no callback is provided, void when callback is provided
 */
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

/**
 * Edit resource data in TagoIO
 *
 * This function allows you to modify resource-level data in TagoIO, which may include
 * configuration data, metadata, or other resource-specific information.
 *
 * @param variables - Single data record or array of data records to edit at resource level
 * @param callback - Optional callback function to handle the response
 * @returns Promise when no callback is provided, void when callback is provided
 */
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

/**
 * Open a link in the parent window
 *
 * This function allows your widget to open URLs in the parent TagoIO interface,
 * useful for navigation or opening external resources.
 *
 * @param url - URL to open in the parent window
 */
const openLink: TTagoIO["openLink"] = (url) => {
  sendMessage({ method: "open-link", url });
};

/**
 * Close the widget modal
 *
 * If your widget is displayed in a modal dialog, this function allows you to
 * programmatically close that modal from within the widget.
 */
const closeModal: TTagoIO["closeModal"] = () => {
  sendMessage({ method: "close-modal" });
};

// Bind functions to the `window.TagoIO` object for access in the Custom Widget code.
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

/**
 * Export functions for potential direct import usage
 * These exports allow the functions to be imported directly in environments
 * where the global window.TagoIO object might not be preferred.
 */
export {
  receiveMessage,
  sendMessage,
  onStart,
  onRealtime,
  onError,
  sendData,
  editData,
  deleteData,
  editResourceData,
  closeModal,
};
