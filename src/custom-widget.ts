import * as shortid from "shortid";
import {
  ITagoIO,
  ICallbackStart,
  IError,
  IData,
  IVariable,
  ICallbackRealtime,
  ICallbackError,
  ITagoVariables,
  IEvent,
  IMessage,
} from "./interfaces";
import { enableAutofill } from "./utils";

declare global {
  interface Window {
    /**
     * Send and receive data from the widget and variables from TagoIO
     */
    TagoIO: ITagoIO;
  }
}

window.TagoIO = {} as ITagoIO;

/**
 * When window.TagoIO.autoFill = true, you don't have to pass a `bucket` and `origin` key inside of your
 * objects in `sendData`. TagoIO will auto fill those fields automatically for you.
 *
 * If you want to set a specific bucket and device, you must set `window.TagoIO.autoFill` = false, and then pass
 * a `bucket` and `origin` key to the objects in the `sendData` function.
 */
window.TagoIO.autoFill = true;

let funcRealtime: ICallbackRealtime;
let funcStart: ICallbackStart;
let funcError: ICallbackError;
// array with widget variables to enable autoFill
let widgetVariables: Array<ITagoVariables>;
const pool: Array<(data: IData | null, error?: IError) => void> = [];

/**
 * eventListener function that receives messages sent by the parent component
 * @param event event coming from the parent component
 */
const receiveMessage = (event: IEvent): void => {
  const { data } = event;
  if (data) {
    if (data.realtime && funcRealtime) {
      funcRealtime(data.realtime[0]);
    }

    if (data.widget) {
      widgetVariables = data.widget.display.variables;

      if (funcStart) {
        funcStart(data.widget);
      }
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
const sendMessage = (message: IMessage): void => {
  window.parent.postMessage(message, "*");
};

window.TagoIO.ready = (options) => {
  sendMessage({ loaded: true, ...options });
};

window.TagoIO.onStart = (callback): void => {
  funcStart = callback;
};

window.TagoIO.onRealtime = (callback): void => {
  funcRealtime = callback;
};

window.TagoIO.onError = (callback): void => {
  funcError = callback;
};

window.TagoIO.sendData = (variables, callback): Promise<IData> | void => {
  // generates a unique key to run the callback or promisse
  const uniqueKey: string = shortid.generate();
  pool[uniqueKey] = callback || null;
  let vars = Array.isArray(variables) ? variables : [variables];

  let autoFillArray: Array<IVariable> = [];
  if (window.TagoIO.autoFill) {
    console.info(
      "AutoFill is enabled, the bucket and origin id will be automatically generated based on the variables of the widget, this option can be disabled by setting window.TagoIO.autoFill = false."
    );
    autoFillArray = enableAutofill(vars, widgetVariables);
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
    return new Promise((resolve: (data: IData) => void, reject: (data: IError) => void) => {
      pool[uniqueKey] = (success: IData, error: IError): void => {
        if (error) reject(error);
        resolve(success);
      };
    });
  }
};
