import { TagoDashboardError } from "../errors.js";
import type {
  TDashboardErrorCode,
  TDashboardStyle,
  TDashboardTheme,
  TSqlQuerySummary,
  TSqlRow,
  TSqlRunResult,
} from "../types/index.js";

type ErrorMeta = { op: string; requestID: string };

export type TReadInbound =
  | { kind: "theme"; theme: TDashboardTheme }
  | { kind: "style"; style: TDashboardStyle }
  | { kind: "response"; id: string; body: Record<string, unknown> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Narrow an inbound `message` event payload, or return null to ignore it.
 *
 * Allowlist, never denylist: opened standalone, the shell's own outbound messages echo back
 * to itself, and every browser extension on the page posts here too.
 */
export function readInboundMessage(data: unknown): TReadInbound | null {
  if (!isRecord(data) || typeof data.type !== "string") {
    return null;
  }

  if (data.type === "dashboard:theme") {
    return data.theme === "dark" || data.theme === "light" ? { kind: "theme", theme: data.theme } : null;
  }

  if (data.type === "dashboard:style") {
    return isRecord(data.style) ? { kind: "style", style: data.style as TDashboardStyle } : null;
  }

  if (data.type === "dashboard:response") {
    return typeof data.id === "string" && data.id.length > 0 ? { kind: "response", id: data.id, body: data } : null;
  }

  return null;
}

/**
 * Turn a correlated response body into its result, or throw.
 *
 * A structurally broken body rejects rather than resolving `undefined` — otherwise a forged
 * `{ ok: true }` surfaces much later as a crash inside the author's render code.
 */
export function readResponseResult(body: Record<string, unknown>, meta: ErrorMeta): unknown {
  if (body.ok === true) {
    if (!("result" in body)) {
      throw new TagoDashboardError("api_error", "The dashboard sent a malformed response.", meta);
    }
    return body.result;
  }

  if (body.ok === false) {
    const error = isRecord(body.error) ? body.error : {};
    // An unrecognized code is forwarded verbatim, not coerced, so a newer host is not flattened.
    // `TDashboardErrorCode` has an open tail precisely so this needs no cast.
    const code: TDashboardErrorCode = typeof error.code === "string" ? error.code : "api_error";
    const message = typeof error.message === "string" ? error.message : "The request failed.";
    throw new TagoDashboardError(code, message, meta);
  }

  throw new TagoDashboardError("api_error", "The dashboard sent a malformed response.", meta);
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * The execute API returns `{ name, type }` per column and the host flattens it to a string.
 * Accept both, so a host that stops flattening degrades to named columns rather than to an
 * empty header row above populated rows.
 */
function toColumnName(column: unknown): string[] {
  if (typeof column === "string") {
    return [column];
  }
  if (isRecord(column) && typeof column.name === "string") {
    return [column.name];
  }
  return [];
}

/**
 * Coerce rather than reject on drift: the host already tolerates two `columns` shapes, so a
 * cosmetic server change must not take down every deployed shell.
 */
export function normalizeSqlRunResult<TRow extends TSqlRow = TSqlRow>(
  raw: unknown,
  meta: ErrorMeta
): TSqlRunResult<TRow> {
  if (!isRecord(raw)) {
    throw new TagoDashboardError("api_error", "The dashboard sent a malformed sql.run result.", meta);
  }

  const rawMeta = isRecord(raw.meta) ? raw.meta : {};
  return {
    columns: Array.isArray(raw.columns) ? raw.columns.flatMap(toColumnName) : [],
    // A null inside `rows` breaks Object.keys in every consumer, and the host does not filter.
    rows: Array.isArray(raw.rows) ? (raw.rows.filter(isRecord) as TRow[]) : [],
    meta: {
      row_count: toNullableNumber(rawMeta.row_count),
      execution_ms: toNullableNumber(rawMeta.execution_ms),
      served_from_cache: rawMeta.served_from_cache === true,
    },
  };
}

export function normalizeSqlListResult(raw: unknown, meta: ErrorMeta): TSqlQuerySummary[] {
  if (!isRecord(raw)) {
    throw new TagoDashboardError("api_error", "The dashboard sent a malformed sql.list result.", meta);
  }
  if (!Array.isArray(raw.queries)) {
    return [];
  }

  const summaries: TSqlQuerySummary[] = [];
  for (const entry of raw.queries) {
    if (isRecord(entry) && typeof entry.id === "string") {
      summaries.push({ id: entry.id, name: typeof entry.name === "string" ? entry.name : entry.id });
    }
  }
  return summaries;
}
