export { useDashboardClient } from "./hooks/use-dashboard-client.js";
export { useSqlQueries } from "./hooks/use-sql-queries.js";
export type { TUseSqlQueriesReturn } from "./hooks/use-sql-queries.js";
export { useSqlQuery } from "./hooks/use-sql-query.js";
export type { TUseSqlQueryReturn } from "./hooks/use-sql-query.js";
export { useDashboardStyle, useTheme } from "./hooks/use-theme.js";
export { DashboardProvider } from "./provider/dashboard-provider.js";
export type { TDashboardProviderProps } from "./provider/dashboard-provider.js";

// Values that a shell legitimately needs alongside the hooks. Deliberately not `export *`:
// re-exporting the imperative client API here would create a second way to start a client.
export {
  DashboardClient,
  getInitialTheme,
  isDashboardError,
  isValidQueryId,
  TagoDashboardError,
} from "@tago-io/custom-dashboard";

export type * from "@tago-io/custom-dashboard";
