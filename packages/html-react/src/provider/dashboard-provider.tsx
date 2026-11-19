import { DashboardClient, type TDashboardClientOptions } from "@tago-io/custom-html";
import { type ReactNode, useEffect, useState } from "react";

import { DashboardContext } from "./dashboard-context.js";

export type TDashboardProviderProps = Omit<TDashboardClientOptions, "autoStart"> & {
  children: ReactNode;
  /**
   * Bring your own client, for tests or to share one with non-React code. It stays yours: the
   * provider never starts or stops it, so call `start()` before rendering and `stop()` once nothing
   * uses it any more. The options on this provider apply only to a client it creates.
   */
  client?: DashboardClient;
};

export function DashboardProvider({ children, client, ...options }: TDashboardProviderProps) {
  // The first render decides, like any initial state: a client passed later is ignored.
  const [{ instance, owned }] = useState(() =>
    client ? { instance: client, owned: false } : { instance: new DashboardClient(options), owned: true }
  );

  useEffect(() => {
    // A client passed in may still serve other code after this unmounts. Stopping it would leave
    // every later call from that code waiting for an answer nobody reads.
    if (!owned) {
      return;
    }
    // start/stop are both idempotent and reversible, which is what makes StrictMode's
    // mount, unmount, mount cycle survivable.
    instance.start();
    return () => instance.stop();
  }, [instance, owned]);

  return <DashboardContext.Provider value={instance}>{children}</DashboardContext.Provider>;
}
