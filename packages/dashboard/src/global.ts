/**
 * IIFE entry: the one file in this package that touches `window` on load.
 *
 * `src/index.ts` stays free of side effects so bundlers and SSR can import it safely; this
 * build exists for shells that paste the script straight into their HTML.
 */

import { createDashboardClient, DashboardClient } from "./client/dashboard-client.js";
import { isDashboardError, TagoDashboardError } from "./errors.js";
import { getInitialTheme } from "./page/location.js";
import { isValidQueryId, serializeQueryParams } from "./protocol/params.js";

const client = createDashboardClient({ autoStart: true });

const TagoDashboard = {
  get isEmbedded() {
    return client.isEmbedded;
  },
  theme: client.theme,
  style: client.style,
  sql: client.sql,
  start: () => client.start(),
  stop: () => client.stop(),

  createClient: createDashboardClient,
  getInitialTheme,
  isValidQueryId,
  serializeQueryParams,
  isDashboardError,
  DashboardClient,
  TagoDashboardError,
};

declare global {
  interface Window {
    TagoDashboard: typeof TagoDashboard;
  }
}

window.TagoDashboard = TagoDashboard;

export { TagoDashboard };
