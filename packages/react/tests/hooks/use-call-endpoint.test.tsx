import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { useCallEndpoint } from "../../src/hooks/use-call-endpoint.js";
import { TagoIOProvider } from "../../src/provider/tago-io-provider.js";

const endpointID = "65f1c0a2b3d4e5f6a7b8c9d0";
const failure = { code: "api_error", message: "The Endpoint call failed" };

let postMessageSpy: ReturnType<typeof vi.spyOn>;

function wrapper({ children }: { children: ReactNode }) {
  return <TagoIOProvider>{children}</TagoIOProvider>;
}

function dispatch(data: Record<string, unknown>) {
  window.dispatchEvent(new MessageEvent("message", { data }));
}

/** Keys of the call-endpoint messages posted so far, oldest first. */
function callKeys(): string[] {
  return (postMessageSpy.mock.calls as unknown[][])
    .map((call) => call[0] as Record<string, unknown>)
    .filter((message) => message.method === "call-endpoint")
    .map((message) => String(message.key));
}

function answer(key: string, status: number, body: unknown = null) {
  dispatch({ status: true, key, method: "call-endpoint", result: { status, headers: {}, body } });
}

function fail(key: string) {
  dispatch({ status: false, key, method: "call-endpoint", ...failure });
}

function renderReady() {
  // StrictMode at the root, as an app renders it. A StrictMode element inside the wrapper does not replay
  // the effects of a tree mounted under a new parent, so the hook would never see the remount.
  const rendered = renderHook(() => useCallEndpoint(), { wrapper, reactStrictMode: true });
  act(() => {
    dispatch({ widget: { id: "w1", dashboard: "d1", display: { variables: [] } }, capabilities: ["call-endpoint"] });
  });
  return rendered;
}

describe("useCallEndpoint under StrictMode", () => {
  beforeEach(() => {
    postMessageSpy = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("sets isCalling while waiting and clears it on the answer", async () => {
    const { result } = renderReady();

    let promise!: Promise<unknown>;
    act(() => {
      promise = result.current.callEndpoint(endpointID);
    });
    expect(result.current.isCalling).toBe(true);

    await act(async () => {
      answer(callKeys()[0], 200, { ok: true });
      await promise;
    });
    expect(result.current.isCalling).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("resolves an HTTP 422 without setting error", async () => {
    const { result } = renderReady();

    let answered: unknown;
    await act(async () => {
      const promise = result.current.callEndpoint(endpointID, {
        method: "POST",
        path: "/setpoint",
        body: { setpoint: 50 },
      });
      answer(callKeys()[0], 422, { errors: { setpoint: "Enter a number from 5 to 30." } });
      answered = await promise;
    });

    expect(answered).toMatchObject({ status: 422 });
    expect(result.current.error).toBeNull();
    expect(result.current.isCalling).toBe(false);
  });

  it("stores the rejection in error and rethrows it", async () => {
    const { result } = renderReady();

    let rejection: unknown;
    await act(async () => {
      const promise = result.current.callEndpoint(endpointID);
      fail(callKeys()[0]);
      rejection = await promise.catch((error: unknown) => error);
    });

    expect(rejection).toEqual(failure);
    expect(result.current.error).toEqual(failure);
    expect(result.current.isCalling).toBe(false);
  });

  it("follows only the latest of two overlapping calls", async () => {
    const { result } = renderReady();

    let firstOutcome!: Promise<unknown>;
    let second!: Promise<unknown>;
    act(() => {
      firstOutcome = result.current.callEndpoint(endpointID, { path: "/first" }).catch((error: unknown) => error);
      second = result.current.callEndpoint(endpointID, { path: "/second" });
    });
    const [firstKey, secondKey] = callKeys();

    await act(async () => {
      answer(secondKey, 200);
      await second;
    });
    expect(result.current.isCalling).toBe(false);

    await act(async () => {
      fail(firstKey);
      await firstOutcome;
    });
    await expect(firstOutcome).resolves.toEqual(failure);
    expect(result.current.error).toBeNull();
    expect(result.current.isCalling).toBe(false);
  });

  it("reset returns to idle and a call in flight no longer changes state", async () => {
    const { result } = renderReady();

    let outcome!: Promise<unknown>;
    act(() => {
      outcome = result.current.callEndpoint(endpointID).catch((error: unknown) => error);
    });
    expect(result.current.isCalling).toBe(true);

    act(() => {
      result.current.reset();
    });
    expect(result.current.isCalling).toBe(false);

    await act(async () => {
      fail(callKeys()[0]);
      await outcome;
    });
    await expect(outcome).resolves.toEqual(failure);
    expect(result.current.error).toBeNull();
    expect(result.current.isCalling).toBe(false);
  });
});
