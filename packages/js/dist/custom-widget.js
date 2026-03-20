"use strict";
(() => {
  // src/utils.ts
  function autoFillRecords(dataRecords, widgetVariables2) {
    const autoFilledArray = [];
    if (!dataRecords || !widgetVariables2) {
      return [];
    }
    dataRecords.forEach((dataRecord) => {
      widgetVariables2.forEach((widgetVar) => {
        if (dataRecord.variable === widgetVar.variable) {
          autoFilledArray.push({
            device: widgetVar.origin.id,
            origin: widgetVar.origin.id,
            ...widgetVar.origin.bucket && { bucket: widgetVar.origin.bucket },
            ...dataRecord
          });
        }
      });
    });
    return autoFilledArray;
  }

  // src/custom-widget.ts
  function generateId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  window.TagoIO = {};
  window.TagoIO.autoFill = true;
  var funcRealtime;
  var funcStart;
  var funcError;
  var funcSyncUserInfo;
  var funcSyncBlueprintDevices;
  var widgetVariables;
  var pool = {};
  var receiveMessage = (event) => {
    const { data } = event;
    if (data) {
      if (data.userInformation && funcSyncUserInfo) {
        funcSyncUserInfo(data.userInformation);
      }
      if (data.blueprintDevices && funcSyncBlueprintDevices) {
        funcSyncBlueprintDevices(data.blueprintDevices);
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
        pool[data.key]?.(data);
      }
      if (data.status === false) {
        if (funcError) {
          funcError(data);
        }
        if (data.key && pool[data.key]) {
          pool[data.key]?.(null, data);
        }
      }
    }
  };
  window.addEventListener("message", receiveMessage, false);
  var sendMessage = (message) => {
    window.parent.postMessage(message, "*");
  };
  var onReady = (options) => {
    sendMessage({ loaded: true, ...options });
  };
  var onStart = (callback) => {
    funcStart = callback;
  };
  var onRealtime = (callback) => {
    funcRealtime = callback;
  };
  var onError = (callback) => {
    funcError = callback;
  };
  var onSyncUserInformation = (callback) => {
    funcSyncUserInfo = callback;
  };
  var onSyncBlueprintDevices = (callback) => {
    funcSyncBlueprintDevices = callback;
  };
  var sendData = (variables, callback) => {
    const uniqueKey = generateId();
    pool[uniqueKey] = callback || null;
    const vars = Array.isArray(variables) ? variables : [variables];
    let autoFillArray = [];
    if (window.TagoIO.autoFill) {
      console.info(
        "AutoFill is enabled, the bucket and origin id will be automatically generated based on the variables of the widget, this option can be disabled by setting window.TagoIO.autoFill = false."
      );
      autoFillArray = autoFillRecords(vars, widgetVariables);
    } else {
      vars.forEach((vari) => {
        if (!vari.bucket || !vari.origin) {
          console.error("AutoFill is disabled, the data must contain a bucket and origin key!");
        }
      });
    }
    sendMessage({
      variables: window.TagoIO.autoFill ? autoFillArray : vars,
      key: uniqueKey
    });
    if (window.Promise && !callback) {
      return new Promise((resolve, reject) => {
        pool[uniqueKey] = (success, error) => {
          if (error) reject(error);
          resolve(success);
        };
      });
    }
  };
  var editData = (variables, callback) => {
    const uniqueKey = generateId();
    pool[uniqueKey] = callback || null;
    const vars = Array.isArray(variables) ? variables : [variables];
    let autoFillArray = [];
    if (window.TagoIO.autoFill) {
      console.info(
        "AutoFill is enabled, the bucket and origin id will be automatically generated based on the variables of the widget, this option can be disabled by setting window.TagoIO.autoFill = false."
      );
      autoFillArray = autoFillRecords(vars, widgetVariables);
    } else {
      vars.forEach((vari) => {
        if (!vari.bucket || !vari.origin) {
          console.error("AutoFill is disabled, the data must contain a bucket and origin key!");
        }
      });
    }
    sendMessage({
      variables: window.TagoIO.autoFill ? autoFillArray : vars,
      method: "edit",
      key: uniqueKey
    });
    if (window.Promise && !callback) {
      return new Promise((resolve, reject) => {
        pool[uniqueKey] = (success, error) => {
          if (error) reject(error);
          resolve(success);
        };
      });
    }
  };
  var deleteData = (variables, callback) => {
    const uniqueKey = generateId();
    pool[uniqueKey] = callback || null;
    const vars = Array.isArray(variables) ? variables : [variables];
    sendMessage({
      variables: vars,
      method: "delete",
      key: uniqueKey
    });
    if (window.Promise && !callback) {
      return new Promise((resolve, reject) => {
        pool[uniqueKey] = (success, error) => {
          if (error) reject(error);
          resolve(success);
        };
      });
    }
  };
  var editResourceData = (variables, callback) => {
    const uniqueKey = generateId();
    pool[uniqueKey] = callback || null;
    const variablesToEdit = Array.isArray(variables) ? variables : [variables];
    sendMessage({
      variables: variablesToEdit,
      method: "edit-resource",
      key: uniqueKey
    });
    if (window.Promise && !callback) {
      return new Promise((resolve, reject) => {
        pool[uniqueKey] = (success, error) => {
          if (error) reject(error);
          resolve(success);
        };
      });
    }
  };
  var openLink = (url) => {
    sendMessage({ method: "open-link", url });
  };
  var closeModal = () => {
    sendMessage({ method: "close-modal" });
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
})();
