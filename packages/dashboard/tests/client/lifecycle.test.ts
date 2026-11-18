import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { DashboardClient } from "../../src/client/dashboard-client.js";
import { createHostWindow, dispatch, setupClient } from "../helpers/host.js";

let ctx: ReturnType<typeof setupClient> | undefined;

afterEach(() => {
  ctx?.client.stop();
  ctx = undefined;
  vi.restoreAllMocks();
});

describe("start", () => {
  it("announces the shell once", () => {
    ctx = setupClient();
    const ready = ctx.sentMessages().filter((message) => message.type === "dashboard:ready");
    expect(ready).toHaveLength(1);
  });

  it("is idempotent", () => {
    ctx = setupClient();
    ctx.client.start();
    ctx.client.start();

    expect(ctx.sentMessages().filter((message) => message.type === "dashboard:ready")).toHaveLength(1);
  });

  it("attaches the listener before announcing, so the first reply cannot be missed", () => {
    const { hostWindow, postMessage } = createHostWindow();
    const client = new DashboardClient({ targetWindow: hostWindow });

    postMessage.mockImplementation(() => {
      // The host answers synchronously here; a listener attached after the post would miss it.
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "dashboard:theme", theme: "dark" },
          origin: "https://admin.tago.io",
          source: hostWindow,
        })
      );
    });

    client.start();
    expect(client.theme.get()).toBe("dark");
    client.stop();
  });
});

describe("before the first start", () => {
  it("still sends a call, because a provider starts the client after its children's effects", async () => {
    const { hostWindow, postMessage } = createHostWindow();
    const client = new DashboardClient({ targetWindow: hostWindow });

    try {
      const promise = client.sql.list();
      const request = postMessage.mock.calls
        .map((call) => call[0] as Record<string, unknown>)
        .find((message) => message.type === "dashboard:request");
      expect(request).toMatchObject({ op: "sql.list" });

      client.start();
      dispatch(
        { type: "dashboard:response", id: request?.id, ok: true, result: { queries: [] } },
        { source: hostWindow }
      );
      await expect(promise).resolves.toEqual([]);
    } finally {
      client.stop();
    }
  });
});

describe("stop", () => {
  it("rejects everything in flight as aborted", async () => {
    ctx = setupClient();
    const promise = ctx.client.sql.list();

    ctx.client.stop();

    await expect(promise).rejects.toMatchObject({ code: "aborted", op: "sql.list" });
    expect(ctx.client.pendingCount).toBe(0);
  });

  it("detaches the listener", async () => {
    ctx = setupClient();
    ctx.client.stop();

    // Nothing is listening, so this theme must not land.
    ctx.fromHost({ type: "dashboard:theme", theme: "dark" });
    expect(ctx.client.theme.get()).toBe("light");
  });

  it("is safe to call twice", () => {
    ctx = setupClient();
    ctx.client.stop();
    expect(() => ctx?.client.stop()).not.toThrow();
  });

  it("rejects a call made after it as aborted, without posting a request", async () => {
    ctx = setupClient();
    ctx.client.stop();

    // A shared client outlived its provider: the answer would never be read, so waiting out
    // the 60 s backstop for no_response helps nobody.
    await expect(ctx.client.sql.list()).rejects.toMatchObject({ code: "aborted", op: "sql.list" });
    await expect(ctx.client.sql.run("a".repeat(24))).rejects.toMatchObject({ code: "aborted", op: "sql.run" });
    expect(ctx.requests()).toHaveLength(0);
    expect(ctx.client.pendingCount).toBe(0);
  });

  it("sends a call made while stopped when start() follows in the same tick", async () => {
    ctx = setupClient();
    ctx.client.stop();

    // StrictMode and a revealed <Activity> re-run a child's effect before the provider restarts
    // the client, so the call lands in the gap between stop() and start().
    const promise = ctx.client.sql.list();
    ctx.client.start();

    await vi.waitFor(() => expect(ctx?.requests()).toHaveLength(1));
    ctx.respondOk({ queries: [{ id: "a", name: "a" }] });
    await expect(promise).resolves.toEqual([{ id: "a", name: "a" }]);
  });

  it("restarts cleanly, which is the StrictMode path", async () => {
    ctx = setupClient();
    ctx.client.stop();
    ctx.client.start();

    const ready = ctx.sentMessages().filter((message) => message.type === "dashboard:ready");
    expect(ready).toHaveLength(2);

    const promise = ctx.client.sql.list();
    ctx.respondOk({ queries: [{ id: "a", name: "a" }] });
    await expect(promise).resolves.toEqual([{ id: "a", name: "a" }]);
  });
});
