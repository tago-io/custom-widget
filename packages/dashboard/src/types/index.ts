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

/**
 * The parent page's querystring, as the host forwards it: a flat map of string values.
 *
 * Values are strings so one flows straight into a `sql.run` param. Keys the host owns (dashboard
 * UI state, TagoRUN session keys, auth tokens) are never forwarded, so they never appear here.
 * `Partial` because a key the link does not carry is simply absent, and `Readonly` because the
 * client freezes the map it hands out.
 */
export type TDashboardParams = Readonly<Partial<Record<string, string>>>;

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

/** One entry of the `endpoint.list` result: an Analysis whose Endpoint the viewer may call. */
export type TEndpointSummary = { id: string; name: string };

export type TEndpointMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** The host sends every query value as a string. */
export type TEndpointQueryValue = string | number | boolean;

/**
 * What `endpoint.call` sends to the Endpoint. The host adds the viewer's session token and sets the content type from
 * the body; a shell cannot add a header of its own.
 */
export type TEndpointRequest = {
  /** Defaults to `"GET"` on the host. */
  method?: TEndpointMethod;
  /** Below the Endpoint root, such as `"/setpoint"`. Defaults to `"/"`. The host refuses `.` and `..` segments. */
  path?: string;
  /**
   * A plain object; an array repeats its key. A key whose value is `undefined` is left out; any other value that is
   * not a string, a finite number or a boolean rejects with `bad_request` naming its key, before anything is posted.
   * So does a `URLSearchParams` or a `Map`, which would go out empty: pass `Object.fromEntries(params)`.
   */
  query?: Record<string, TEndpointQueryValue | TEndpointQueryValue[] | undefined>;
  /**
   * A string is sent as is, as text, so the Analysis reads `context.request.body` and gets `scope` as nil. Any other
   * value is sent as JSON, encoded here with JSON's rules: `toJSON()` applies, as for a `Date` inside an object. These
   * reject with `bad_request` before anything is posted:
   * - a value JSON cannot encode, such as a `BigInt` or a cycle;
   * - a value JSON would write as `{}`, such as a `Map`, a `FormData`, a `Blob` or a class instance that keeps its data
   *   in private fields (a class instance with fields is sent as its fields);
   * - a value whose JSON is a bare string, such as a top-level `Date`, which the host would send as text;
   * - any body with `GET`, the default method.
   */
  body?: unknown;
};

/**
 * The Endpoint's answer. Every HTTP status resolves with it, 4xx and 5xx included, so a form can read the field
 * errors of a 422. The host refuses to follow a redirect, so a redirect status such as 302 comes back as an
 * `api_error` rejection instead.
 */
export type TEndpointCallResult<TBody = unknown> = {
  status: number;
  /**
   * The response headers the browser can read, with lowercase names. A header the response does not carry is absent.
   * No prototype, like `params`: check one with `"etag" in headers` or `Object.hasOwn`, not `headers.hasOwnProperty`.
   */
  headers: Partial<Record<string, string>>;
  /** Parsed when the response is JSON, else the response text. `TBody` is an assertion, never validated. */
  body: TBody;
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
   * answers with an error, and an Endpoint answers 504 after its own 30 seconds, so this only
   * catches a host that never replies at all. Default 60000. `0` disables it. It bounds
   * `endpoint.call` too, so keep it above 30 seconds, or pass a longer `timeoutMs` to each call,
   * or a slow Endpoint reports `no_response` while it is still running.
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
  | { type: "dashboard:params"; params: TDashboardParams }
  | { type: "dashboard:response"; id: string; ok: true; result: unknown }
  | { type: "dashboard:response"; id: string; ok: false; error: { code: string; message: string } };

export type TOutboundMessage =
  | { type: "dashboard:ready" }
  | { type: "dashboard:request"; id: string; op: string; payload?: unknown };
