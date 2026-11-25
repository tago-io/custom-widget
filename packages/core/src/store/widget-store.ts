import { generateId } from "../bridge/generate-id.js";
import { BRIDGE_DESTROYED, MessageBridge } from "../bridge/message-bridge.js";
import type {
  InboundMessage,
  RealtimeStrategy,
  StoreOptions,
  TData,
  TDataRecordInput,
  TEndpointCallError,
  TEndpointCallErrorCode,
  TEndpointCallOptions,
  TEndpointCallResult,
  TEndpointQueryValue,
  TError,
  TReadyOptions,
  TRealtimeData,
  TResourceEditInput,
  WidgetState,
} from "../types/index.js";
import { appendStrategy, mergeStrategy, replaceStrategy } from "./realtime-strategies.js";

const INITIAL_STATE: WidgetState = {
  widget: null,
  realtimeData: [],
  userInformation: null,
  blueprintDevices: null,
  errors: [],
  isReady: false,
  capabilities: null,
  realtimeEventCount: 0,
  lastRealtimeAt: null,
};

const SERVER_SNAPSHOT: WidgetState = { ...INITIAL_STATE };

/** The dashboard runs the same check; running it here fails a malformed ID before anything is posted. */
const ENDPOINT_ID_PATTERN = /^[a-z0-9]{24}$/i;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function endpointCallError(code: TEndpointCallErrorCode, message: string): TEndpointCallError {
  return { code, message };
}

function errorMessage(error: unknown): string {
  return isObject(error) && typeof error.message === "string" ? error.message : String(error);
}

/**
 * The bridge rejects with the dashboard's failure reply, with BRIDGE_DESTROYED once the store is destroyed, or with
 * what postMessage threw before posting, such as a DataCloneError.
 */
function toEndpointCallError(reason: unknown): TEndpointCallError {
  if (isObject(reason) && reason.status === false) {
    const code = typeof reason.code === "string" && reason.code ? reason.code : "api_error";
    const message =
      typeof reason.message === "string" && reason.message
        ? reason.message
        : "The dashboard could not call the Endpoint.";
    return endpointCallError(code, message);
  }
  if (reason instanceof Error && reason.message === BRIDGE_DESTROYED) {
    return endpointCallError("aborted", "The widget stopped before the dashboard answered.");
  }
  return endpointCallError("bad_request", `The request could not be posted to the dashboard: ${errorMessage(reason)}`);
}

function constructorName(value: object): string {
  return (value as { constructor?: { name?: string } }).constructor?.name || "object";
}

/** Names a value in an error message without converting it, which throws for a prototype-free object or a Symbol. */
function describeValue(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (value === null || value === undefined) return String(value);
  return `a value of type ${typeof value === "object" ? constructorName(value) : typeof value}`;
}

/** An object literal, prototype-free ones included. Not an array, a Map, a Date or a class instance. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!isObject(value)) return false;
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

/** JSON writes a Number, String or Boolean object as its value, but a replacer still sees the object. */
function isBoxedPrimitive(value: object): boolean {
  return value instanceof Number || value instanceof String || value instanceof Boolean;
}

/**
 * JSON writes a FormData, a Map, a Blob, or a class instance that keeps its data in private fields, as {}, so the
 * Analysis would get an empty body and no error. That is any object other than a plain object, an array or a boxed
 * primitive with no enumerable fields of its own. A replacer sees each value after toJSON() ran, so a Date inside an
 * object arrives here as its string, and a class instance with fields is written as its fields.
 */
function refuseValuesJsonEmpties(_key: string, value: unknown): unknown {
  const emptied =
    isObject(value) &&
    !Array.isArray(value) &&
    !isPlainObject(value) &&
    !isBoxedPrimitive(value) &&
    Object.keys(value).length === 0;
  if (emptied) {
    throw new TypeError(
      `The body holds a value of type ${constructorName(value)}, which JSON writes as {}. Convert it to a plain object.`
    );
  }
  return value;
}

/**
 * The dashboard sends a body that is not a string as JSON, so it takes JSON's rules here: toJSON() applies, as for a
 * Date inside an object, and a value JSON cannot encode, such as a BigInt or a cycle, is refused before anything is
 * posted. So are two values that JSON would send wrong: one it writes as {} (see refuseValuesJsonEmpties), and one whose
 * JSON is a bare string, such as a top-level Date. Decoded, that is a string again, which the dashboard sends as text,
 * so the Analysis would get `scope` nil.
 */
function encodeEndpointBody(body: unknown): unknown {
  if (body === undefined || typeof body === "string") return body;
  const json = JSON.stringify(body, refuseValuesJsonEmpties);
  if (json === undefined) throw new TypeError(`A ${typeof body} is not a JSON value.`);
  const encoded = JSON.parse(json) as unknown;
  if (typeof encoded === "string") {
    throw new TypeError(
      "The body's JSON is a bare string, which the dashboard would send as text. Put the value in an object, or pass a string to send text."
    );
  }
  return encoded;
}

