import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { dispatch, setupClient } from "../helpers/host.js";

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

  it("gives each client its own map", () => {
    const first = setupClient();
    const second = setupClient();

    try {
      dispatch({ type: "dashboard:params", params: { device: "abc123" } });

      expect(first.client.params.get()).toEqual({ device: "abc123" });
      expect(first.client.params.get()).not.toBe(second.client.params.get());

      first.client.params.get().device = "mutated";
      expect(second.client.params.get()).toEqual({ device: "abc123" });
    } finally {
      first.client.stop();
      second.client.stop();
    }
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
