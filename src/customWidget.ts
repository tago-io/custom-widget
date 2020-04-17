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

    if (data.status && data.key && pool[data.key]) {
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

/**
 * Send message to parent component
 * @param message message to send
 */
const sendMessage = (message: IMessage): void => {
  window.parent.postMessage(message, "*");
};

window.TagoIO.onStart = (options, callback): void => {
  if (callback) {
    funcStart = callback;
  }
  sendMessage({ loaded: true, ...options });
  window.addEventListener("message", receiveMessage, false);
};

window.TagoIO.onRealtime = (callback): void => {
  funcRealtime = callback;
};

window.TagoIO.onError = (callback): void => {
  funcError = callback;
};

window.TagoIO.sendData = (variables, options, callback): Promise<IData> | void => {
  // generates a unique key to run the callback or promisse
  const uniqueKey: string = shortid.generate();
  pool[uniqueKey] = callback || null;

  let autoFillArray: Array<IVariable> = [];
  if (options && options.autoFill && widgetVariables) {
    autoFillArray = enableAutofill(variables, widgetVariables);
  }

  sendMessage({
    variables: options && options.autoFill ? autoFillArray : variables,
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
