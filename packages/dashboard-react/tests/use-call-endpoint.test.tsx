import { act, cleanup, render, renderHook, waitFor } from "@testing-library/react";
import { Activity, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { type TUseCallEndpointReturn, useCallEndpoint } from "../src/hooks/use-call-endpoint.js";
import { DashboardProvider } from "../src/provider/dashboard-provider.js";
import { createHarness, createHostStub } from "./helpers/harness.js";

const ANALYSIS_ID = "6a1f0c2b9e8d7f6a5b4c3d2e";
const SAVE = { method: "POST" as const, path: "/setpoint", body: { setpoint: "22" } };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useCallEndpoint", () => {
  it("is idle until called", () => {
    const harness = createHarness();
    const { result } = renderHook(() => useCallEndpoint(), { wrapper: harness.wrapper });

    expect(result.current.isCalling).toBe(false);
    expect(result.current.error).toBeNull();
    expect(harness.requests()).toHaveLength(0);
  });

  it("is calling until the answer arrives, then resolves it", async () => {
    const harness = createHarness();
    const { result } = renderHook(() => useCallEndpoint(), { wrapper: harness.wrapper });

    let call!: Promise<unknown>;
    act(() => {
      call = result.current.callEndpoint(ANALYSIS_ID, SAVE);
    });
    expect(result.current.isCalling).toBe(true);
    expect(harness.requests()[0]).toMatchObject({
      op: "endpoint.call",
      payload: { endpoint_id: ANALYSIS_ID, ...SAVE },
    });

    await act(async () => {
      harness.respondOk({ status: 200, headers: {}, body: { ok: true, setpoint: 22 } });
      await call;
    });

    await expect(call).resolves.toEqual({ status: 200, headers: {}, body: { ok: true, setpoint: 22 } });
    expect(result.current.isCalling).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("resolves a 422 answer and leaves error null, since the call completed", async () => {
    const harness = createHarness();
    const { result } = renderHook(() => useCallEndpoint(), { wrapper: harness.wrapper });

    let call!: Promise<unknown>;
    act(() => {
      call = result.current.callEndpoint(ANALYSIS_ID, SAVE);
    });
    await act(async () => {
      harness.respondOk({ status: 422, headers: {}, body: { errors: { setpoint: "Enter a number from 5 to 30." } } });
      await call;
    });

    await expect(call).resolves.toMatchObject({ status: 422 });
    expect(result.current.error).toBeNull();
    expect(result.current.isCalling).toBe(false);
  });

  it("puts a call that did not complete in error and rejects with the same error", async () => {
    const harness = createHarness();
    const { result } = renderHook(() => useCallEndpoint(), { wrapper: harness.wrapper });

    let call!: Promise<unknown>;
    act(() => {
      call = result.current.callEndpoint(ANALYSIS_ID, SAVE);
    });
    const rejection = call.catch((error: unknown) => error);
    await act(async () => {
      harness.respondError("api_error", "The Endpoint call failed");
      await rejection;
    });

    expect(await rejection).toBe(result.current.error);
    expect(result.current.error).toMatchObject({ code: "api_error", op: "endpoint.call" });
    expect(result.current.isCalling).toBe(false);
  });

  it("puts a request refused before posting in error, with nothing sent", async () => {
    const harness = createHarness();
    const { result } = renderHook(() => useCallEndpoint(), { wrapper: harness.wrapper });

    await act(async () => {
      await result.current.callEndpoint("nope").catch(() => undefined);
    });

    expect(result.current.error).toMatchObject({ code: "bad_request" });
    expect(result.current.isCalling).toBe(false);
    expect(harness.requests()).toHaveLength(0);
  });

  it("clears the previous error when a new call starts", async () => {
    const harness = createHarness();
    const { result } = renderHook(() => useCallEndpoint(), { wrapper: harness.wrapper });

    await act(async () => {
      await result.current.callEndpoint("nope").catch(() => undefined);
    });
    expect(result.current.error).not.toBeNull();

    act(() => {
      void result.current.callEndpoint(ANALYSIS_ID, SAVE).catch(() => undefined);
    });
    expect(result.current.error).toBeNull();
    expect(result.current.isCalling).toBe(true);
  });

  it("sends every call, even one identical to a call in flight", () => {
    const harness = createHarness();
    const { result } = renderHook(() => useCallEndpoint(), { wrapper: harness.wrapper });

    act(() => {
      void result.current.callEndpoint(ANALYSIS_ID, SAVE).catch(() => undefined);
      void result.current.callEndpoint(ANALYSIS_ID, SAVE).catch(() => undefined);
    });

    expect(harness.requests()).toHaveLength(2);
  });
});

describe("following the latest call", () => {
  it("stays calling while the latest call waits, even when an earlier one answers", async () => {
    const harness = createHarness();
    const { result } = renderHook(() => useCallEndpoint(), { wrapper: harness.wrapper });

    let first!: Promise<unknown>;
    act(() => {
      first = result.current.callEndpoint(ANALYSIS_ID, SAVE);
      void result.current.callEndpoint(ANALYSIS_ID, SAVE).catch(() => undefined);
    });
    const [firstRequest] = harness.requests();

    await act(async () => {
      harness.respondOk({ status: 200, headers: {}, body: "" }, firstRequest.id as string);
      await first;
    });

    expect(result.current.isCalling).toBe(true);
  });

  it("keeps an earlier call's failure out of error once a later call succeeded", async () => {
    const harness = createHarness();
    const { result } = renderHook(() => useCallEndpoint(), { wrapper: harness.wrapper });

    let first!: Promise<unknown>;
    let second!: Promise<unknown>;
    act(() => {
      first = result.current.callEndpoint(ANALYSIS_ID, SAVE);
      second = result.current.callEndpoint(ANALYSIS_ID, SAVE);
    });
    const [firstRequest, secondRequest] = harness.requests();

    await act(async () => {
      harness.respondOk({ status: 200, headers: {}, body: "" }, secondRequest.id as string);
      await second;
    });
    const firstRejection = first.catch((error: unknown) => error);
    await act(async () => {
      harness.respondError("api_error", "late failure", firstRequest.id as string);
      await firstRejection;
    });

    // The earlier call still rejects for whoever awaits it.
    expect(await firstRejection).toMatchObject({ code: "api_error" });
    expect(result.current.error).toBeNull();
    expect(result.current.isCalling).toBe(false);
  });

  it("reset() returns to idle and detaches the call in flight", async () => {
    const harness = createHarness();
    const { result } = renderHook(() => useCallEndpoint(), { wrapper: harness.wrapper });

    let call!: Promise<unknown>;
    act(() => {
      call = result.current.callEndpoint(ANALYSIS_ID, SAVE);
    });
    act(() => {
      result.current.reset();
    });
    expect(result.current.isCalling).toBe(false);

    const rejection = call.catch((error: unknown) => error);
    await act(async () => {
      harness.respondError("api_error", "after reset");
      await rejection;
    });

    expect(await rejection).toMatchObject({ code: "api_error" });
    expect(result.current.error).toBeNull();
    expect(result.current.isCalling).toBe(false);
  });
});

describe("StrictMode", () => {
  it("sends one request per call and clears isCalling when it answers", async () => {
    const host = createHostStub();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <DashboardProvider targetWindow={host.hostWindow}>{children}</DashboardProvider>
    );
    // reactStrictMode, not a <StrictMode> in the wrapper: React 19 replays effects only when StrictMode sits at or
    // above the topmost newly mounted fiber. The provider's client goes through start, stop, start here.
    const { result } = renderHook(() => useCallEndpoint(), { wrapper, reactStrictMode: true });

    let call!: Promise<unknown>;
    act(() => {
      call = result.current.callEndpoint(ANALYSIS_ID, SAVE);
    });
    expect(host.requests()).toHaveLength(1);

    await act(async () => {
      host.respondOk({ status: 200, headers: {}, body: { ok: true } });
      await call;
    });

    await expect(call).resolves.toMatchObject({ status: 200 });
    expect(result.current.isCalling).toBe(false);
    expect(host.requests()).toHaveLength(1);
  });
});

