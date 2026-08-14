import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { dispatch, HOST_ORIGIN, setupClient } from "../helpers/host.js";

let ctx: ReturnType<typeof setupClient> | undefined;

afterEach(() => {
  ctx?.client.stop();
  ctx = undefined;
  vi.restoreAllMocks();
});

describe("noise", () => {
  it.each([
    ["undefined", undefined],
    ["null", null],
    ["a string", "dashboard:theme"],
    ["a number", 0],
    ["an array", []],
    ["vite hmr", { type: "vite:beforeUpdate" }],
    ["vite ping", { type: "vite:ping" }],
    ["react devtools", { source: "react-devtools-bridge", payload: {} }],
    ["webpack", { type: "webpackHotUpdate" }],
    ["an unknown dashboard type", { type: "dashboard:whatever" }],
  ])("ignores %s without a sound", (_label, data) => {
    ctx = setupClient();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const listener = vi.fn();
    ctx.client.theme.subscribe(listener);

    ctx.fromHost(data);

    expect(listener).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("survives its own messages echoing back, which is what standalone dev looks like", () => {
    ctx = setupClient();
    const listener = vi.fn();
    ctx.client.theme.subscribe(listener);

    const before = ctx.sentMessages().length;
    for (const own of ctx.sentMessages()) {
      ctx.fromHost(own);
    }

    expect(listener).not.toHaveBeenCalled();
    expect(ctx.sentMessages()).toHaveLength(before);
  });
});

describe("origins", () => {
  it("accepts any origin by default, because the shell cannot know the host's", () => {
    ctx = setupClient();
    ctx.fromHost({ type: "dashboard:theme", theme: "dark" }, "https://anything.example");
    expect(ctx.client.theme.get()).toBe("dark");
  });

  it("accepts the allowlisted origin", async () => {
    ctx = setupClient({ allowedOrigins: [HOST_ORIGIN] });
    const promise = ctx.client.sql.list();

    ctx.respondOk({ queries: [] });

    await expect(promise).resolves.toEqual([]);
  });

  it("drops a response from an origin outside the allowlist", async () => {
    ctx = setupClient({ allowedOrigins: [HOST_ORIGIN] });

    let settled = false;
    void ctx.client.sql.list().then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      }
    );

    ctx.fromHost(
      { type: "dashboard:response", id: ctx.lastRequestID(), ok: true, result: { queries: [] } },
      "https://evil.example"
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(settled).toBe(false);
    expect(ctx.client.pendingCount).toBe(1);
  });

  it("pins the wrong origin and everything silently hangs — the documented footgun", async () => {
    ctx = setupClient({ allowedOrigins: ["https://api.tago.io"] });

    let settled = false;
    void ctx.client.sql.list().then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      }
    );

    ctx.respondOk({ queries: [] });
    await Promise.resolve();

    expect(settled).toBe(false);
    expect(ctx.client.pendingCount).toBe(1);
  });
});

describe("the jsdom source trap", () => {
  it("documents why every inbound test sets source explicitly", () => {
    expect(window.parent).toBe(window);
    const constructed = new MessageEvent("message", { data: {} });
    expect(constructed.source).toBeNull();
    expect(constructed.origin).toBe("");
  });

  it("still accepts a message whose source is null", () => {
    ctx = setupClient();
    dispatch({ type: "dashboard:theme", theme: "dark" }, { source: null });
    expect(ctx.client.theme.get()).toBe("dark");
  });
});
