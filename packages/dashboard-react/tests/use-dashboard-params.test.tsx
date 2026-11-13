import { renderHook, waitFor } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it } from "vite-plus/test";

import { useDashboardParams } from "../src/hooks/use-dashboard-params.js";
import { createHarness } from "./helpers/harness.js";

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
