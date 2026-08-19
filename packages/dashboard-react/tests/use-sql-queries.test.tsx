import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { useSqlQueries } from "../src/hooks/use-sql-queries.js";
import { createHarness } from "./helpers/harness.js";

afterEach(() => {
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
