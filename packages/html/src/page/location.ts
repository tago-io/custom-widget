import type { TDashboardTheme } from "../types/index.js";

/**
 * The theme the host put on the shell URL, available before any message arrives.
 *
 * Reading it is what makes a correct first paint possible. Applying it is the author's call —
 * the SDK does not touch the document.
 */
export function getInitialTheme(search?: string): TDashboardTheme {
  const raw = search ?? (typeof location === "undefined" ? "" : location.search);
  return new URLSearchParams(raw).get("theme") === "dark" ? "dark" : "light";
}