describe("a hidden Activity", () => {
  function captureHook(): { latest: () => TUseCallEndpointReturn; Probe: () => null } {
    let latest: TUseCallEndpointReturn | null = null;
    function Probe() {
      latest = useCallEndpoint();
      return null;
    }
    return {
      latest: () => {
        if (!latest) {
          throw new Error("The probe has not rendered.");
        }
        return latest;
      },
      Probe,
    };
  }

  it("clears isCalling for an answer that lands while the caller is hidden", async () => {
    const harness = createHarness();
    const { latest, Probe } = captureHook();
    // The provider sits outside, so its client keeps running while the caller is hidden.
    function App({ mode }: { mode: "visible" | "hidden" }) {
      return (
        <DashboardProvider client={harness.client}>
          <Activity mode={mode}>
            <Probe />
          </Activity>
        </DashboardProvider>
      );
    }

    const { rerender } = render(<App mode="visible" />);
    let call!: Promise<unknown>;
    act(() => {
      call = latest().callEndpoint(ANALYSIS_ID, SAVE);
    });

    rerender(<App mode="hidden" />);
    await act(async () => {
      harness.respondOk({ status: 200, headers: {}, body: { ok: true } });
      await call;
    });
    rerender(<App mode="visible" />);

    await waitFor(() => expect(latest().isCalling).toBe(false));
    expect(latest().error).toBeNull();
    await expect(call).resolves.toMatchObject({ status: 200 });
    expect(harness.requests()).toHaveLength(1);
  });

  it("reports a call cut off by hiding the provider as aborted and never sends it again", async () => {
    const host = createHostStub();
    const { latest, Probe } = captureHook();
    // The provider sits inside, so hiding it stops the client and fails the call in flight.
    function App({ mode }: { mode: "visible" | "hidden" }) {
      return (
        <Activity mode={mode}>
          <DashboardProvider targetWindow={host.hostWindow}>
            <Probe />
          </DashboardProvider>
        </Activity>
      );
    }

    const { rerender } = render(<App mode="visible" />);
    let call!: Promise<unknown>;
    act(() => {
      call = latest().callEndpoint(ANALYSIS_ID, SAVE);
    });
    const rejection = call.catch((error: unknown) => error);

    rerender(<App mode="hidden" />);
    await act(async () => {
      await rejection;
    });
    rerender(<App mode="visible" />);

    expect(await rejection).toMatchObject({ code: "aborted", op: "endpoint.call" });
    await waitFor(() => expect(latest().isCalling).toBe(false));
    expect(latest().error).toMatchObject({ code: "aborted" });
    expect(host.requests()).toHaveLength(1);
  });
});
