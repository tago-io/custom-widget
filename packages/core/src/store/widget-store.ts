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

/**
 * The dashboard sends a body that is not a string as JSON, so it takes JSON's rules here: toJSON() applies, as for a
 * Date, and a value JSON cannot encode, such as a BigInt or a cycle, is refused before anything is posted.
 */
function encodeEndpointBody(body: unknown): unknown {
  if (body === undefined || typeof body === "string") return body;
  const json = JSON.stringify(body);
  if (json === undefined) throw new TypeError(`A ${typeof body} is not a JSON value.`);
  return JSON.parse(json) as unknown;
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
      // The list comes with the widget settings. A dashboard that predates it sends none: empty, not unknown.
      partial.capabilities = Array.isArray(data.capabilities) ? data.capabilities : [];
    }

    // A call-endpoint failure already rejects that call's promise, so it stays out of `errors`.
    if (data.status === false && data.method !== "call-endpoint") {
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
        `Invalid Endpoint ID "${String(endpointID)}": pass the 24-character ID of the Analysis.`
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
      // Named fields only, and no `variables`: the dashboard sends any message with `variables` to the data operations.
      const { method, path, query, body } = options ?? {};
      payload = { endpoint_id: endpointID, method, path, query, body: encodeEndpointBody(body) };
    } catch (error) {
      throw endpointCallError("bad_request", `The request cannot be sent: ${errorMessage(error)}`);
    }

    let reply: unknown;
    try {
      reply = await this.bridge.sendWithResponse({ method: "call-endpoint", payload });
    } catch (reason) {
      throw toEndpointCallError(reason);
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
