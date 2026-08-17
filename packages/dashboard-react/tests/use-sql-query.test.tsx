import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { useSqlQuery } from "../src/hooks/use-sql-query.js";
import { createHarness, RUN_RESULT } from "./helpers/harness.js";

const VALID_ID = "6fdbb0f233ea47fa36d331fa";
const OTHER_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useSqlQuery", () => {
  it("loads, then exposes the result", async () => {
    const harness = createHarness();
    const { result } = renderHook(() => useSqlQuery(VALID_ID), { wrapper: harness.wrapper });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(harness.requests()).toHaveLength(1));
    harness.respondOk(RUN_RESULT);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual(RUN_RESULT);
    expect(result.current.error).toBeNull();
  });

  it("puts params on the wire exactly as given", async () => {
    const harness = createHarness();
    const params = [{ key: "$1", value: "30" }];
    renderHook(() => useSqlQuery(VALID_ID, params), { wrapper: harness.wrapper });

    await waitFor(() => expect(harness.requests()).toHaveLength(1));
    expect(harness.requests()[0].payload).toEqual({ query_id: VALID_ID, params });
  });

  it("does not refire when the params array is a fresh literal each render", async () => {
    const harness = createHarness();
    const { rerender } = renderHook(() => useSqlQuery(VALID_ID, [{ key: "$1", value: "30" }]), {
      wrapper: harness.wrapper,
    });

    await waitFor(() => expect(harness.requests()).toHaveLength(1));
    harness.respondOk(RUN_RESULT);
    await waitFor(() => expect(harness.requests()).toHaveLength(1));

    rerender();
    rerender();
    rerender();

    expect(harness.requests()).toHaveLength(1);
  });

  it("refires when a param value actually changes", async () => {
    const harness = createHarness();
    const { rerender } = renderHook(({ value }: { value: string }) => useSqlQuery(VALID_ID, [{ key: "$1", value }]), {
      wrapper: harness.wrapper,
      initialProps: { value: "30" },
    });

    await waitFor(() => expect(harness.requests()).toHaveLength(1));
    harness.respondOk(RUN_RESULT);

    rerender({ value: "60" });
    await waitFor(() => expect(harness.requests()).toHaveLength(2));
  });

  it("stays idle for a null query id", async () => {
    const harness = createHarness();
    const { result } = renderHook(() => useSqlQuery(null), { wrapper: harness.wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(harness.requests()).toHaveLength(0);
    expect(result.current.data).toBeNull();
  });

  it("surfaces the host error with its code", async () => {
    const harness = createHarness();
    const { result } = renderHook(() => useSqlQuery(VALID_ID), { wrapper: harness.wrapper });

    await waitFor(() => expect(harness.requests()).toHaveLength(1));
    harness.respondError("not_found", "SQL query can't be found");

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toMatchObject({ code: "not_found", message: "SQL query can't be found" });
    expect(result.current.isLoading).toBe(false);
  });

  it("keeps the previous data through a refetch, so the table does not blink", async () => {
    const harness = createHarness();
    const { result } = renderHook(() => useSqlQuery(VALID_ID), { wrapper: harness.wrapper });

    await waitFor(() => expect(harness.requests()).toHaveLength(1));
    harness.respondOk(RUN_RESULT);
    await waitFor(() => expect(result.current.data).not.toBeNull());

    void result.current.refetch();
    await waitFor(() => expect(result.current.isLoading).toBe(true));
    expect(result.current.data).toEqual(RUN_RESULT);
  });

  it("refetch never throws, even when the query fails", async () => {
    const harness = createHarness();
    const { result } = renderHook(() => useSqlQuery(VALID_ID), { wrapper: harness.wrapper });

    await waitFor(() => expect(harness.requests()).toHaveLength(1));
    harness.respondError("api_error", "boom");
    await waitFor(() => expect(result.current.error).not.toBeNull());

    const retry = result.current.refetch();
    await waitFor(() => expect(harness.requests()).toHaveLength(2));
    harness.respondError("api_error", "boom again");

    await expect(retry).resolves.toBeUndefined();
    await waitFor(() => expect(result.current.error).toMatchObject({ message: "boom again" }));
  });

  it("discards a superseded response instead of overwriting a newer one", async () => {
    const harness = createHarness();
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useSqlQuery(VALID_ID, [{ key: "$1", value }]),
      { wrapper: harness.wrapper, initialProps: { value: "30" } }
    );

    await waitFor(() => expect(harness.requests()).toHaveLength(1));
    const firstID = harness.requests()[0].id as string;

    rerender({ value: "60" });
    await waitFor(() => expect(harness.requests()).toHaveLength(2));

    // The newer run answers first, then the stale one arrives late.
    harness.respondOk({ ...RUN_RESULT, rows: [{ name: "newer" }] });
    await waitFor(() => expect(result.current.data?.rows).toEqual([{ name: "newer" }]));

    harness.respondOk({ ...RUN_RESULT, rows: [{ name: "stale" }] }, firstID);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data?.rows).toEqual([{ name: "newer" }]);
  });

  it("unmounting mid-flight produces no unhandled rejection and no console noise", async () => {
    const harness = createHarness();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { unmount } = renderHook(() => useSqlQuery(VALID_ID), { wrapper: harness.wrapper });

    await waitFor(() => expect(harness.requests()).toHaveLength(1));
    unmount();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe("query identity changes", () => {
  it("drops the previous query's rows instead of showing them under the new id", async () => {
    const harness = createHarness();
    const { result, rerender } = renderHook(({ id }: { id: string }) => useSqlQuery(id), {
      wrapper: harness.wrapper,
      initialProps: { id: VALID_ID },
    });

    await waitFor(() => expect(harness.requests()).toHaveLength(1));
    harness.respondOk({ columns: ["name"], rows: [{ name: "belongs-to-the-first-query" }], meta: {} });
    await waitFor(() => expect(result.current.data).not.toBeNull());

    rerender({ id: OTHER_ID });
    // The switch itself clears it, before any answer arrives.
    expect(result.current.data).toBeNull();

    await waitFor(() => expect(harness.requests()).toHaveLength(2));
    harness.respondError("forbidden", "not yours");
    await waitFor(() => expect(result.current.error).not.toBeNull());

    // And a failure on the new query must not resurrect the old rows.
    expect(result.current.data).toBeNull();
  });

  it("still keeps data across a refetch of the same query", async () => {
    const harness = createHarness();
    const { result } = renderHook(() => useSqlQuery(VALID_ID), { wrapper: harness.wrapper });

    await waitFor(() => expect(harness.requests()).toHaveLength(1));
    harness.respondOk({ columns: ["name"], rows: [{ name: "kept" }], meta: {} });
    await waitFor(() => expect(result.current.data).not.toBeNull());

    await act(async () => {
      void result.current.refetch();
    });
    // Mid-refetch the table must not blink, which is the whole point of retaining it.
    expect(result.current.data?.rows).toEqual([{ name: "kept" }]);

    await waitFor(() => expect(harness.requests()).toHaveLength(2));
    harness.respondOk({ columns: ["name"], rows: [{ name: "refreshed" }], meta: {} });
    await waitFor(() => expect(result.current.data?.rows).toEqual([{ name: "refreshed" }]));
  });
});
