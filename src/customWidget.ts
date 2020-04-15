import * as shortid from "shortid";

interface ICallback {
  (data: unknown, error?: unknown): void;
}

interface IOptions {
  autoFill: boolean;
}

interface ITagoIO {
  onError?: (callback: ICallback) => void;
  onStart?: (callback: ICallback) => void;
  onRealtime?: (callback: ICallback) => void;
  onSendData?: (variables: (number)[], options: IOptions, callback: ICallback) => void;
}

declare global {
  interface Window {
    TagoIO: ITagoIO;
  }
}

((): void => {
  let funcRealtime: ICallback;
  let funcStart: ICallback;
  let funcError: ICallback;
  let widgetVariables: (number)[];
  const pool: any = [];

  function receiveMessage(event: any): void  {
    const { data } = event;
    if (data) {
      if(data.realtime && funcRealtime){
        funcRealtime(data.realtime[0])
      }

      if(data.widget) {
        widgetVariables = data.widget.display.variables;
        funcStart(data.widget);
      }

      if (data.status && data.key) {
        pool[data.key](data);
      }

      if (data.status === false && data.key) {
        funcError(data);
        pool[data.key](null, data);
      }
    }
  }

  function sendMessage(message: {}): void  {
    window.parent.postMessage(message, "*");
  }

  window.TagoIO.onStart = (callback): void  => {
    funcStart = callback;
    sendMessage({ loaded: true });
    window.addEventListener("message", receiveMessage, false);
  };

  window.TagoIO.onRealtime = (callback): void  => {
    funcRealtime = callback;
  };

  window.TagoIO.onError = (callback): void => {
    funcError = callback;
  };

  window.TagoIO.onSendData = (variables, options, callback): any  => {
    const uniqueKey: string = shortid.generate();
    pool[uniqueKey] = callback;

    const autoFillArray = [] as (number)[];
    if (options && options.autoFill && widgetVariables) {
      variables.map(function(userVar: any) {
        widgetVariables.map(function(widgetVar: any) {
          if (userVar.variable == widgetVar.variable) { // acha o nome da variavel nas do widget
            autoFillArray.push({
              bucket: widgetVar.origin.bucket || "",
              origin: widgetVar.origin.id || "",
              ...userVar
            });
          }
        })
      });
    }

    if (window.Promise && !callback) {
      return new Promise((resolve: any, reject: any) => {
        pool[uniqueKey] = (success: any, error: any): void => {
          if (error) reject(error);
          resolve(success);
        };
      });
    }

    sendMessage({
      variables: (options && options.autoFill) ? autoFillArray : variables,
      key: uniqueKey
    });
  };
})();
