export { createDashboardClient, DashboardClient } from "./client/dashboard-client.js";
export { isDashboardError, TagoDashboardError } from "./errors.js";
export { getInitialTheme } from "./page/location.js";
export { isValidQueryId, QUERY_ID_PATTERN, serializeQueryParams } from "./protocol/params.js";

export type {
  TCallOptions,
  TDashboardClientOptions,
  TDashboardErrorCode,
  TDashboardStyle,
  TDashboardTheme,
  THostErrorCode,
  TInboundMessage,
  TKnownErrorCode,
  TOutboundMessage,
  TQueryParam,
  TReadableStore,
  TSqlQuerySummary,
  TSqlRow,
  TSqlRunResult,
} from "./types/index.js";
