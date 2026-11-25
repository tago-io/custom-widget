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
  var BRIDGE_DESTROYED = "MessageBridge destroyed";
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
        try {
          handler(data);
        } catch (err) {
          console.error("[TagoIO Widget] Message handler threw an error:", err);
        }
      }
    }
    send(message) {
      if (this.destroyed) return;
      if (typeof window === "undefined") return;
      window.parent.postMessage(message, "*");
    }
    /**
     * Post a request and settle with the reply that carries its key. Pass `key` to know it before the reply
     * arrives; it defaults to a new ID. An empty key, or one still waiting for its reply, rejects without posting.
     */
    sendWithResponse(message, key = generateId()) {
      if (this.destroyed) {
        return Promise.reject(new Error(BRIDGE_DESTROYED));
      }
      if (!key) {
        return Promise.reject(new Error("A request needs a non-empty key."));
      }
      if (this.pool.has(key)) {
        return Promise.reject(new Error(`A request with key "${key}" is still waiting for its reply.`));
      }
      const messageWithKey = { ...message, key };
      return new Promise((resolve, reject) => {
        this.pool.add(key, { resolve, reject });
        try {
          this.send(messageWithKey);
        } catch (error) {
          this.pool.reject(key, error);
        }
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
      this.pool.rejectAll(new Error(BRIDGE_DESTROYED));
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
  function valuesEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
    if (Array.isArray(a) || Array.isArray(b)) {
      if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
      return a.every((item, index) => valuesEqual(item, b[index]));
    }
    const objectA = a;
    const objectB = b;
    for (const key of Object.keys(objectA)) {
      if (!valuesEqual(objectA[key], objectB[key])) return false;
    }
    for (const key of Object.keys(objectB)) {
      if (!Object.hasOwn(objectA, key) && objectB[key] !== void 0) return false;
    }
    return true;
  }
  function recordsEqual(a, b) {
    return a.id === b.id && a.value === b.value && a.time === b.time && a.variable === b.variable && a.group === b.group && a.device === b.device && a.unit === b.unit && a.created_at === b.created_at && a.origin === b.origin && a.bucket === b.bucket && valuesEqual(a.metadata, b.metadata) && valuesEqual(a.location, b.location);
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
      if (incomingBlock.resource) {
        result.push(incomingBlock);
        if (incomingBlock !== existingBlock) changed = true;
        continue;
      }
      if (!existingBlock) {
        result.push(incomingBlock);
        changed = true;
        continue;
      }
      const mergedRecords = mergeRecords(
        existingBlock.result ?? [],
        incomingBlock.result ?? []
      );
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
    if (block.resource) {
      const { type, id, index } = block.resource;
      return `resource:${type}:${id ?? ""}:${index ?? ""}`;
    }
    const vars = block.data?.variable?.join(",") ?? "";
    const origin = block.data?.origin ?? "";
    return `data:${vars}|${origin}`;
  }
  var INITIAL_STATE = {
    widget: null,
    realtimeData: [],
    userInformation: null,
    blueprintDevices: null,
    errors: [],
    isReady: false,
    capabilities: null,
    realtimeEventCount: 0,
    lastRealtimeAt: null
  };
  var SERVER_SNAPSHOT = { ...INITIAL_STATE };
  var ENDPOINT_ID_PATTERN = /^[a-z0-9]{24}$/i;
  function isObject(value) {
    return typeof value === "object" && value !== null;
  }
  function endpointCallError(code, message) {
    return { code, message };
  }
  function errorMessage(error) {
    return isObject(error) && typeof error.message === "string" ? error.message : String(error);
  }
  function toEndpointCallError(reason) {
    if (isObject(reason) && reason.status === false) {
      const code = typeof reason.code === "string" && reason.code ? reason.code : "api_error";
      const message = typeof reason.message === "string" && reason.message ? reason.message : "The dashboard could not call the Endpoint.";
      return endpointCallError(code, message);
    }
    if (reason instanceof Error && reason.message === BRIDGE_DESTROYED) {
      return endpointCallError("aborted", "The widget stopped before the dashboard answered. The Endpoint may have run.");
    }
    return endpointCallError("bad_request", `The request could not be posted to the dashboard: ${errorMessage(reason)}`);
  }
  function constructorName(value) {
    return value.constructor?.name || "object";
  }
  function describeValue(value) {
    if (typeof value === "string") return JSON.stringify(value);
    if (value === null || value === void 0) return String(value);
    return `a value of type ${typeof value === "object" ? constructorName(value) : typeof value}`;
  }
  function isPlainObject(value) {
    if (!isObject(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }
  function isBoxedPrimitive(value) {
    return value instanceof Number || value instanceof String || value instanceof Boolean;
  }
  function refuseValuesJsonEmpties(_key, value) {
    const emptied = isObject(value) && !Array.isArray(value) && !isPlainObject(value) && !isBoxedPrimitive(value) && Object.keys(value).length === 0;
    if (emptied) {
      throw new TypeError(
        `The body holds a value of type ${constructorName(value)}, which JSON writes as {}. Convert it to a plain object.`
      );
    }
    return value;
  }
  function encodeEndpointBody(body) {
    if (body === void 0 || typeof body === "string") return body;
    const json = JSON.stringify(body, refuseValuesJsonEmpties);
    if (json === void 0) throw new TypeError(`The body, ${describeValue(body)}, is not a JSON value.`);
    const encoded = JSON.parse(json);
    if (typeof encoded === "string") {
      throw new TypeError(
        "The body's JSON is a bare string, which the dashboard would send as text. Put the value in an object, or pass a string to send text."
      );
    }
    return encoded;
  }
  function isQueryValue(value) {
    return typeof value === "string" || typeof value === "boolean" || Number.isFinite(value);
  }
  function encodeEndpointQuery(query) {
    if (!isPlainObject(query)) {
      throw new TypeError(
        `The query must be a plain object of keys and values, not ${describeValue(query)}. For a URLSearchParams, pass Object.fromEntries(params).`
      );
    }
    const encoded = /* @__PURE__ */ Object.create(null);
    for (const [key, value] of Object.entries(query)) {
      if (value === void 0) continue;
      if (isQueryValue(value)) {
        encoded[key] = value;
      } else if (Array.isArray(value) && [...value].every(isQueryValue)) {
        encoded[key] = [...value];
      } else {
        throw new TypeError(
          `Query key ${JSON.stringify(key)} must be a string, a finite number or a boolean, or an array of them.`
        );
      }
    }
    return encoded;
  }
  function readEndpointResult(reply) {
    const result = isObject(reply) ? reply.result : void 0;
    if (isObject(result) && typeof result.status === "number" && isObject(result.headers)) {
      return result;
    }
    throw endpointCallError("api_error", "The dashboard sent a malformed reply.");
  }
  var WidgetStore = class {
    constructor(options = {}) {
      this.state = { ...INITIAL_STATE };
      this.listeners = /* @__PURE__ */ new Set();
      this.initialized = false;
      this.unsubBridge = null;
      this.endpointCallKeys = /* @__PURE__ */ new Set();
      this.handleInbound = (data) => {
        const partial = {};
        if (data.userInformation) {
          partial.userInformation = data.userInformation;
        }
        if (data.blueprintDevices) {
          partial.blueprintDevices = data.blueprintDevices;
        }
        if (data.widget) {
          partial.widget = data.widget;
          partial.isReady = true;
          if (Array.isArray(data.capabilities)) {
            partial.capabilities = data.capabilities;
          } else if (this.state.capabilities === null) {
            partial.capabilities = [];
          }
        }
        const isEndpointCallReply = data.key !== void 0 && this.endpointCallKeys.has(data.key) || data.method === "call-endpoint";
        if (data.status === false && !isEndpointCallReply) {
          const error = data;
          partial.errors = [...this.state.errors, error];
        }
        if (Object.keys(partial).length > 0) {
          this.state = { ...this.state, ...partial };
        }
        if (data.realtime) {
          this.updateRealtime(data.realtime);
        } else if (Object.keys(partial).length > 0) {
          this.emit();
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
    /**
     * Call an Analysis Endpoint through the dashboard, which sends the viewer's session. Every HTTP answer
     * resolves, 4xx and 5xx included, except a redirect, which the dashboard refuses; the promise rejects with a
     * TEndpointCallError only when the call did not complete.
     */
    async callEndpoint(endpointID, options) {
      if (typeof endpointID !== "string" || !ENDPOINT_ID_PATTERN.test(endpointID)) {
        throw endpointCallError(
          "bad_request",
          `Invalid Endpoint ID ${describeValue(endpointID)}: pass the 24-character ID of the Analysis.`
        );
      }
      const { capabilities } = this.state;
      if (capabilities === null) {
        throw endpointCallError(
          "not_ready",
          "The widget settings have not arrived yet. Call callEndpoint after the widget starts."
        );
      }
      if (!capabilities.includes("call-endpoint")) {
        throw endpointCallError("unsupported", "This dashboard does not support Endpoint calls from custom widgets.");
      }
      let payload;
      try {
        if (options !== void 0 && !isPlainObject(options)) {
          throw new TypeError(
            `The options must be an object such as { method, path, query, body }, not ${describeValue(options)}.`
          );
        }
        const { method, path, query, body } = options ?? {};
        if (body !== void 0 && (typeof method !== "string" || method.toUpperCase() === "GET")) {
          throw new TypeError('A body is not allowed with GET, the default method. Set method, for example to "POST".');
        }
        payload = {
          endpoint_id: endpointID,
          method,
          path,
          query: query === void 0 ? void 0 : encodeEndpointQuery(query),
          body: encodeEndpointBody(body)
        };
      } catch (error) {
        throw endpointCallError("bad_request", `The request cannot be sent: ${errorMessage(error)}`);
      }
      if (this.bridge.isDestroyed) {
        throw endpointCallError("aborted", "The widget stopped before the call was sent. Nothing was sent.");
      }
      const key = generateId();
      this.endpointCallKeys.add(key);
      let reply;
      try {
        reply = await this.bridge.sendWithResponse({ method: "call-endpoint", payload }, key);
      } catch (reason) {
        throw toEndpointCallError(reason);
      } finally {
        this.endpointCallKeys.delete(key);
      }
      return readEndpointResult(reply);
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
    /**
     * Ask the parent to re-fetch this widget's resource collections and push a fresh
     * `realtime` payload back. Fire-and-forget: the updated data arrives via onRealtime.
     */
    refreshResources() {
      this.bridge.send({ method: "refresh-resources" });
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
        "AutoFill is enabled, the origin id will be automatically generated based on the variables of the widget, this option can be disabled by setting window.TagoIO.autoFill = false."
      );
      return autoFillRecords(vars, getWidgetVariables());
    }
    const invalid = vars.filter((v) => !v.origin);
    if (invalid.length > 0) {
      throw new Error(
        `AutoFill is disabled. ${invalid.length} record(s) missing required "origin" field. Either enable autoFill or provide this field.`
      );
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
  var refreshResources = () => {
    store.refreshResources();
  };
  var callEndpoint = (endpointID, options) => store.callEndpoint(endpointID, options);
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
  window.TagoIO.callEndpoint = callEndpoint;
})();
