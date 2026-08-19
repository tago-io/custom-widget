import type { DashboardClient } from "@tago-io/custom-dashboard";
import { useContext } from "react";

import { DashboardContext } from "../provider/dashboard-context.js";

export function useDashboardClient(): DashboardClient {
  const client = useContext(DashboardContext);
  if (!client) {
    throw new Error("useDashboardClient must be used within a <DashboardProvider>");
  }
  return client;
}
