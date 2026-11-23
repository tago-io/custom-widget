import { TagoDashboardError } from "../errors.js";
import { getInitialTheme } from "../page/location.js";
import {
  normalizeEndpointCallResult,
  normalizeEndpointListResult,
  normalizeSqlListResult,
  normalizeSqlRunResult,
  readInboundMessage,
  readResponseResult,
} from "../protocol/messages.js";
import { encodeEndpointBody, isValidAnalysisID, isValidQueryId, serializeQueryParams } from "../protocol/params.js";
import type {
  TCallOptions,
  TDashboardClientOptions,
  TDashboardParams,
  TDashboardStyle,
  TDashboardTheme,
  TEndpointCallResult,
  TEndpointRequest,
  TEndpointSummary,
  TOutboundMessage,
  TQueryParam,
  TReadableStore,
  TSqlQuerySummary,
  TSqlRow,
  TSqlRunResult,
} from "../types/index.js";
import { createRequestIdFactory } from "./generate-id.js";
import { PendingPool } from "./pending-pool.js";

const DEFAULT_TIMEOUT_MS = 60_000;

/** The one op that changes something. A failure after it was posted leaves the outcome unknown. */
const ENDPOINT_CALL_OP = "endpoint.call";

/**
 * The host attaches its listener in an effect, so under React StrictMode it briefly detaches.
 * A single `ready` landing in that gap leaves the shell with no theme and no learned origin,
 * and the iframe does not reload. Retries are safe because the host answers every ready.
 */
const READY_RETRY_DELAYS_MS = [100, 300, 700, 1500];

// Prototype-free, like every map `readInboundMessage` builds, so `params.constructor` is undefined.
const EMPTY_PARAMS: TDashboardParams = Object.freeze(Object.create(null) as Record<string, string>);

function shallowEqual<TValue>(
  left: Readonly<Record<string, TValue>>,
  right: Readonly<Record<string, TValue>>
): boolean {
  const leftKeys = Object.keys(left);
  if (leftKeys.length !== Object.keys(right).length) {
    return false;
  }
  // The own-key check keeps `{ a: undefined }` and `{ b: undefined }` apart.
  return leftKeys.every((key) => Object.prototype.hasOwnProperty.call(right, key) && left[key] === right[key]);
}

export class DashboardClient {
  readonly theme: TReadableStore<TDashboardTheme>;
  readonly style: TReadableStore<TDashboardStyle>;
  readonly params: TReadableStore<TDashboardParams>;
  readonly sql: {
    list: (options?: TCallOptions) => Promise<TSqlQuerySummary[]>;
    run: <TRow extends TSqlRow = TSqlRow>(
      queryID: string,
      params?: TQueryParam[],
      options?: TCallOptions
    ) => Promise<TSqlRunResult<TRow>>;
  };
  readonly endpoint: {
    list: (options?: TCallOptions) => Promise<TEndpointSummary[]>;
    call: <TBody = unknown>(
      analysisID: string,
      request?: TEndpointRequest,
      options?: TCallOptions
    ) => Promise<TEndpointCallResult<TBody>>;
  };

  private readonly options: TDashboardClientOptions;
  private readonly selfWindow: Window | null;
  private readonly targetWindow: Window | null;
  private readonly allowedOrigins: Set<string> | null;
  private readonly nextRequestID: () => string;
  private readonly pending = new PendingPool();
  private readonly inFlight = new Map<string, Promise<{ result: unknown; requestID: string }>>();
  private readonly themeListeners = new Set<() => void>();
  private readonly styleListeners = new Set<() => void>();
  private readonly paramsListeners = new Set<() => void>();

  private started = false;
  // Calls made while the client is not running, each waiting one microtask for a start().
  private readonly parked = new Set<() => void>();
  private themeValue: TDashboardTheme;
  // Per instance, not a shared module constant: `style.get()` hands this object to the author,
  // and a shared one would let a mutation in one shell reach every client in the document.
  private styleValue: TDashboardStyle = {};
  private styleReceived = false;
  // Frozen, so one shared empty map is safe. Starts empty: the host posts params only when the
  // parent URL carries some, so "nothing arrived" and "no params" read the same.
  private paramsValue: TDashboardParams = EMPTY_PARAMS;
  private learnedOrigin: string | null = null;
  private readyTimers: ReturnType<typeof setTimeout>[] = [];
  private warnedNoHost = false;

