import { DashboardClient } from "@tago-io/custom-dashboard";
import type { ReactNode } from "react";
import { onTestFinished, vi } from "vite-plus/test";

import { DashboardProvider } from "../../src/provider/dashboard-provider.js";

const HOST_ORIGIN = "https://admin.tago.io";

/**
 * jsdom makes `window.parent === window`, so a default client would think it has no host.
 * Injecting a stand-in host window is the same seam a dev harness uses.
 */
/**
 * Only the slice of the spy these tests use. Annotated explicitly because inferring it would
 * name a vitest internal path that this package does not depend on, which is not portable.
 */
type TPostMessageSpy = {
  (message: unknown, targetOrigin?: string): void;
  mock: { calls: [unknown, string?][] };
};

type THostStub = {
  hostWindow: Window;
  postMessage: TPostMessageSpy;
  requests: () => Record<string, unknown>[];
  readyCount: () => number;
  lastRequestID: () => string | undefined;
  fromHost: (data: unknown) => void;
  respondOk: (result: unknown, id?: string) => void;
  respondError: (code: string, message: string, id?: string) => void;
};

type TCreateHarness = THostStub & {
  client: DashboardClient;
  wrapper: ({ children }: { children: ReactNode }) => ReactNode;
};

/** A stand-in host with no client attached, for tests where the provider creates its own. */
export function createHostStub(): THostStub {
  const postMessage = vi.fn() as unknown as TPostMessageSpy;
  const hostWindow = { postMessage } as unknown as Window;

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

  return { hostWindow, postMessage, requests, readyCount, lastRequestID, fromHost, respondOk, respondError };
}

/**
 * A started client handed to the provider. A client passed in stays the caller's to start and
 * stop, so the harness does both, exactly as a shell sharing one with non-React code would.
 */
export function createHarness(): TCreateHarness {
  const host = createHostStub();
  const client = new DashboardClient({ targetWindow: host.hostWindow });
  client.start();
  onTestFinished(() => client.stop());

  const wrapper = ({ children }: { children: ReactNode }) => (
    <DashboardProvider client={client}>{children}</DashboardProvider>
  );

  return { ...host, client, wrapper };
}

export const RUN_RESULT = {
  columns: ["name"],
  rows: [{ name: "device-a" }],
  meta: { row_count: 1, execution_ms: 4, served_from_cache: false },
};
