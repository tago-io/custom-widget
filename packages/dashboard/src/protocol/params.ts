import type { TQueryParam } from "../types/index.js";

/** The host's own guard, mirrored exactly. Never make this stricter. */
export const QUERY_ID_PATTERN = /^[a-z0-9]{24}$/i;

export function isValidQueryId(value: unknown): value is string {
  return typeof value === "string" && QUERY_ID_PATTERN.test(value);
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
