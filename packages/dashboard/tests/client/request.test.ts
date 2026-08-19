import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { setupClient } from "../helpers/host.js";

const VALID_ID = "6fdbb0f233ea47fa36d331fa";

let ctx: ReturnType<typeof setupClient> | undefined;

afterEach(() => {
  ctx?.client.stop();
  ctx = undefined;
  vi.restoreAllMocks();
});

describe("sql.list", () => {
  it("posts the bare envelope with no payload key", async () => {
    ctx = setupClient();
    const promise = ctx.client.sql.list();

    const request = ctx.requests()[0];
    expect(request.type).toBe("dashboard:request");
    expect(request.op).toBe("sql.list");
    expect(request).not.toHaveProperty("payload");
    expect(typeof request.id).toBe("string");
    expect((request.id as string).length).toBeGreaterThan(0);

    ctx.respondOk({ queries: [{ id: "abc", name: "Devices" }] });
    await expect(promise).resolves.toEqual([{ id: "abc", name: "Devices" }]);
  });

  it("never generates an empty id, which the host would drop without answering", async () => {
    ctx = setupClient();
    const ids = new Set<string>();

    for (let index = 0; index < 100; index += 1) {
      void ctx.client.sql.list({ timeoutMs: index + 1 }).catch(() => undefined);
      const id = ctx.lastRequestID();
      expect(id).toBeTruthy();
      ids.add(id as string);
    }

    expect(ids.size).toBe(100);
  });
});

describe("sql.run", () => {
  it("puts params on the wire exactly as given", async () => {
    ctx = setupClient();
    const params = [
      { key: "$2", value: "b" },
      { key: "$1", value: "a" },
    ];
    const promise = ctx.client.sql.run(VALID_ID, params);

    expect(ctx.requests()[0].payload).toEqual({ query_id: VALID_ID, params });
    // Same array, same order — the coalescing key sorts, the payload never does.
    expect((ctx.requests()[0].payload as { params: unknown[] }).params).toEqual(params);

    ctx.respondOk({ columns: [], rows: [], meta: {} });
    await promise;
  });

  it("omits the params key entirely when there are none", async () => {
    ctx = setupClient();
    const promise = ctx.client.sql.run(VALID_ID);

    expect(ctx.requests()[0].payload).toEqual({ query_id: VALID_ID });
    expect(ctx.requests()[0].payload).not.toHaveProperty("params");

    ctx.respondOk({ columns: [], rows: [], meta: {} });
    await promise;
  });

  it("refuses an invalid query id locally, without a round trip", async () => {
    ctx = setupClient();
    await expect(ctx.client.sql.run("nope")).rejects.toMatchObject({ code: "bad_request", op: "sql.run" });
    expect(ctx.requests()).toHaveLength(0);
  });
});

describe("responses", () => {
  it.each([
    "not_found",
    "forbidden",
    "bad_params",
    "plan_limit",
    "timeout",
    "rate_limited",
    "api_error",
    "unknown_op",
    "bad_request",
  ])("surfaces the %s code with the host message verbatim", async (code) => {
    ctx = setupClient();
    const promise = ctx.client.sql.list();
    ctx.respondError(code, `raw message for ${code}`);

    await expect(promise).rejects.toMatchObject({
      name: "TagoDashboardError",
      code,
      message: `raw message for ${code}`,
      op: "sql.list",
    });
  });

  it("forwards a host code it has never heard of instead of flattening it", async () => {
    ctx = setupClient();
    const promise = ctx.client.sql.list();
    ctx.respondError("some_future_code", "from a newer host");

    await expect(promise).rejects.toMatchObject({ code: "some_future_code", message: "from a newer host" });
  });

  it("ignores an unknown id in silence and leaves the request pending", async () => {
    ctx = setupClient();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    let settled = false;
    void ctx.client.sql.list().then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      }
    );

    ctx.respondOk({ queries: [] }, "some-other-clients-id");
    await Promise.resolve();

    expect(settled).toBe(false);
    expect(ctx.client.pendingCount).toBe(1);
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("settles once when the host answers twice", async () => {
    ctx = setupClient();
    const promise = ctx.client.sql.list();
    const id = ctx.lastRequestID();

    ctx.respondOk({ queries: [{ id: "first", name: "first" }] }, id);
    ctx.respondOk({ queries: [{ id: "second", name: "second" }] }, id);

    await expect(promise).resolves.toEqual([{ id: "first", name: "first" }]);
    expect(ctx.client.pendingCount).toBe(0);
  });

  it("rejects rather than resolving undefined on a forged ok", async () => {
    ctx = setupClient();
    const promise = ctx.client.sql.list();
    ctx.fromHost({ type: "dashboard:response", id: ctx.lastRequestID(), ok: true });

    await expect(promise).rejects.toMatchObject({ code: "api_error" });
  });
});

