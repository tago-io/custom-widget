import { DashboardClient } from "@tago-io/custom-dashboard";
import type { ReactNode } from "react";
import { vi } from "vite-plus/test";

import { DashboardProvider } from "../../src/provider/dashboard-provider.js";

const HOST_ORIGIN = "https://admin.tago.io";

/**
 * jsdom makes `window.parent === window`, so a default client would think it has no host.
 * Injecting a stand-in host window is the same seam a dev harness uses.
 */
export function createHarness() {
  const postMessage = vi.fn();
  const hostWindow = { postMessage } as unknown as Window;
  const client = new DashboardClient({ targetWindow: hostWindow });

  const requests = () =>
    postMessage.mock.calls
      .map((call) => call[0] as Record<string, unknown>)
      .filter((message) => message.type === "dashboard:request");

  const readyCount = () =>
    postMessage.mock.calls.filter((call) => (call[0] as Record<string, unknown>).type === "dashboard:ready").length;

  const lastRequestID = () => {
    const all = requests();
    return all.length > 0 ? (all[all.length - 1].id as string) : undefined;
  };

  const fromHost = (data: unknown) => {
    window.dispatchEvent(new MessageEvent("message", { data, origin: HOST_ORIGIN, source: hostWindow }));
  };

  const respondOk = (result: unknown, id = lastRequestID()) => {
    fromHost({ type: "dashboard:response", id, ok: true, result });
  };

  const respondError = (code: string, message: string, id = lastRequestID()) => {
    fromHost({ type: "dashboard:response", id, ok: false, error: { code, message } });
  };

  const wrapper = ({ children }: { children: ReactNode }) => (
    <DashboardProvider client={client}>{children}</DashboardProvider>
  );

  return { client, wrapper, postMessage, requests, readyCount, lastRequestID, fromHost, respondOk, respondError };
}

export const RUN_RESULT = {
  columns: ["name"],
  rows: [{ name: "device-a" }],
  meta: { row_count: 1, execution_ms: 4, served_from_cache: false },
};
