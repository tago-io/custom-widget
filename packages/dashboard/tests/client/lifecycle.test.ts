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
  // A provider starts its client after its children's first effects, in the same tick, so a hook's
  // first call lands on a client that is not running yet.
  it("holds a call until a start() in the same tick, then sends it", async () => {
    const { hostWindow, postMessage } = createHostWindow();
    const client = new DashboardClient({ targetWindow: hostWindow });
    const requests = () =>
      postMessage.mock.calls
        .map((call) => call[0] as Record<string, unknown>)
        .filter((message) => message.type === "dashboard:request");

    try {
      const promise = client.sql.list();
      // Nothing is posted before the listener that reads the answer is attached.
      expect(requests()).toHaveLength(0);

      client.start();
      await vi.waitFor(() => expect(requests()).toHaveLength(1));
      dispatch(
        { type: "dashboard:response", id: requests()[0].id, ok: true, result: { queries: [] } },
        { source: hostWindow }
      );
      await expect(promise).resolves.toEqual([]);
    } finally {
      client.stop();
    }
  });

  it("rejects a call as aborted when no start() follows, instead of waiting out the timeout", async () => {
    const { hostWindow, postMessage } = createHostWindow();
    const client = new DashboardClient({ targetWindow: hostWindow });

    await expect(client.sql.list()).rejects.toMatchObject({ code: "aborted", op: "sql.list" });
    expect(postMessage).not.toHaveBeenCalled();
    expect(client.pendingCount).toBe(0);
  });

  it("fails a held call when stop() comes before it is sent, so it never reaches the host", async () => {
    const { hostWindow, postMessage } = createHostWindow();
    const client = new DashboardClient({ targetWindow: hostWindow });

    // StrictMode's first mount: the child's call, the provider's start(), then the teardown.
    const promise = client.sql.list();
    client.start();
    client.stop();

    await expect(promise).rejects.toMatchObject({ code: "aborted", op: "sql.list" });
    const requests = postMessage.mock.calls.filter(
      (call) => (call[0] as Record<string, unknown>).type === "dashboard:request"
    );
    expect(requests).toHaveLength(0);
  });

  it("still fails fast with no_host when opened outside a dashboard", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const client = new DashboardClient();

    await expect(client.sql.list()).rejects.toMatchObject({ code: "no_host" });
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
