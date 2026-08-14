import { renderHook, waitFor } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { useSqlQuery } from "../src/hooks/use-sql-query.js";
import { useDashboardStyle, useTheme } from "../src/hooks/use-theme.js";
import { createHarness, RUN_RESULT } from "./helpers/harness.js";

const VALID_ID = "6fdbb0f233ea47fa36d331fa";

afterEach(() => {
  vi.restoreAllMocks();
});

function useThemeWithRenderCount() {
  const theme = useTheme();
  const renders = useRef(0);
  renders.current += 1;
  return { theme, renders: renders.current };
}

describe("useTheme", () => {
  it("starts from the URL before any message arrives", () => {
    const harness = createHarness();
    const { result } = renderHook(() => useTheme(), { wrapper: harness.wrapper });
    expect(result.current).toBe("light");
  });

  it("re-renders once per real change", async () => {
    const harness = createHarness();
    const { result } = renderHook(() => useThemeWithRenderCount(), { wrapper: harness.wrapper });
    const initial = result.current.renders;

    harness.fromHost({ type: "dashboard:theme", theme: "dark" });
    await waitFor(() => expect(result.current.theme).toBe("dark"));

    expect(result.current.renders).toBe(initial + 1);
  });

  it("does not re-render when the host repeats the same theme", async () => {
    const harness = createHarness();
    const { result } = renderHook(() => useThemeWithRenderCount(), { wrapper: harness.wrapper });

    harness.fromHost({ type: "dashboard:theme", theme: "dark" });
    await waitFor(() => expect(result.current.theme).toBe("dark"));
    const afterChange = result.current.renders;

    // The host re-sends on any <html> class mutation — a modal, an rtl toggle, anything.
    for (let index = 0; index < 5; index += 1) {
      harness.fromHost({ type: "dashboard:theme", theme: "dark" });
    }

    expect(result.current.renders).toBe(afterChange);
  });

  it("does not re-render a data-only consumer", async () => {
    const harness = createHarness();
    let renders = 0;
    const { result } = renderHook(
      () => {
        renders += 1;
        return useSqlQuery(VALID_ID);
      },
      { wrapper: harness.wrapper }
    );

    await waitFor(() => expect(harness.requests()).toHaveLength(1));
    harness.respondOk(RUN_RESULT);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const before = renders;
    harness.fromHost({ type: "dashboard:theme", theme: "dark" });
    await Promise.resolve();

    expect(renders).toBe(before);
  });
});

describe("useDashboardStyle", () => {
  it("exposes the host style", async () => {
    const harness = createHarness();
    const { result } = renderHook(() => useDashboardStyle(), { wrapper: harness.wrapper });

    expect(result.current).toEqual({});
    harness.fromHost({ type: "dashboard:style", style: { paddingBottom: 96 } });
    await waitFor(() => expect(result.current).toEqual({ paddingBottom: 96 }));
  });
});
