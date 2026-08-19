import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { dispatch, setupClient } from "../helpers/host.js";

let ctx: ReturnType<typeof setupClient> | undefined;

afterEach(() => {
  ctx?.client.stop();
  ctx = undefined;
  vi.restoreAllMocks();
});

describe("theme", () => {
  it("starts from the URL, before any message arrives", () => {
    ctx = setupClient();
    // jsdom has no ?theme= here, so the documented fallback applies.
    expect(ctx.client.theme.get()).toBe("light");
  });

  it("notifies once per real change", () => {
    ctx = setupClient();
    const listener = vi.fn();
    ctx.client.theme.subscribe(listener);

    ctx.fromHost({ type: "dashboard:theme", theme: "dark" });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(ctx.client.theme.get()).toBe("dark");

    ctx.fromHost({ type: "dashboard:theme", theme: "light" });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("stays quiet when the host repeats the current theme", () => {
    ctx = setupClient();
    const listener = vi.fn();
    ctx.client.theme.subscribe(listener);

    // The host re-sends on every <html> class mutation, so this is the common case, not the rare one.
    for (let index = 0; index < 5; index += 1) {
      ctx.fromHost({ type: "dashboard:theme", theme: "dark" });
    }

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("ignores values that are not dark or light", () => {
    ctx = setupClient();
    const listener = vi.fn();
    ctx.client.theme.subscribe(listener);

    for (const theme of ["Dark", "", 1, null, {}]) {
      ctx.fromHost({ type: "dashboard:theme", theme });
    }

    expect(listener).not.toHaveBeenCalled();
    expect(ctx.client.theme.get()).toBe("light");
  });

  it("stops notifying after unsubscribe", () => {
    ctx = setupClient();
    const listener = vi.fn();
    const unsubscribe = ctx.client.theme.subscribe(listener);

    unsubscribe();
    ctx.fromHost({ type: "dashboard:theme", theme: "dark" });

    expect(listener).not.toHaveBeenCalled();
  });
});

describe("style", () => {
  it("notifies once for the host's constant empty object", () => {
    ctx = setupClient();
    const listener = vi.fn();
    ctx.client.style.subscribe(listener);

    for (let index = 0; index < 5; index += 1) {
      ctx.fromHost({ type: "dashboard:style", style: {} });
    }

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("notifies again when the contents actually change", () => {
    ctx = setupClient();
    const listener = vi.fn();
    ctx.client.style.subscribe(listener);

    ctx.fromHost({ type: "dashboard:style", style: {} });
    ctx.fromHost({ type: "dashboard:style", style: { paddingBottom: 96 } });

    expect(listener).toHaveBeenCalledTimes(2);
    expect(ctx.client.style.get()).toEqual({ paddingBottom: 96 });
  });

  it("gives each client its own object, so one shell cannot mutate another's", () => {
    const first = setupClient();
    const second = setupClient();

    try {
      expect(first.client.style.get()).not.toBe(second.client.style.get());

      (first.client.style.get() as Record<string, unknown>).injected = "from the first shell";
      expect(second.client.style.get()).toEqual({});
    } finally {
      first.client.stop();
      second.client.stop();
    }
  });

  it("still isolates them once a real message has landed", () => {
    const first = setupClient();
    const second = setupClient();

    try {
      // One event, dispatched once on window, delivered to both clients' listeners carrying the
      // very same `data` object. Adopting the payload instead of copying it aliased the two.
      dispatch({ type: "dashboard:style", style: { paddingBottom: 96 } });

      expect(first.client.style.get()).toEqual({ paddingBottom: 96 });
      expect(second.client.style.get()).toEqual({ paddingBottom: 96 });
      expect(first.client.style.get()).not.toBe(second.client.style.get());

      (first.client.style.get() as Record<string, unknown>).injected = "from the first shell";
      expect(second.client.style.get()).toEqual({ paddingBottom: 96 });
    } finally {
      first.client.stop();
      second.client.stop();
    }
  });
});

describe("subscriber isolation", () => {
  it("keeps going when one subscriber throws", () => {
    ctx = setupClient();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const second = vi.fn();

    ctx.client.theme.subscribe(() => {
      throw new Error("boom");
    });
    ctx.client.theme.subscribe(second);

    ctx.fromHost({ type: "dashboard:theme", theme: "dark" });

    expect(second).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalled();
  });

  it("does not let a throwing subscriber strand a pending request", async () => {
    ctx = setupClient();
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    ctx.client.theme.subscribe(() => {
      throw new Error("boom");
    });

    const promise = ctx.client.sql.list();
    ctx.fromHost({ type: "dashboard:theme", theme: "dark" });
    ctx.respondOk({ queries: [] });

    await expect(promise).resolves.toEqual([]);
  });
});
