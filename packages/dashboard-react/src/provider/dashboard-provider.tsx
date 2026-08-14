import { DashboardClient, type TDashboardClientOptions } from "@tago-io/custom-dashboard";
import { type ReactNode, useEffect, useRef } from "react";

import { DashboardContext } from "./dashboard-context.js";

export type TDashboardProviderProps = Omit<TDashboardClientOptions, "autoStart"> & {
  children: ReactNode;
  /** Bring your own client — for tests, or to share one with non-React code. */
  client?: DashboardClient;
};

export function DashboardProvider({ children, client, ...options }: TDashboardProviderProps) {
  const clientRef = useRef<DashboardClient>(undefined);
  if (!clientRef.current) {
    clientRef.current = client ?? new DashboardClient(options);
  }

  useEffect(() => {
    const instance = clientRef.current;
    if (!instance) {
      return;
    }
    // start/stop are both idempotent and reversible, which is what makes StrictMode's
    // mount → unmount → mount cycle survivable.
    instance.start();
    return () => instance.stop();
  }, []);

  return <DashboardContext.Provider value={clientRef.current}>{children}</DashboardContext.Provider>;
}