describe("in-flight coalescing", () => {
  it("shares one request between identical concurrent calls", async () => {
    ctx = setupClient();
    const first = ctx.client.sql.list();
    const second = ctx.client.sql.list();

    expect(ctx.requests()).toHaveLength(1);

    ctx.respondOk({ queries: [{ id: "a", name: "a" }] });
    expect(await first).toEqual(await second);
  });

  it("coalesces sql.run across different param orderings", async () => {
    ctx = setupClient();
    const first = ctx.client.sql.run(VALID_ID, [
      { key: "$1", value: "a" },
      { key: "$2", value: "b" },
    ]);
    const second = ctx.client.sql.run(VALID_ID, [
      { key: "$2", value: "b" },
      { key: "$1", value: "a" },
    ]);

    expect(ctx.requests()).toHaveLength(1);
    ctx.respondOk({ columns: [], rows: [], meta: {} });
    await Promise.all([first, second]);
  });

  it("does not coalesce different values", () => {
    ctx = setupClient();
    void ctx.client.sql.run(VALID_ID, [{ key: "$1", value: "a" }]).catch(() => undefined);
    void ctx.client.sql.run(VALID_ID, [{ key: "$1", value: "b" }]).catch(() => undefined);

    expect(ctx.requests()).toHaveLength(2);
  });

  it("releases the key once settled so a later call is a fresh request", async () => {
    ctx = setupClient();
    const first = ctx.client.sql.list();
    ctx.respondOk({ queries: [] });
    await first;

    const second = ctx.client.sql.list();
    expect(ctx.requests()).toHaveLength(2);
    ctx.respondOk({ queries: [] });
    await second;
  });

  it("releases a settled key while an unrelated request is still in flight", async () => {
    ctx = setupClient();
    const list = ctx.client.sql.list();
    void ctx.client.sql.run(VALID_ID).catch(() => undefined);
    expect(ctx.requests()).toHaveLength(2);

    // Answer only sql.list. The still-pending sql.run must not keep sql.list's key parked:
    // a guard that asks "is anything pending" instead of "is this entry mine" would.
    ctx.respondOk({ queries: [] }, ctx.requests()[0].id as string);
    await expect(list).resolves.toEqual([]);

    const again = ctx.client.sql.list();
    expect(ctx.requests()).toHaveLength(3);
    ctx.respondOk({ queries: [] }, ctx.requests()[2].id as string);
    await expect(again).resolves.toEqual([]);
  });

  it("keeps the live key when a run stopped in the same tick settles afterwards", async () => {
    ctx = setupClient();
    void ctx.client.sql.list().catch(() => undefined);
    expect(ctx.requests()).toHaveLength(1);

    // stop() rejects the pending entry, so that run's release is now a queued microtask.
    ctx.client.stop();
    // Same tick, which is what StrictMode does: restart and re-issue under the same key.
    ctx.client.start();
    void ctx.client.sql.list().catch(() => undefined);
    expect(ctx.requests()).toHaveLength(2);

    // Let the stopped run release. Retracting unconditionally would drop the live entry here.
    await Promise.resolve();
    await Promise.resolve();

    void ctx.client.sql.list().catch(() => undefined);
    expect(ctx.requests()).toHaveLength(2);

    // Not enough to stop above: a key that was never released also posts no third request.
    // Settle the survivor, and the key must then be free for a genuinely new request.
    ctx.respondOk({ queries: [] }, ctx.lastRequestID());
    await Promise.resolve();
    await Promise.resolve();

    const fresh = ctx.client.sql.list();
    expect(ctx.requests()).toHaveLength(3);
    ctx.respondOk({ queries: [] });
    await expect(fresh).resolves.toEqual([]);
  });
});
