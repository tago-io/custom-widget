import type { TDashboardParams } from "@tago-io/custom-html";
import { useSyncExternalStore } from "react";

import { useDashboardClient } from "./use-dashboard-client.js";

/**
 * The parent page's querystring, minus the keys the host owns. Every value is a string, so one can
 * go straight into a `useSqlQuery` param.
 *
 * Starts as `{}` and fills in once the host forwards it, then follows the parent URL without a
 * reload. Named apart from routers' `useParams`, which reads path segments, not the querystring.
 */
export function useDashboardParams(): TDashboardParams {
  const client = useDashboardClient();
  return useSyncExternalStore(client.params.subscribe, client.params.get, client.params.get);
}
