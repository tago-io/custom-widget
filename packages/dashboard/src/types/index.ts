export type TDashboardTheme = "dark" | "light";

/** Mirrors the host bridge's own error codes. */
export type THostErrorCode = "not_found" | "forbidden" | "bad_params" | "api_error" | "unknown_op" | "bad_request";

/** Host codes plus the ones the SDK raises locally, so one `switch` covers everything. */
export type TDashboardErrorCode = THostErrorCode | "timeout" | "aborted" | "no_host" | "internal";

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