/** `Number.isFinite` never coerces, so it also refuses NaN, Infinity and anything that is not a number. */
function isQueryValue(value: unknown): value is TEndpointQueryValue {
  return typeof value === "string" || typeof value === "boolean" || Number.isFinite(value);
}

/**
 * The dashboard accepts only strings, finite numbers and booleans, or arrays of them, and refuses the whole call over
 * one bad value with a message that names no key. Checking here names the key and costs no round trip. A key set to
 * undefined is left out, as JSON leaves one out of a body.
 */
function encodeEndpointQuery(query: unknown): Record<string, TEndpointQueryValue | TEndpointQueryValue[]> {
  // A URLSearchParams or a Map has no entries of its own, so it would go out as an empty query.
  if (!isPlainObject(query)) {
    throw new TypeError(
      `The query must be a plain object of keys and values, not ${describeValue(query)}. For a URLSearchParams, pass Object.fromEntries(params).`
    );
  }
  // No prototype, so a __proto__ key stays a key instead of setting the prototype.
  const encoded = Object.create(null) as Record<string, TEndpointQueryValue | TEndpointQueryValue[]>;
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    if (isQueryValue(value)) {
      encoded[key] = value;
    } else if (Array.isArray(value) && value.every(isQueryValue)) {
      encoded[key] = [...value];
    } else {
      throw new TypeError(
        `Query key ${JSON.stringify(key)} must be a string, a finite number or a boolean, or an array of them.`
      );
    }
  }
  return encoded;
}

/** The reply comes from another window, so its shape is checked before the caller gets it. */
function readEndpointResult<TBody>(reply: unknown): TEndpointCallResult<TBody> {
  const result = isObject(reply) ? reply.result : undefined;
  if (isObject(result) && typeof result.status === "number" && isObject(result.headers)) {
    return result as TEndpointCallResult<TBody>;
  }
  throw endpointCallError("api_error", "The dashboard sent a malformed reply.");
}

export class WidgetStore {
  private state: WidgetState = { ...INITIAL_STATE };
  private listeners = new Set<() => void>();
  private bridge: MessageBridge;
  private initialized = false;
  private strategy: RealtimeStrategy;
  private maxRecords: number;
  private readyOptions: TReadyOptions;
  private bridgeOptions: { allowedOrigins?: string[] };
  private unsubBridge: (() => void) | null = null;
  /** Keys of the callEndpoint requests in flight, so a failure reply to one is known even without `method`. */
  private endpointCallKeys = new Set<string>();

  constructor(options: StoreOptions = {}) {
    this.strategy = options.realtimeStrategy ?? "merge";
    this.maxRecords = options.realtimeMaxRecords ?? 1000;
    this.readyOptions = options.readyOptions ?? {};
    this.bridgeOptions = { allowedOrigins: options.allowedOrigins };

    this.bridge = new MessageBridge(this.bridgeOptions);

    if (typeof window !== "undefined") {
      this.unsubBridge = this.bridge.onMessage(this.handleInbound);
    }
  }