  constructor(options: TDashboardClientOptions = {}) {
    this.options = options;
    this.selfWindow = typeof window === "undefined" ? null : window;
    this.targetWindow = options.targetWindow !== undefined ? options.targetWindow : (this.selfWindow?.parent ?? null);
    this.allowedOrigins = options.allowedOrigins ? new Set(options.allowedOrigins) : null;
    this.nextRequestID = options.generateRequestID ?? createRequestIdFactory();
    this.themeValue = getInitialTheme();

    this.theme = {
      get: () => this.themeValue,
      subscribe: (listener) => {
        this.themeListeners.add(listener);
        return () => {
          this.themeListeners.delete(listener);
        };
      },
    };

    this.style = {
      get: () => this.styleValue,
      subscribe: (listener) => {
        this.styleListeners.add(listener);
        return () => {
          this.styleListeners.delete(listener);
        };
      },
    };

    this.params = {
      get: () => this.paramsValue,
      subscribe: (listener) => {
        this.paramsListeners.add(listener);
        return () => {
          this.paramsListeners.delete(listener);
        };
      },
    };

    this.sql = {
      list: (callOptions) => this.listQueries(callOptions),
      run: (queryID, params, callOptions) => this.runQuery(queryID, params, callOptions),
    };

    this.endpoint = {
      list: (callOptions) => this.listEndpoints(callOptions),
      call: (analysisID, request, callOptions) => this.callEndpoint(analysisID, request, callOptions),
    };

    if (options.autoStart) {
      this.start();
    }
  }

  /** False when the page was opened directly instead of embedded by a dashboard host. */
  get isEmbedded(): boolean {
    return this.targetWindow !== null && this.targetWindow !== this.selfWindow;
  }

  get pendingCount(): number {
    return this.pending.size;
  }

  /** Attach the listener and announce the shell. Idempotent, and safe to call after `stop()`. */
  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;

    if (this.selfWindow) {
      this.selfWindow.addEventListener("message", this.handleMessage, false);
    }

    // Forget any params from before a stop(): a change posted while detached was lost, and the host
    // answers ready with params only when the map is non-empty, so a URL cleared in between would
    // otherwise stay live. Done here rather than in stop() so a subscriber that reacts with sql.run
    // talks to a started client instead of one being torn down.
    this.setParams(EMPTY_PARAMS);

    if (!this.isEmbedded && !this.warnedNoHost) {
      this.warnedNoHost = true;
      console.info(
        "[TagoIO Dashboard] No dashboard host detected — running standalone. sql.* and endpoint.* calls will fail fast."
      );
    }

