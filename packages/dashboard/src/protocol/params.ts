import type { TEndpointQueryValue, TEndpointRequest, TQueryParam } from "../types/index.js";

/** The host's own guard, mirrored exactly. Never make this stricter. */
export const QUERY_ID_PATTERN = /^[a-z0-9]{24}$/i;

export function isValidQueryId(value: unknown): value is string {
  return typeof value === "string" && QUERY_ID_PATTERN.test(value);
}

/** The host checks an Endpoint's Analysis ID with the same resource ID guard as a query id. */
export function isValidAnalysisID(value: unknown): value is string {
  return isValidQueryId(value);
}

function describe(value: object): string {
  const name = (value as { constructor?: { name?: unknown } }).constructor?.name;
  return typeof name === "string" && name.length > 0 ? name : "object";
}

/**
 * JSON writes a `Map`, a `FormData`, a `Blob` or a class instance as `{}`, so the Analysis would get an empty body and
 * no error. Only plain objects and arrays pass; `toJSON()` has already run when this sees a value, so a `Date` inside
 * an object arrives here as its string.
 */
function refuseNonPlainData(_key: string, value: unknown): unknown {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const prototype = Object.getPrototypeOf(value) as unknown;
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(
        `The body holds a ${describe(value)}, which JSON writes as {}. Convert it to a plain object.`
      );
    }
  }
  return value;
}

/**
 * The host sends a body that is not a string as JSON. Encoding it here gives it JSON's rules before `postMessage`
 * clones it: `toJSON()` applies, which the structured clone would skip, and a value JSON cannot encode throws a
 * `TypeError` before anything is posted, where the host would otherwise fail the call after the fact.
 *
 * Two more cases are refused rather than sent wrong: a value JSON writes as `{}` (see `refuseNonPlainData`), and a
 * value whose JSON is a bare string, such as a `Date`. Decoded, that is a string again, and the host sends a string as
 * text, so the Analysis would get it as `context.request.body` with `scope` nil.
 */
export function encodeEndpointBody(body: unknown): unknown {
  if (body === undefined || typeof body === "string") {
    return body;
  }
  const json = JSON.stringify(body, refuseNonPlainData);
  if (json === undefined) {
    throw new TypeError(`The body, a ${typeof body}, is not a JSON value.`);
  }
  const encoded = JSON.parse(json) as unknown;
  if (typeof encoded === "string") {
    throw new TypeError(
      "Its JSON is a bare string, which the dashboard would send as text. Put it in an object, or send a string."
    );
  }
  return encoded;
}

function isQueryScalar(value: unknown): value is TEndpointQueryValue {
  return (
    typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))
  );
}

/**
 * The host accepts only strings, finite numbers and booleans, or arrays of them, and refuses the whole call over one
 * bad value with a message that names no key. Checking here names the key and costs no round trip. A key whose value
 * is `undefined` is dropped, as JSON drops one from a body. The copy also fixes the query at call time, so a call that
 * waits for `start()` posts what the caller passed.
 */
export function encodeEndpointQuery(
  query: NonNullable<TEndpointRequest["query"]>
): Record<string, TEndpointQueryValue | TEndpointQueryValue[]> {
  if (typeof query !== "object" || query === null || Array.isArray(query)) {
    throw new TypeError("The query must be an object of key and value pairs.");
  }

  // No prototype, so a `__proto__` key is a key and not a prototype assignment that would drop it.
  const encoded = Object.create(null) as Record<string, TEndpointQueryValue | TEndpointQueryValue[]>;
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) {
      continue;
    }
    if (isQueryScalar(value)) {
      encoded[key] = value;
    } else if (Array.isArray(value) && value.every(isQueryScalar)) {
      encoded[key] = [...value];
    } else {
      throw new TypeError(
        `Query key ${JSON.stringify(key)} must be a string, a finite number or a boolean, or an array of them.`
      );
    }
  }
  return encoded;
}

function placeholderOrder(key: string): number {
  const match = /^\$(\d+)$/.exec(key);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

/**
 * Deterministic key for in-flight coalescing and React effect dependencies.
 *
 * Sorting happens here and only here: the wire payload always carries the caller's array
 * untouched, so two calls that differ only in literal order still share one request.
 */
export function serializeQueryParams(params?: TQueryParam[]): string {
  if (!params || params.length === 0) {
    return "";
  }
  const sorted = [...params].sort((left, right) => {
    const delta = placeholderOrder(left.key) - placeholderOrder(right.key);
    return delta === 0 ? left.key.localeCompare(right.key) : delta;
  });
  return JSON.stringify(sorted.map((param) => [param.key, param.value]));
}
