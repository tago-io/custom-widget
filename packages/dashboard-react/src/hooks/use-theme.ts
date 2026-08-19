import type { TDashboardStyle, TDashboardTheme } from "@tago-io/custom-dashboard";
import { useSyncExternalStore } from "react";

import { useDashboardClient } from "./use-dashboard-client.js";

/**
 * The host's current theme. Applying it is yours to do — the SDK never touches the document.
 *
 * Re-renders only on a real change: the host re-sends the same theme on any `<html>` class
 * mutation, and the client filters those out before they reach React.
 */
export function useTheme(): TDashboardTheme {
  const client = useDashboardClient();
  return useSyncExternalStore(client.theme.subscribe, client.theme.get, client.theme.get);
}

export function useDashboardStyle(): TDashboardStyle {
  const client = useDashboardClient();
  return useSyncExternalStore(client.style.subscribe, client.style.get, client.style.get);
}