    this.postReady();
  }

  /**
   * Detach, fail everything in flight, and clear every timer. The client stays reusable. A call
   * made while the client is not running rejects with `aborted` instead of waiting out the timeout
   * for an answer nobody would read, unless `start()` runs in the same tick.
   */
  stop(): void {
    if (!this.started) {
      return;
    }
    this.started = false;

    if (this.selfWindow) {
      this.selfWindow.removeEventListener("message", this.handleMessage, false);
    }

    this.clearReadyTimers();
    this.inFlight.clear();

    // A call still waiting for start() is in flight too. Failing it here, before it posts, is what
    // keeps StrictMode's first mount from running every query twice.
    for (const abort of this.parked) {
      abort();
    }
    this.parked.clear();

    for (const entry of this.pending.drain()) {
      if (entry.timer) {
        clearTimeout(entry.timer);
      }
      const message =
        entry.op === ENDPOINT_CALL_OP
          ? "The dashboard client was stopped before the Endpoint answered. The call was sent and may have run."
          : "The dashboard client was stopped.";
      entry.reject(new TagoDashboardError("aborted", message, { op: entry.op }));
    }
  }

  private postReady(): void {
    this.post({ type: "dashboard:ready" });

    for (const delay of READY_RETRY_DELAYS_MS) {
      this.readyTimers.push(
        setTimeout(() => {
          this.post({ type: "dashboard:ready" });
        }, delay)
      );
    }
  }

  private clearReadyTimers(): void {
    for (const timer of this.readyTimers) {
      clearTimeout(timer);
    }
    this.readyTimers = [];
  }

  private post(message: TOutboundMessage): void {
    if (!this.targetWindow) {
      return;
    }
    this.targetWindow.postMessage(message, this.options.parentOrigin ?? this.learnedOrigin ?? "*");
  }

  private handleMessage = (event: MessageEvent): void => {
    if (!this.started) {
      return;
    }
    if (this.allowedOrigins && !this.allowedOrigins.has(event.origin)) {
      return;
    }

    const message = readInboundMessage(event.data);
    if (!message) {
      return;
    }

    // Pin the outbound origin only to a message that came from the window we talk to. Learning
    // it from any sender would let a bystander frame redirect our requests into a black hole.
    if (event.source === this.targetWindow) {
      this.clearReadyTimers();
      if (!this.learnedOrigin && event.origin && event.origin !== "null") {
        this.learnedOrigin = event.origin;
      }
    }

    if (message.kind !== "response") {
      // Only the host window may push state into the shell. Params decide which data the queries
      // fetch, and theme and style decide what the viewer sees, so a child frame or an extension
      // posting to this window must not be able to change any of them. Opened standalone, the
      // target is this very window, so nothing qualifies and the theme stays on the URL's.
      if (!this.isEmbedded || event.source !== this.targetWindow) {
        return;
      }
      if (message.kind === "theme") {
        this.setTheme(message.theme);
      } else if (message.kind === "style") {
        this.setStyle(message.style);
      } else {
        this.setParams(message.params);
      }
      return;
    }

    this.settleResponse(message.id, message.body);
  };

  private settleResponse(id: string, body: Record<string, unknown>): void {
    const entry = this.pending.take(id);
    if (!entry) {
      if (this.pending.wasExpired(id)) {
        // This one we can name: the request timed out and the answer turned up anyway. Worth
        // saying so, because the alternative reading is "my query silently did nothing".
        // `debug` rather than `warn`, since it is diagnostic and browsers hide it by default.
        console.debug(`[TagoIO Dashboard] Ignoring a late response for ${id}, which already timed out.`);
        return;
      }
      // Duplicated, addressed to another client in this document, or forged. All noise.
      return;
    }
    if (entry.timer) {
      clearTimeout(entry.timer);
    }

    try {
      entry.resolve(readResponseResult(body, { op: entry.op, requestID: id }));
    } catch (error) {
      entry.reject(error);
    }
  }

  private setTheme(theme: TDashboardTheme): void {
    // The host re-sends the current theme on any <html> class mutation, so most of these repeat.
    if (theme === this.themeValue) {
      return;
    }
    this.themeValue = theme;
    this.emit(this.themeListeners);
  }

  private setStyle(style: TDashboardStyle): void {
    if (this.styleReceived && shallowEqual(this.styleValue, style)) {
      return;
    }
    this.styleReceived = true;
    // Copy, never adopt. One MessageEvent reaches every listener carrying the same `data`
    // object, so storing the payload itself would hand two clients in this document the very
    // same object out of `style.get()`, and a mutation through one would show up in the other.
    this.styleValue = { ...style };
    this.emit(this.styleListeners);
  }

  private setParams(params: TDashboardParams): void {
    // The host already skips unchanged maps, but a second client or a re-sent ready can repeat one.
    if (shallowEqual(this.paramsValue, params)) {
      return;
    }
    // Adopting is safe here, unlike `style`: `readInboundMessage` runs once per client and builds a
    // fresh object each time, so no two clients ever share this map. Frozen, because `get()` hands
    // it to the author and an in-place edit would skip the subscribers and corrupt the dedupe.
    this.paramsValue = Object.freeze(params);
    this.emit(this.paramsListeners);
  }

  private emit(listeners: Set<() => void>): void {
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        console.error("[TagoIO Dashboard] A subscriber threw an error:", error);
      }
    }
  }

  private claimRequestID(): string {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const id = this.nextRequestID();
      if (id.length > 0 && !this.pending.has(id)) {
        return id;
      }
    }
    throw new TagoDashboardError("internal", "Could not allocate a unique request id.");
  }

  /**
   * Coalesce identical in-flight calls. Fresh executions are rate limited per plan while cached
   * reads are not, so two components mounting together must not cost two executions.
   */
  private send(
    op: string,
    payload: unknown,
    options: TCallOptions | undefined,
    coalesceKey: string
  ): Promise<{ result: unknown; requestID: string }> {
    const timeoutMs = this.resolveTimeout(options);
    const key = `${op}|${coalesceKey}|${timeoutMs}`;

    const existing = this.inFlight.get(key);
    if (existing) {
      return existing;
    }

    const promise: Promise<{ result: unknown; requestID: string }> = this.dispatch(op, payload, timeoutMs).finally(
      () => {
        // Retract only our own entry. Under React StrictMode the first call, `stop()`, the remount's
        // identical call and `start()` all land in one tick, which registers a fresh promise under
        // this key before the stopped one settles. Deleting unconditionally would drop the live entry and cost a
        // second execution, defeating the coalescing this key exists for.
        if (this.inFlight.get(key) === promise) {
          this.inFlight.delete(key);
        }
      }
    );
    this.inFlight.set(key, promise);
    return promise;
  }

  private resolveTimeout(options: TCallOptions | undefined): number {
    return options?.timeoutMs ?? this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  private dispatch(op: string, payload: unknown, timeoutMs: number): Promise<{ result: unknown; requestID: string }> {
    if (!this.isEmbedded) {
      return Promise.reject(
        new TagoDashboardError(
          "no_host",
          "No dashboard host detected — this page must run inside a TagoIO Custom Dashboard.",
          { op }
        )
      );
    }

    if (!this.started) {
      return this.waitForStart(op, payload, timeoutMs);
    }

    return new Promise((resolve, reject) => {
      let requestID: string;
      try {
        requestID = this.claimRequestID();
      } catch (error) {
        reject(error);
        return;
      }

      const timer =
        timeoutMs > 0
          ? setTimeout(() => {
              const expired = this.pending.take(requestID);
              if (!expired) {
                return;
              }
              this.pending.markExpired(requestID);
              expired.reject(
                new TagoDashboardError("no_response", noResponseMessage(op, timeoutMs), { op, requestID })
              );
            }, timeoutMs)
          : null;

      const added = this.pending.add(requestID, {
        op,
        timer,
        resolve: (result) => {
          resolve({ result, requestID });
        },
        reject,
      });

      if (!added) {
        if (timer) {
          clearTimeout(timer);
        }
        reject(new TagoDashboardError("internal", "Request id collision.", { op, requestID }));
        return;
      }

      try {
        this.post(
          payload === undefined
            ? { type: "dashboard:request", id: requestID, op }
            : { type: "dashboard:request", id: requestID, op, payload }
        );
      } catch (error) {
        // postMessage can throw (DataCloneError). Drop the entry so it cannot leak.
        const failed = this.pending.take(requestID);
        if (failed?.timer) {
          clearTimeout(failed.timer);
        }
        reject(
          new TagoDashboardError("internal", "Failed to post the request to the dashboard host.", {
            op,
            requestID,
            cause: error,
          })
        );
      }
    });
  }

  /**
   * React runs a child's effects before its provider's, on the first mount and again when StrictMode
   * or a revealed <Activity> remounts the tree, so a hook calls into a client that its provider
   * starts a moment later in the same tick. Wait one microtask for that start(). A client still not
   * running after it was never coming, and posting would only wait out the timeout for an answer
   * that no listener reads.
   */
  private waitForStart(
    op: string,
    payload: unknown,
    timeoutMs: number
  ): Promise<{ result: unknown; requestID: string }> {
    return new Promise((resolve, reject) => {
      const abort = () => reject(new TagoDashboardError("aborted", "The dashboard client was stopped.", { op }));
      this.parked.add(abort);

      queueMicrotask(() => {
        // stop() already failed it.
        if (!this.parked.delete(abort)) {
          return;
        }
        if (!this.started) {
          reject(
            new TagoDashboardError(
              "aborted",
              "The dashboard client is not started. Call start() before making calls.",
              {
                op,
              }
            )
          );
          return;
        }
        this.dispatch(op, payload, timeoutMs).then(resolve, reject);
      });
    });
  }

  private async listQueries(options?: TCallOptions): Promise<TSqlQuerySummary[]> {
    const { result, requestID } = await this.send("sql.list", undefined, options, "");
    return normalizeSqlListResult(result, { op: "sql.list", requestID });
  }

  private async runQuery<TRow extends TSqlRow = TSqlRow>(
    queryID: string,
    params?: TQueryParam[],
    options?: TCallOptions
  ): Promise<TSqlRunResult<TRow>> {
    if (!isValidQueryId(queryID)) {
      throw new TagoDashboardError(
        "bad_request",
        `Invalid query id ${JSON.stringify(queryID)} — expected 24 alphanumeric characters.`,
        { op: "sql.run" }
      );
    }

    // `params` goes on the wire exactly as given: same order, same values, nothing added.
    const payload = params && params.length > 0 ? { query_id: queryID, params } : { query_id: queryID };
    const coalesceKey = `${queryID}|${serializeQueryParams(params)}`;

    const { result, requestID } = await this.send("sql.run", payload, options, coalesceKey);
    return normalizeSqlRunResult<TRow>(result, { op: "sql.run", requestID });
  }

  private async listEndpoints(options?: TCallOptions): Promise<TEndpointSummary[]> {
    const { result, requestID } = await this.send("endpoint.list", undefined, options, "");
    return normalizeEndpointListResult(result, { op: "endpoint.list", requestID });
  }

  /**
   * Never coalesced, unlike every read: two identical POSTs are two saves, and sharing one request would drop the
   * second. Never retried either, for the same reason.
   */
  private async callEndpoint<TBody = unknown>(
    analysisID: string,
    request?: TEndpointRequest,
    options?: TCallOptions
  ): Promise<TEndpointCallResult<TBody>> {
    if (!isValidAnalysisID(analysisID)) {
      throw new TagoDashboardError(
        "bad_request",
        `Invalid Analysis ID ${JSON.stringify(analysisID)}: expected the 24 alphanumeric characters in the Endpoint URL.`,
        { op: ENDPOINT_CALL_OP }
      );
    }

    const payload: Record<string, unknown> = { endpoint_id: analysisID };
    const { method, path, query, body } = request ?? {};
    if (method !== undefined) {
      payload.method = method;
    }
    if (path !== undefined) {
      payload.path = path;
    }
    if (query !== undefined) {
      payload.query = query;
    }
    try {
      const encoded = encodeEndpointBody(body);
      if (encoded !== undefined) {
        payload.body = encoded;
      }
    } catch (error) {
      throw new TagoDashboardError(
        "bad_request",
        `The request body cannot be sent: ${error instanceof Error ? error.message : String(error)}`,
        { op: ENDPOINT_CALL_OP, cause: error }
      );
    }

    const { result, requestID } = await this.dispatch(ENDPOINT_CALL_OP, payload, this.resolveTimeout(options));
    return normalizeEndpointCallResult<TBody>(result, { op: ENDPOINT_CALL_OP, requestID });
  }
}

function noResponseMessage(op: string, timeoutMs: number): string {
  const unanswered = `The dashboard did not answer ${op} within ${timeoutMs}ms. It may have been reloaded or navigated away.`;
  if (op === ENDPOINT_CALL_OP) {
    // An Endpoint answers 504 after its own 30 seconds, so only a lost reply gets here, and the call may have run.
    return `${unanswered} The call was sent and may have run, so check its effect before calling again.`;
  }
  return (
    `${unanswered} This is a transport backstop, not a query limit: a query that runs too long comes back as ` +
    "`timeout` instead. If the dashboard is simply slow, raise timeoutMs."
  );
}

export function createDashboardClient(options?: TDashboardClientOptions): DashboardClient {
  return new DashboardClient(options);
}
