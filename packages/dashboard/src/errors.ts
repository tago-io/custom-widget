import type { TDashboardErrorCode } from "./types/index.js";

type ErrorMeta = {
  op?: string;
  requestID?: string;
  cause?: unknown;
};

export class TagoDashboardError extends Error {
  readonly code: TDashboardErrorCode;
  /** The op that failed, or `""` when the failure was not tied to one. */
  readonly op: string;
  /** Absent when the SDK refused before the request ever left the page. */
  readonly requestID?: string;

  constructor(code: TDashboardErrorCode, message: string, meta: ErrorMeta = {}) {
    super(message, meta.cause === undefined ? undefined : { cause: meta.cause });
    this.name = "TagoDashboardError";
    this.code = code;
    this.op = meta.op ?? "";
    this.requestID = meta.requestID;
  }
}

/**
 * Structural check rather than `instanceof`: a shell can end up with two copies of the
 * bundle loaded, and then `instanceof` silently fails across them.
 */
export function isDashboardError(value: unknown): value is TagoDashboardError {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as { name?: unknown; code?: unknown; message?: unknown };
  return (
    candidate.name === "TagoDashboardError" &&
    typeof candidate.code === "string" &&
    typeof candidate.message === "string"
  );
}
