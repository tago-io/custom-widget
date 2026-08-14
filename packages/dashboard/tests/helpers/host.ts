import { vi } from "vite-plus/test";

import { DashboardClient } from "../../src/client/dashboard-client.js";
import type { TDashboardClientOptions } from "../../src/types/index.js";

export const HOST_ORIGIN = "https://admin.tago.io";

/**
 * Only the slice of the spy these tests use. Annotated explicitly because inferring it would
 * name a vitest internal path that this package does not depend on.
 */
type TPostMessageSpy = {
  (message: unknown, targetOrigin?: string): void;
  mock: { calls: [unknown, string?][] };
  mockImplementation: (implementation: (message: unknown, targetOrigin?: string) => void) => TPostMessageSpy;
};

type THostWindow = { hostWindow: Window; postMessage: TPostMessageSpy };

/**
 * In jsdom `window.parent === window`, so a client left on its default target believes it has
 * no host and fails every call fast. Tests therefore inject a stand-in host window, which is
 * exactly the seam the SDK exposes for dev harnesses.
 */
export function createHostWindow(): THostWindow {
  const postMessage = vi.fn() as unknown as TPostMessageSpy;
  return { hostWindow: { postMessage } as unknown as Window, postMessage };
}

/**
 * Constructed MessageEvents default to `source: null` and `origin: ""`, which silently defeats
 * any assertion that depends on either. Always go through this helper.
 */
export function dispatch(data: unknown, options: { origin?: string; source?: Window | null } = {}): void {
  window.dispatchEvent(
    new MessageEvent("message", {
      data,
      origin: options.origin ?? HOST_ORIGIN,
      source: options.source === undefined ? window : options.source,
    })
  );
}

type TSetupClient = {
  client: DashboardClient;
  hostWindow: Window;
  postMessage: TPostMessageSpy;
  sentMessages: () => Record<string, unknown>[];
  requests: () => Record<string, unknown>[];
  lastRequestID: () => string | undefined;
  fromHost: (data: unknown, origin?: string) => void;
  respondOk: (result: unknown, id?: string) => void;
  respondError: (code: string, message: string, id?: string) => void;
};

export function setupClient(options: TDashboardClientOptions = {}): TSetupClient {
  const { hostWindow, postMessage } = createHostWindow();
  const client = new DashboardClient({ targetWindow: hostWindow, ...options });
  client.start();

  const sentMessages = () => postMessage.mock.calls.map((call) => call[0] as Record<string, unknown>);
  const requests = () => sentMessages().filter((message) => message.type === "dashboard:request");
  const lastRequestID = () => {
    const all = requests();
    return all.length > 0 ? (all[all.length - 1].id as string) : undefined;
  };

  const fromHost = (data: unknown, origin?: string) => dispatch(data, { origin, source: hostWindow });

  const respondOk = (result: unknown, id = lastRequestID()) => {
    fromHost({ type: "dashboard:response", id, ok: true, result });
  };
  const respondError = (code: string, message: string, id = lastRequestID()) => {
    fromHost({ type: "dashboard:response", id, ok: false, error: { code, message } });
  };

  return { client, hostWindow, postMessage, sentMessages, requests, lastRequestID, fromHost, respondOk, respondError };
}