  private handleInbound = (data: InboundMessage): void => {
    const partial: Partial<WidgetState> = {};

    if (data.userInformation) {
      partial.userInformation = data.userInformation;
    }

    if (data.blueprintDevices) {
      partial.blueprintDevices = data.blueprintDevices;
    }

    if (data.widget) {
      partial.widget = data.widget;
      partial.isReady = true;
      // The list comes with the widget settings. A later message without it keeps the list already known, and a
      // dashboard that predates the list never sends one, so its first message settles it as empty, not unknown.
      if (Array.isArray(data.capabilities)) {
        partial.capabilities = data.capabilities;
      } else if (this.state.capabilities === null) {
        partial.capabilities = [];
      }
    }

    // A call-endpoint failure already rejects that call's promise, so it stays out of `errors`. The key identifies it
    // while the call is in flight; the method the dashboard echoes identifies it after that.
    const isEndpointCallReply =
      (data.key !== undefined && this.endpointCallKeys.has(data.key)) || data.method === "call-endpoint";
    if (data.status === false && !isEndpointCallReply) {
      const error = data as unknown as TError;
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

  private updateRealtime(incoming: TRealtimeData[]): void {
    let newData: TRealtimeData[];

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
      lastRealtimeAt: Date.now(),
    };
    this.emit();
  }

  private updateState(partial: Partial<WidgetState>): void {
    this.state = { ...this.state, ...partial };
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  subscribe = (callback: () => void): (() => void) => {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  };

  getSnapshot = (): WidgetState => {
    return this.state;
  };

  getServerSnapshot = (): WidgetState => {
    return SERVER_SNAPSHOT;
  };

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Recreate bridge if it was destroyed (e.g. React StrictMode remount)
    if (this.bridge.isDestroyed) {
      this.bridge = new MessageBridge(this.bridgeOptions);
      if (typeof window !== "undefined") {
        this.unsubBridge = this.bridge.onMessage(this.handleInbound);
      }
    }

    this.bridge.send({ loaded: true, ...this.readyOptions });
  }

  destroy(): void {
    this.unsubBridge?.();
    this.bridge.destroy();
    this.listeners.clear();
    this.initialized = false;
  }

  sendData(records: TDataRecordInput | TDataRecordInput[]): Promise<TData> {
    const vars = Array.isArray(records) ? records : [records];
    return this.bridge.sendWithResponse({ variables: vars });
  }

  editData(records: TDataRecordInput | TDataRecordInput[]): Promise<TData> {
    const vars = Array.isArray(records) ? records : [records];
    return this.bridge.sendWithResponse({ variables: vars, method: "edit" });
  }

  deleteData(records: string | string[]): Promise<TData> {
    const vars = Array.isArray(records) ? records : [records];
    return this.bridge.sendWithResponse({ variables: vars, method: "delete" });
  }

  editResourceData(records: TResourceEditInput | TResourceEditInput[]): Promise<TData> {
    const vars = Array.isArray(records) ? records : [records];
    return this.bridge.sendWithResponse({ variables: vars, method: "edit-resource" });
  }

  /**
   * Call an Analysis Endpoint through the dashboard, which sends the viewer's session. Every HTTP answer
   * resolves, 4xx and 5xx included, except a redirect, which the dashboard refuses; the promise rejects with a
   * TEndpointCallError only when the call did not complete.
   */
  async callEndpoint<TBody = unknown>(
    endpointID: string,
    options?: TEndpointCallOptions
  ): Promise<TEndpointCallResult<TBody>> {
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
    // A dashboard without the operation never answers it, so the call stops here instead of waiting.
    if (!capabilities.includes("call-endpoint")) {
      throw endpointCallError("unsupported", "This dashboard does not support Endpoint calls from custom widgets.");
    }

    let payload: Record<string, unknown>;
    try {
      // A path string passed where the options go would otherwise run GET / on the Endpoint.
      if (options !== undefined && !isPlainObject(options)) {
        throw new TypeError(
          `The options must be an object such as { method, path, query, body }, not ${describeValue(options)}.`
        );
      }
      // Named fields only, and no `variables`: the dashboard sends any message with `variables` to the data operations.
      const { method, path, query, body } = options ?? {};
      // The dashboard refuses this too, but with a message that does not say why, and a missing `method` is the usual cause.
      if (body !== undefined && (typeof method !== "string" || method.toUpperCase() === "GET")) {
        throw new TypeError('A body is not allowed with GET, the default method. Set method, for example to "POST".');
      }
      payload = {
        endpoint_id: endpointID,
        method,
        path,
        query: query === undefined ? undefined : encodeEndpointQuery(query),
        body: encodeEndpointBody(body),
      };
    } catch (error) {
      throw endpointCallError("bad_request", `The request cannot be sent: ${errorMessage(error)}`);
    }

    // The bridge settles the request and runs handleInbound in one synchronous pass, and the await below resumes
    // only after it, so handleInbound still finds the key of the reply that settles the call.
    const key = generateId();
    this.endpointCallKeys.add(key);
    let reply: unknown;
    try {
      reply = await this.bridge.sendWithResponse({ method: "call-endpoint", payload }, key);
    } catch (reason) {
      throw toEndpointCallError(reason);
    } finally {
      // Every way the request settles passes here: an answer, a failure reply, a destroyed bridge or a failed post.
      this.endpointCallKeys.delete(key);
    }
    return readEndpointResult<TBody>(reply);
  }

  openLink(url: string): void {
    this.bridge.send({ method: "open-link", url });
  }

  closeModal(): void {
    this.bridge.send({ method: "close-modal" });
  }

  runAnalysis(scope?: unknown): void {
    this.bridge.send({ method: "run-analysis", scope });
  }

  /**
   * Ask the parent to re-fetch this widget's resource collections and push a fresh
   * `realtime` payload back. Fire-and-forget: the updated data arrives via onRealtime.
   */
  refreshResources(): void {
    this.bridge.send({ method: "refresh-resources" });
  }

  clearErrors(): void {
    this.updateState({ errors: [] });
  }

  clearRealtimeData(): void {
    this.updateState({
      realtimeData: [],
      realtimeEventCount: 0,
      lastRealtimeAt: null,
    });
  }

  getBridge(): MessageBridge {
    return this.bridge;
  }
}
