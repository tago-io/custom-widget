import { isDashboardError, TagoDashboardError } from "@tago-io/custom-html";

/** Hooks surface every failure as a TagoDashboardError, so a non-SDK throw is wrapped as `internal`. */
export function toDashboardError(cause: unknown): TagoDashboardError {
  if (isDashboardError(cause)) {
    return cause;
  }
  return new TagoDashboardError("internal", cause instanceof Error ? cause.message : String(cause), { cause });
}
