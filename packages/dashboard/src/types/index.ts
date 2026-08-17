export type TDashboardTheme = "dark" | "light";

/** Mirrors the host bridge's own error codes. */
export type THostErrorCode =
  | "not_found"
  | "forbidden"
  | "bad_params"
  | "plan_limit"
  | "timeout"
  | "rate_limited"
  | "api_error"
  | "unknown_op"
  | "bad_request";

/**
 * Host codes plus the ones the SDK raises locally.
 *
 * `no_response` is deliberately not called `timeout`: the host owns that code for a query
 * that exceeded its execution deadline, and the remedy differs. A `timeout` means narrow the
 * query; a `no_response` means the dashboard never answered at all.
 */
export type TKnownErrorCode = THostErrorCode | "no_response" | "aborted" | "no_host" | "internal";

/**
 * What `TagoDashboardError.code` can actually hold at runtime.
 *
 * The open tail is not laziness. An unrecognized host code is forwarded verbatim rather than
 * flattened, so a host newer than this SDK produces a code outside the known set. Autocomplete
 * still offers every known code, and an exhaustive `switch` can no longer claim a `never`
 * default it does not have. Narrow with `TKnownErrorCode` when you want that exhaustiveness.
 */
export type TDashboardErrorCode = TKnownErrorCode | (string & {});

/** Host-driven body styles. The host currently always sends `{}`. */
export type TDashboardStyle = Record<string, string | number | null | undefined>;

/** One entry of the `sql.list` result. `id` is the wire field name, kept verbatim. */
export type TSqlQuerySummary = { id: string; name: string };

/**
 * One `sql.run` parameter, in the exact wire shape.
 * TagoSQL placeholders are positional (`$1`, `$2`) and every value is a string.
 */
export type TQueryParam = { key: string; value: string };

/** Widened from the host's `object` so rows can actually be indexed. Never validated at runtime. */
export type TSqlRow = Record<string, unknown>;

export type TSqlRunResult<TRow extends TSqlRow = TSqlRow> = {
  columns: string[];
  rows: TRow[];
  meta: {
    row_count: number | null;
    execution_ms: number | null;
    served_from_cache: boolean;
  };
};

export type TReadableStore<TValue> = {
  get: () => TValue;
  /** Does not fire on subscribe; read `get()` first. Shaped for `useSyncExternalStore`. */
  subscribe: (listener: () => void) => () => void;
};

export type TCallOptions = { timeoutMs?: number };

export type TDashboardClientOptions = {
  /** Attach the listener and post `dashboard:ready` on construction. Default `false`. */
  autoStart?: boolean;
  /**
   * Transport backstop, not a query deadline — TagoSQL enforces its own execution timeout and
   * answers with an error, so this only catches a host that never replies at all. Default 60000.
   * `0` disables it.
   */
  timeoutMs?: number;
  /** Inbound origin allowlist. Default: accept any origin. See the README before setting this. */
  allowedOrigins?: string[];
  /** Outbound target origin. Default: learned from the first host message, `"*"` until then. */
  parentOrigin?: string;
  /** The window to talk to. Default `window.parent`. Injectable for tests and dev harnesses. */
  targetWindow?: Window | null;
  /** Correlation id generator. Injectable so the collision path is testable. */
  generateRequestID?: () => string;
};

export type TInboundMessage =
  | { type: "dashboard:theme"; theme: TDashboardTheme }
  | { type: "dashboard:style"; style: TDashboardStyle }
  | { type: "dashboard:response"; id: string; ok: true; result: unknown }
  | { type: "dashboard:response"; id: string; ok: false; error: { code: string; message: string } };

export type TOutboundMessage =
  | { type: "dashboard:ready" }
  | { type: "dashboard:request"; id: string; op: string; payload?: unknown };
