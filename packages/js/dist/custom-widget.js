"use strict";
(() => {
  // ../core/dist/index.js
  function generateId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  var RequestPool = class {
    constructor() {
      this.pending = /* @__PURE__ */ new Map();
    }
    add(key, request) {
      this.pending.set(key, request);
    }
    resolve(key, data) {
      const request = this.pending.get(key);
      if (!request) return false;
      this.pending.delete(key);
      request.resolve(data);
      return true;
    }
    reject(key, error) {
      const request = this.pending.get(key);
      if (!request) return false;
      this.pending.delete(key);
      request.reject(error);
      return true;
    }
    rejectAll(reason) {
      for (const [, request] of this.pending) {
        request.reject(reason);
      }
      this.pending.clear();
    }
    get size() {
      return this.pending.size;
    }
    has(key) {
      return this.pending.has(key);
    }
  };
  var MessageBridge = class {
    constructor(options = {}) {
      this.handlers = /* @__PURE__ */ new Set();
      this.pool = new RequestPool();
      this.destroyed = false;
      this.allowedOrigins = options.allowedOrigins ? new Set(options.allowedOrigins) : null;
      this.boundReceive = this.handleMessage.bind(this);
      if (typeof window !== "undefined") {
        window.addEventListener("message", this.boundReceive, false);
      }
    }
    handleMessage(event) {
      if (this.destroyed) return;
      if (this.allowedOrigins && !this.allowedOrigins.has(event.origin)) {
        return;
      }
      const data = event.data;
      if (!data) return;
      if (data.status !== void 0 && data.key) {
        if (data.status) {
          this.pool.resolve(data.key, data);
        } else {
          this.pool.reject(data.key, data);
        }
      }
      for (const handler of this.handlers) {
        handler(data);
      }
    }
    send(message) {
      if (this.destroyed) return;
      if (typeof window === "undefined") return;
      window.parent.postMessage(message, "*");
    }
    sendWithResponse(message) {
      const key = generateId();
      const messageWithKey = { ...message, key };
      return new Promise((resolve, reject) => {
        this.pool.add(key, { resolve, reject });
        this.send(messageWithKey);
      });
    }
    onMessage(handler) {
      this.handlers.add(handler);
      return () => {
        this.handlers.delete(handler);
      };
    }
    destroy() {
      this.destroyed = true;
      if (typeof window !== "undefined") {
        window.removeEventListener("message", this.boundReceive, false);
      }
      this.pool.rejectAll(new Error("MessageBridge destroyed"));
      this.handlers.clear();
    }
    get pendingCount() {
      return this.pool.size;
    }
    get isDestroyed() {
      return this.destroyed;
    }
  };
  function replaceStrategy(_existing, incoming) {
    return incoming;
  }
  function appendStrategy(existing, incoming, maxRecords) {
    const combined = [...existing, ...incoming];
    if (combined.length <= maxRecords) return combined;
    return combined.slice(combined.length - maxRecords);
  }
  function recordsEqual(a, b) {
    return a.id === b.id && a.value === b.value && a.time === b.time && a.variable === b.variable;
  }
  function mergeStrategy(existing, incoming) {
    if (existing.length === 0) return incoming;
    if (incoming.length === 0) return existing;
    const existingMap = /* @__PURE__ */ new Map();
    for (const block of existing) {
      const key = realtimeBlockKey(block);
      existingMap.set(key, block);
    }
    let changed = false;
    const result = [];
    const processedKeys = /* @__PURE__ */ new Set();
    for (const incomingBlock of incoming) {
      const key = realtimeBlockKey(incomingBlock);
      processedKeys.add(key);
      const existingBlock = existingMap.get(key);
      if (!existingBlock) {
        result.push(incomingBlock);
        changed = true;
        continue;
      }
      const mergedRecords = mergeRecords(existingBlock.result ?? [], incomingBlock.result ?? []);
      const dataChanged = mergedRecords !== existingBlock.result;
      if (dataChanged) {
        result.push({ ...incomingBlock, result: mergedRecords });
        changed = true;
      } else {
        result.push(existingBlock);
      }
    }
    for (const [key, block] of existingMap) {
      if (!processedKeys.has(key)) {
        result.push(block);
      }
    }
    return changed || result.length !== existing.length ? result : existing;
  }
  function mergeRecords(existing, incoming) {
    if (incoming.length === 0) return existing;
    const incomingById = /* @__PURE__ */ new Map();
    for (const record of incoming) {
      incomingById.set(record.id, record);
    }
    let changed = false;
    const result = [];
    for (const existingRecord of existing) {
      const incomingMatch = incomingById.get(existingRecord.id);
      if (incomingMatch) {
        if (recordsEqual(existingRecord, incomingMatch)) {
          result.push(existingRecord);
        } else {
          result.push(incomingMatch);
          changed = true;
        }
        incomingById.delete(existingRecord.id);
      } else {
        changed = true;
      }
    }
    for (const [, record] of incomingById) {
      result.push(record);
      changed = true;
    }
    if (changed) {
      result.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    }
    return changed ? result : existing;
  }
  function realtimeBlockKey(block) {
    const vars = block.data?.variable?.join(",") ?? "";
    const origin = block.data?.origin ?? "";
    return `${vars}|${origin}`;
  }
  var INITIAL_STATE = {
    widget: null,
    realtimeData: [],
    userInformation: null,
    blueprintDevices: null,
    errors: [],
    isReady: false,
    realtimeEventCount: 0,
    lastRealtimeAt: null
  };
  var SERVER_SNAPSHOT = { ...INITIAL_STATE };
  var WidgetStore = class {
    constructor(options = {}) {
      this.state = { ...INITIAL_STATE };
      this.listeners = /* @__PURE__ */ new Set();
      this.initialized = false;
      this.unsubBridge = null;
      this.handleInbound = (data) => {
        if (data.userInformation) {
          this.updateState({ userInformation: data.userInformation });
        }
        if (data.blueprintDevices) {
          this.updateState({ blueprintDevices: data.blueprintDevices });
        }
        if (data.widget) {
          this.updateState({
            widget: data.widget,
            isReady: true
          });
        }
        if (data.realtime) {
          this.updateRealtime(data.realtime);
        }
        if (data.status === false) {
          const error = data;
          this.updateState({
            errors: [...this.state.errors, error]
          });
        }
      };
      this.subscribe = (callback) => {
        this.listeners.add(callback);
        return () => {
          this.listeners.delete(callback);
        };
      };
      this.getSnapshot = () => {
        return this.state;
      };
      this.getServerSnapshot = () => {
        return SERVER_SNAPSHOT;
      };
      this.strategy = options.realtimeStrategy ?? "merge";
      this.maxRecords = options.realtimeMaxRecords ?? 1e3;
      this.readyOptions = options.readyOptions ?? {};
      this.bridgeOptions = { allowedOrigins: options.allowedOrigins };
      this.bridge = new MessageBridge(this.bridgeOptions);
      if (typeof window !== "undefined") {
        this.unsubBridge = this.bridge.onMessage(this.handleInbound);
      }
    }
    updateRealtime(incoming) {
      let newData;
      switch (this.strategy) {
        case "replace":
          newData = replaceStrategy(this.state.realtimeData, incoming);
          break;
        case "append":
          newData = appendStrategy(this.state.realtimeData, incoming, this.maxRecords);
          break;
        default:
          newData = mergeStrategy(this.state.realtimeData, incoming);
          break;
      }
      this.state = {
        ...this.state,
        realtimeData: newData,
        realtimeEventCount: this.state.realtimeEventCount + 1,
        lastRealtimeAt: Date.now()
      };
      this.emit();
    }
    updateState(partial) {
      this.state = { ...this.state, ...partial };
      this.emit();
    }
    emit() {
      for (const listener of this.listeners) {
        listener();
      }
    }
    initialize() {
      if (this.initialized) return;
      this.initialized = true;
      if (this.bridge.isDestroyed) {
        this.bridge = new MessageBridge(this.bridgeOptions);
        if (typeof window !== "undefined") {
          this.unsubBridge = this.bridge.onMessage(this.handleInbound);
        }
      }
      this.bridge.send({ loaded: true, ...this.readyOptions });
    }
    destroy() {
      this.unsubBridge?.();
      this.bridge.destroy();
      this.listeners.clear();
      this.initialized = false;
    }
    sendData(records) {
      const vars = Array.isArray(records) ? records : [records];
      return this.bridge.sendWithResponse({ variables: vars });
    }
    editData(records) {
      const vars = Array.isArray(records) ? records : [records];
      return this.bridge.sendWithResponse({ variables: vars, method: "edit" });
    }
    deleteData(records) {
      const vars = Array.isArray(records) ? records : [records];
      return this.bridge.sendWithResponse({ variables: vars, method: "delete" });
    }
    editResourceData(records) {
      const vars = Array.isArray(records) ? records : [records];
      return this.bridge.sendWithResponse({ variables: vars, method: "edit-resource" });
    }
    openLink(url) {
      this.bridge.send({ method: "open-link", url });
    }
    closeModal() {
      this.bridge.send({ method: "close-modal" });
    }
    runAnalysis(scope) {
      this.bridge.send({ method: "run-analysis", scope });
    }
    clearErrors() {
      this.updateState({ errors: [] });
    }
    clearRealtimeData() {
      this.updateState({
        realtimeData: [],
        realtimeEventCount: 0,
        lastRealtimeAt: null
      });
    }
    getBridge() {
      return this.bridge;
    }
  };
  function autoFillRecords(dataRecords, widgetVariables) {
    if (!dataRecords || !widgetVariables) return [];
    const result = [];
    for (const record of dataRecords) {
      for (const widgetVar of widgetVariables) {
        if (record.variable === widgetVar.variable) {
          result.push({
            device: widgetVar.origin.id,
            origin: widgetVar.origin.id,
            ...widgetVar.origin.bucket && { bucket: widgetVar.origin.bucket },
            ...record
          });
        }
      }
    }
    return result;
  }

  // src/custom-widget.ts
  var store = new WidgetStore();
  window.TagoIO = {};
  window.TagoIO.autoFill = true;
  var funcRealtime = null;
  var funcStart = null;
  var funcError = null;
  var funcSyncUserInfo = null;
  var funcSyncBlueprintDevices = null;
  var prevState = store.getSnapshot();
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
      funcError(newError);
    }
    prevState = state;
  });
  var onReady = (options) => {
    store.getBridge().send({ loaded: true, ...options });
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
  function getWidgetVariables() {
    return store.getSnapshot().widget?.display?.variables ?? [];
  }
  function prepareRecords(variables) {
    const vars = Array.isArray(variables) ? variables : [variables];
    if (window.TagoIO.autoFill) {
      console.info(
        "AutoFill is enabled, the bucket and origin id will be automatically generated based on the variables of the widget, this option can be disabled by setting window.TagoIO.autoFill = false."
      );
      return autoFillRecords(vars, getWidgetVariables());
    }
    for (const v of vars) {
      if (!v.bucket || !v.origin) {
        console.error("AutoFill is disabled, the data must contain a bucket and origin key!");
      }
    }
    return vars;
  }
  function wrapMutation(method, records, callback) {
    const promise = method.call(store, records);
    if (callback) {
      promise.then(
        (data) => callback(data),
        (error) => callback(null, error)
      );
      return void 0;
    }
    return promise;
  }
  var sendData = (variables, callback) => {
    const records = prepareRecords(variables);
    return wrapMutation(store.sendData.bind(store), records, callback);
  };
  var editData = (variables, callback) => {
    const records = prepareRecords(variables);
    return wrapMutation(store.editData.bind(store), records, callback);
  };
  var deleteData = (variables, callback) => {
    const vars = Array.isArray(variables) ? variables : [variables];
    const promise = store.deleteData(vars);
    if (callback) {
      promise.then(
        (data) => callback(data),
        (error) => callback(null, error)
      );
      return void 0;
    }
    return promise;
  };
  var editResourceData = (variables, callback) => {
    const vars = Array.isArray(variables) ? variables : [variables];
    const promise = store.editResourceData(vars);
    if (callback) {
      promise.then(
        (data) => callback(data),
        (error) => callback(null, error)
      );
      return void 0;
    }
    return promise;
  };
  var openLink = (url) => {
    store.openLink(url);
  };
  var closeModal = () => {
    store.closeModal();
  };
  var runAnalysis = (scope) => {
    store.runAnalysis(scope);
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
})();
