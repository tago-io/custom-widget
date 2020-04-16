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
} from "./interfaces";
import { enableAutofill } from "./utils";

declare global {
  interface Window {
    TagoIO: ITagoIO;
  }
}

((): void => {
  let funcRealtime: ICallbackRealtime;
  let funcStart: ICallbackStart;
  let funcError: ICallbackError;
  let widgetVariables: Array<ITagoVariables>;
  const pool: Array<(data: IData | null, error?: IError) => void> = [];

  const receiveMessage = (event: IEvent): void => {
    const { data } = event;
    if (data) {
      if (data.realtime && funcRealtime) {
        funcRealtime(data.realtime[0]);
      }

      if (data.widget) {
        widgetVariables = data.widget.display.variables;
        funcStart(data.widget);
      }

      if (data.status && data.key) {
        pool[data.key](data);
      }

      if (data.status === false && data.key) {
        if (funcError) {
          funcError(data);
        }
        pool[data.key](null, data);
      }
    }
  };

  const sendMessage = (message: {}): void => {
    window.parent.postMessage(message, "*");
  };

  window.TagoIO.onStart = (callback): void => {
    funcStart = callback;
    sendMessage({ loaded: true });
    window.addEventListener("message", receiveMessage, false);
  };

  window.TagoIO.onRealtime = (callback): void => {
    funcRealtime = callback;
  };

  window.TagoIO.onError = (callback): void => {
    funcError = callback;
  };

  window.TagoIO.sendData = (variables, options, callback): Promise<IData> | void => {
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

    if (window.Promise && !callback) {
      return new Promise((resolve: (data: IData) => void, reject: (data: IError) => void) => {
        pool[uniqueKey] = (success: IData, error: IError): void => {
          if (error) reject(error);
          resolve(success);
        };
      });
    }
  };
})();
