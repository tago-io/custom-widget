import { TagoDashboardError } from "../errors.js";
import { getInitialTheme } from "../page/location.js";
import {
  normalizeSqlListResult,
  normalizeSqlRunResult,
  readInboundMessage,
  readResponseResult,
} from "../protocol/messages.js";
import { isValidQueryId, serializeQueryParams } from "../protocol/params.js";
import type {
  TCallOptions,
  TDashboardClientOptions,
  TDashboardStyle,
  TDashboardTheme,
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

/**
 * The host attaches its listener in an effect, so under React StrictMode it briefly detaches.
 * A single `ready` landing in that gap leaves the shell with no theme and no learned origin,
 * and the iframe does not reload. Retries are safe because the host answers every ready.
 */
const READY_RETRY_DELAYS_MS = [100, 300, 700, 1500];

function shallowEqual(left: TDashboardStyle, right: TDashboardStyle): boolean {
  const leftKeys = Object.keys(left);
  if (leftKeys.length !== Object.keys(right).length) {
    return false;
  }
  return leftKeys.every((key) => left[key] === right[key]);
}

export class DashboardClient {
  readonly theme: TReadableStore<TDashboardTheme>;
  readonly style: TReadableStore<TDashboardStyle>;
  readonly sql: {
    list: (options?: TCallOptions) => Promise<TSqlQuerySummary[]>;
    run: <TRow extends TSqlRow = TSqlRow>(
      queryID: string,
      params?: TQueryParam[],
      options?: TCallOptions
    ) => Promise<TSqlRunResult<TRow>>;
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

  private started = false;
  private themeValue: TDashboardTheme;
  // Per instance, not a shared module constant: `style.get()` hands this object to the author,
  // and a shared one would let a mutation in one shell reach every client in the document.
  private styleValue: TDashboardStyle = {};
  private styleReceived = false;
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

    this.sql = {
      list: (callOptions) => this.listQueries(callOptions),
      run: (queryID, params, callOptions) => this.runQuery(queryID, params, callOptions),
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

    if (!this.isEmbedded && !this.warnedNoHost) {
      this.warnedNoHost = true;
      console.info("[TagoIO Dashboard] No dashboard host detected — running standalone. sql.* calls will fail fast.");
    }

    this.postReady();
  }

  /** Detach, fail everything in flight, and clear every timer. The client stays reusable. */
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

    for (const entry of this.pending.drain()) {
      if (entry.timer) {
        clearTimeout(entry.timer);
      }
      entry.reject(new TagoDashboardError("aborted", "The dashboard client was stopped.", { op: entry.op }));
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

    if (message.kind === "theme") {
      this.setTheme(message.theme);
      return;
    }
    if (message.kind === "style") {
      this.setStyle(message.style);
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
    this.styleValue = style;
    this.emit(this.styleListeners);
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
    const timeoutMs = options?.timeoutMs ?? this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const key = `${op}|${coalesceKey}|${timeoutMs}`;

    const existing = this.inFlight.get(key);
    if (existing) {
      return existing;
    }

    const promise = this.dispatch(op, payload, timeoutMs).finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, promise);
    return promise;
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
                new TagoDashboardError(
                  "no_response",
                  `The dashboard did not answer ${op} within ${timeoutMs}ms. It may have been reloaded or navigated away. ` +
                    "This is a transport backstop, not a query limit: a query that runs too long comes back as `timeout` instead. " +
                    "If the dashboard is simply slow, raise timeoutMs.",
                  { op, requestID }
                )
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
}

export function createDashboardClient(options?: TDashboardClientOptions): DashboardClient {
  return new DashboardClient(options);
}
