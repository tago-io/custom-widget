import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { setupClient } from "../helpers/host.js";

const VALID_ID = "6fdbb0f233ea47fa36d331fa";

let ctx: ReturnType<typeof setupClient> | undefined;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  ctx?.client.stop();
  ctx = undefined;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("transport backstop", () => {
  it("rejects with a timeout once the default deadline passes", async () => {
    ctx = setupClient();
    const promise = ctx.client.sql.list();

    // Attach the assertion before advancing, or the rejection lands unhandled.
    const assertion = expect(promise).rejects.toMatchObject({ code: "no_response", op: "sql.list" });
    await vi.advanceTimersByTimeAsync(60_000);
    await assertion;
  });

  it("stays pending right up to the deadline", async () => {
    ctx = setupClient();
    let settled = false;
    const promise = ctx.client.sql.list();
    void promise.catch(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(59_999);
    expect(settled).toBe(false);

    const assertion = expect(promise).rejects.toMatchObject({ code: "no_response" });
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
  });

  it("honors a per-call override", async () => {
    ctx = setupClient();
    const promise = ctx.client.sql.run(VALID_ID, undefined, { timeoutMs: 5_000 });
    const assertion = expect(promise).rejects.toMatchObject({ code: "no_response" });

    await vi.advanceTimersByTimeAsync(5_000);
    await assertion;
  });

  it("honors a per-instance override", async () => {
    ctx = setupClient({ timeoutMs: 1_000 });
    const promise = ctx.client.sql.list();
    const assertion = expect(promise).rejects.toMatchObject({ code: "no_response" });

    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;
  });

  it("disables the backstop entirely at 0", async () => {
    ctx = setupClient({ timeoutMs: 0 });
    let settled = false;
    void ctx.client.sql.list().catch(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(600_000);
    expect(settled).toBe(false);
  });

  it("names the op and tells the author how to raise it", async () => {
    ctx = setupClient({ timeoutMs: 1_000 });
    const promise = ctx.client.sql.list();
    const assertion = expect(promise).rejects.toThrow(/sql\.list.*timeoutMs/s);

    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;
  });
});

describe("timer hygiene", () => {
  it("leaves no timers behind after a successful response", async () => {
    ctx = setupClient();
    const promise = ctx.client.sql.list();
    ctx.respondOk({ queries: [] });
    await promise;

    // The host reply also cancels the ready retries, so nothing at all should remain armed.
    expect(vi.getTimerCount()).toBe(0);
  });

  it("leaves no timers behind after stop()", async () => {
    ctx = setupClient();
    void ctx.client.sql.list().catch(() => undefined);

    ctx.client.stop();
    await Promise.resolve();

    expect(vi.getTimerCount()).toBe(0);
  });

  it("ignores a late answer that arrives after the timeout", async () => {
    ctx = setupClient({ timeoutMs: 1_000 });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const promise = ctx.client.sql.list();
    const id = ctx.lastRequestID();
    const assertion = expect(promise).rejects.toMatchObject({ code: "no_response" });
    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;

    // The query kept running server-side and answered anyway.
    ctx.respondOk({ queries: [{ id: "late", name: "late" }] }, id);
    await Promise.resolve();

    expect(ctx.client.pendingCount).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
