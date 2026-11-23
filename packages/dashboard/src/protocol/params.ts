import type { TQueryParam } from "../types/index.js";

/** The host's own guard, mirrored exactly. Never make this stricter. */
export const QUERY_ID_PATTERN = /^[a-z0-9]{24}$/i;

export function isValidQueryId(value: unknown): value is string {
  return typeof value === "string" && QUERY_ID_PATTERN.test(value);
}

/** The host checks an Endpoint's Analysis ID with the same resource ID guard as a query id. */
export function isValidAnalysisID(value: unknown): value is string {
  return isValidQueryId(value);
}

/**
 * The host sends a body that is not a string as JSON. Encoding it here gives it JSON's rules before `postMessage`
 * clones it: `toJSON()` applies, which the structured clone would skip, and a value JSON cannot encode throws a
 * `TypeError` before anything is posted, where the host would otherwise fail the call after the fact.
 *
 * A value whose JSON is a bare string, such as a `Date`, is refused too: decoded, it is a string again, and the host
 * sends a string as text, so the Analysis would get it as `context.request.body` with `scope` nil.
 */
export function encodeEndpointBody(body: unknown): unknown {
  if (body === undefined || typeof body === "string") {
    return body;
  }
  const json = JSON.stringify(body);
  if (json === undefined) {
    throw new TypeError(`A ${typeof body} is not a JSON value.`);
  }
  const encoded = JSON.parse(json) as unknown;
  if (typeof encoded === "string") {
    throw new TypeError(
      "Its JSON is a bare string, which the dashboard would send as text. Put it in an object, or send a string."
    );
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
