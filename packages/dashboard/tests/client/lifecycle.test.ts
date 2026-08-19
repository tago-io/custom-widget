import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { DashboardClient } from "../../src/client/dashboard-client.js";
import { createHostWindow, setupClient } from "../helpers/host.js";

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
