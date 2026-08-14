import type { DashboardClient } from "@tago-io/custom-dashboard";
import { createContext } from "react";

export const DashboardContext = createContext<DashboardClient | null>(null);
