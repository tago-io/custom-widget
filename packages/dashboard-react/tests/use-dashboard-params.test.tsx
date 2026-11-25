import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { useDashboardParams } from "../src/hooks/use-dashboard-params.js";
import { createHarness } from "./helpers/harness.js";

// Globals are off, so Testing Library cannot register its own cleanup; a leaked provider would keep
// a live client listening to every later test's messages.
afterEach(() => {
  cleanup();
});

function useParamsWithRenderCount() {
  const params = useDashboardParams();
  const renders = useRef(0);
  renders.current += 1;
  return { params, renders: renders.current };
}

describe("useDashboardParams", () => {
  it("starts empty and fills in once the host forwards the querystring", async () => {
    const harness = createHarness();
    const { result } = renderHook(() => useDashboardParams(), { wrapper: harness.wrapper });

    expect(result.current).toEqual({});
    harness.fromHost({ type: "dashboard:params", params: { device: "abc123" } });
    await waitFor(() => expect(result.current).toEqual({ device: "abc123" }));
  });

  it("follows a live change and a clear to empty", async () => {
    const harness = createHarness();
    const { result } = renderHook(() => useDashboardParams(), { wrapper: harness.wrapper });

    harness.fromHost({ type: "dashboard:params", params: { device: "abc123" } });
    await waitFor(() => expect(result.current).toEqual({ device: "abc123" }));

    harness.fromHost({ type: "dashboard:params", params: { device: "zzz999" } });
    await waitFor(() => expect(result.current).toEqual({ device: "zzz999" }));

    harness.fromHost({ type: "dashboard:params", params: {} });
    await waitFor(() => expect(result.current).toEqual({}));
  });

  it("does not re-render when the host repeats the same map", async () => {
    const harness = createHarness();
    const { result } = renderHook(() => useParamsWithRenderCount(), { wrapper: harness.wrapper });

    harness.fromHost({ type: "dashboard:params", params: { device: "abc123" } });
    await waitFor(() => expect(result.current.params).toEqual({ device: "abc123" }));
    const afterChange = result.current.renders;

    harness.fromHost({ type: "dashboard:params", params: { device: "abc123" } });
    harness.fromHost({ type: "dashboard:theme", theme: "dark" });
    await Promise.resolve();

    expect(result.current.renders).toBe(afterChange);
  });
});
