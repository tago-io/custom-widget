import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { DashboardClient } from "../../src/client/dashboard-client.js";
import { createHostWindow, dispatch, HOST_ORIGIN, setupClient } from "../helpers/host.js";

let ctx: ReturnType<typeof setupClient> | undefined;

afterEach(() => {
  ctx?.client.stop();
  ctx = undefined;
  vi.restoreAllMocks();
});

describe("params", () => {
  it("starts empty, before any message arrives", () => {
    ctx = setupClient();
    expect(ctx.client.params.get()).toEqual({});
  });

  it("takes the map the host forwards and notifies", () => {
    ctx = setupClient();
    const listener = vi.fn();
    ctx.client.params.subscribe(listener);

    ctx.fromHost({ type: "dashboard:params", params: { device: "abc123", count: "30" } });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(ctx.client.params.get()).toEqual({ device: "abc123", count: "30" });
  });

  it("follows a live change and a clear to empty", () => {
    ctx = setupClient();
    const listener = vi.fn();
    ctx.client.params.subscribe(listener);

    ctx.fromHost({ type: "dashboard:params", params: { device: "abc123" } });
    ctx.fromHost({ type: "dashboard:params", params: { device: "zzz999" } });
    expect(ctx.client.params.get()).toEqual({ device: "zzz999" });

    ctx.fromHost({ type: "dashboard:params", params: {} });
    expect(ctx.client.params.get()).toEqual({});
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("stays quiet when the same map arrives again", () => {
    ctx = setupClient();
    const listener = vi.fn();
    ctx.client.params.subscribe(listener);

    for (let index = 0; index < 3; index += 1) {
      ctx.fromHost({ type: "dashboard:params", params: { device: "abc123" } });
    }
    // An empty map against the empty start is not a change either.
    ctx.fromHost({ type: "dashboard:params", params: {} });
    ctx.fromHost({ type: "dashboard:params", params: { device: "abc123" } });

    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("drops non-string values instead of handing them to the author", () => {
    ctx = setupClient();
    ctx.fromHost({
      type: "dashboard:params",
      params: { device: "abc123", count: 30, flag: true, nested: { a: "1" }, list: ["1"], nil: null },
    });
    expect(ctx.client.params.get()).toEqual({ device: "abc123" });
  });

  it("ignores a params message whose params is not an object", () => {
    ctx = setupClient();
    const listener = vi.fn();
    ctx.client.params.subscribe(listener);

    for (const params of [null, "device=abc123", ["abc123"], 1, undefined]) {
      ctx.fromHost({ type: "dashboard:params", params });
    }

    expect(listener).not.toHaveBeenCalled();
    expect(ctx.client.params.get()).toEqual({});
  });

  it("ignores params posted by any window other than the host", () => {
    ctx = setupClient();
    const listener = vi.fn();
    ctx.client.params.subscribe(listener);

    // The shell's own window (an extension), and a child frame of the shell.
    dispatch({ type: "dashboard:params", params: { device: "forged" } }, { source: window });
    dispatch({ type: "dashboard:params", params: { device: "forged" } }, { source: {} as Window });

    expect(listener).not.toHaveBeenCalled();
    expect(ctx.client.params.get()).toEqual({});
  });

  it("ignores params from an origin outside allowedOrigins", () => {
    ctx = setupClient({ allowedOrigins: [HOST_ORIGIN] });

    ctx.fromHost({ type: "dashboard:params", params: { device: "forged" } }, "https://evil.example");
    expect(ctx.client.params.get()).toEqual({});

    ctx.fromHost({ type: "dashboard:params", params: { device: "abc123" } }, HOST_ORIGIN);
    expect(ctx.client.params.get()).toEqual({ device: "abc123" });
  });

  it("hands out a frozen map", () => {
    ctx = setupClient();
    ctx.fromHost({ type: "dashboard:params", params: { device: "abc123" } });

    const params = ctx.client.params.get();
    expect(Object.isFrozen(params)).toBe(true);
    expect(() => {
      // @ts-expect-error the map is read-only, and this proves it at runtime too
      params.device = "mutated";
    }).toThrow(TypeError);
    expect(Object.isFrozen(ctx.client.params.get())).toBe(true);
  });

  it("hands out a map with no prototype, so a missing key reads undefined", () => {
    ctx = setupClient();
    expect(ctx.client.params.get().constructor).toBeUndefined();

    ctx.fromHost({ type: "dashboard:params", params: { device: "abc123", constructor: "x" } });

    const params = ctx.client.params.get();
    expect(Object.getPrototypeOf(params)).toBeNull();
    expect(params.toString).toBeUndefined();
    expect(params.constructor).toBe("x");
  });

  it("ignores params when opened standalone, where the target is the page itself", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    // jsdom has no parent frame, so the default target is this very window.
    const client = new DashboardClient();
    client.start();

    try {
      expect(client.isEmbedded).toBe(false);
      dispatch({ type: "dashboard:params", params: { device: "forged" } }, { source: window });
      expect(client.params.get()).toEqual({});
    } finally {
      client.stop();
    }
  });

  it("gives each client its own map", () => {
    const { hostWindow } = createHostWindow();
    const first = new DashboardClient({ targetWindow: hostWindow });
    const second = new DashboardClient({ targetWindow: hostWindow });
    first.start();
    second.start();

    try {
      // One event, delivered to both clients' listeners carrying the very same `data` object.
      dispatch({ type: "dashboard:params", params: { device: "abc123" } }, { source: hostWindow });

      expect(first.params.get()).toEqual({ device: "abc123" });
      expect(second.params.get()).toEqual({ device: "abc123" });
      expect(first.params.get()).not.toBe(second.params.get());
    } finally {
      first.stop();
      second.stop();
    }
  });

  it("starts from {} again on start(), so a URL cleared while stopped does not stay live", () => {
    ctx = setupClient();
    const listener = vi.fn();
    ctx.client.params.subscribe(listener);
    ctx.fromHost({ type: "dashboard:params", params: { device: "abc123" } });

    ctx.client.stop();
    // Nothing fires while tearing down.
    expect(listener).toHaveBeenCalledTimes(1);

    // The host's `{}` for the cleared URL lands while detached, and on the next ready it posts
    // nothing for an empty map. The client must not resurrect the old device.
    ctx.fromHost({ type: "dashboard:params", params: {} });
    ctx.client.start();

    expect(ctx.client.params.get()).toEqual({});
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("lets a subscriber that reacts to the restart reset reach the host", async () => {
    ctx = setupClient();
    ctx.fromHost({ type: "dashboard:params", params: { device: "abc123" } });
    ctx.client.stop();

    const client = ctx.client;
    let call: Promise<unknown> | undefined;
    client.params.subscribe(() => {
      call = client.sql.list();
    });
    client.start();

    expect(ctx.requests()).toHaveLength(1);
    ctx.respondOk({ queries: [] });
    await expect(call).resolves.toEqual([]);
  });

  it("takes the map again when the host re-seeds it after a restart", () => {
    ctx = setupClient();
    ctx.fromHost({ type: "dashboard:params", params: { device: "abc123" } });

    ctx.client.stop();
    ctx.client.start();
    ctx.fromHost({ type: "dashboard:params", params: { device: "abc123" } });

    expect(ctx.client.params.get()).toEqual({ device: "abc123" });
  });

  it("stops notifying after unsubscribe", () => {
    ctx = setupClient();
    const listener = vi.fn();
    const unsubscribe = ctx.client.params.subscribe(listener);

    unsubscribe();
    ctx.fromHost({ type: "dashboard:params", params: { device: "abc123" } });

    expect(listener).not.toHaveBeenCalled();
  });
});
