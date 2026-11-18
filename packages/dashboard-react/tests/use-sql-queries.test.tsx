import { act, cleanup, render, renderHook, waitFor } from "@testing-library/react";
import { Activity, useLayoutEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { useSqlQueries } from "../src/hooks/use-sql-queries.js";
import { DashboardProvider } from "../src/provider/dashboard-provider.js";
import { createHarness, createHostStub } from "./helpers/harness.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useSqlQueries", () => {
  it("lists the saved queries", async () => {
    const harness = createHarness();
    const { result } = renderHook(() => useSqlQueries(), { wrapper: harness.wrapper });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(harness.requests()).toHaveLength(1));
    expect(harness.requests()[0].op).toBe("sql.list");

    harness.respondOk({ queries: [{ id: "a", name: "Devices" }] });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.queries).toEqual([{ id: "a", name: "Devices" }]);
  });

  it("surfaces a failure with its code", async () => {
    const harness = createHarness();
    const { result } = renderHook(() => useSqlQueries(), { wrapper: harness.wrapper });

    await waitFor(() => expect(harness.requests()).toHaveLength(1));
    harness.respondError("forbidden", "not yours");

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toMatchObject({ code: "forbidden", message: "not yours" });
  });

  it("refetches on demand", async () => {
    const harness = createHarness();
    const { result } = renderHook(() => useSqlQueries(), { wrapper: harness.wrapper });

    await waitFor(() => expect(harness.requests()).toHaveLength(1));
    harness.respondOk({ queries: [] });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    void result.current.refetch();
    await waitFor(() => expect(harness.requests()).toHaveLength(2));
    harness.respondOk({ queries: [{ id: "b", name: "b" }] });

    await waitFor(() => expect(result.current.queries).toEqual([{ id: "b", name: "b" }]));
  });
});

describe("a hidden Activity", () => {
  it("does not show the aborted error of the run it stopped when it is revealed", async () => {
    const host = createHostStub();
    const commits: string[] = [];
    function Probe() {
      const list = useSqlQueries();
      useLayoutEffect(() => {
        commits.push(`loading=${list.isLoading} error=${list.error?.code ?? "none"}`);
      });
      return null;
    }
    // The provider sits inside the Activity, so hiding it stops the client and fails the run.
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
    await waitFor(() => expect(host.requests()).toHaveLength(1));

    rerender(<App mode="hidden" />);
    await act(async () => {});
    rerender(<App mode="visible" />);
    await waitFor(() => expect(host.requests()).toHaveLength(2));
    host.respondOk({ queries: [{ id: "a", name: "a" }] });

    await waitFor(() => expect(commits.at(-1)).toBe("loading=false error=none"));
    expect(commits.filter((commit) => commit.includes("aborted"))).toEqual([]);
  });
});
