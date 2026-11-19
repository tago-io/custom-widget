import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { DashboardClient } from "../../src/client/dashboard-client.js";
import { createHostWindow, dispatch, setupClient } from "../helpers/host.js";

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
    // Two clients talking to the same host, so one event from it reaches both.
    const { hostWindow } = createHostWindow();
    const first = { client: new DashboardClient({ targetWindow: hostWindow }) };
    const second = { client: new DashboardClient({ targetWindow: hostWindow }) };
    first.client.start();
    second.client.start();

    try {
      // One event, dispatched once on window, delivered to both clients' listeners carrying the
      // very same `data` object. Adopting the payload instead of copying it aliased the two.
      dispatch({ type: "dashboard:style", style: { paddingBottom: 96 } }, { source: hostWindow });

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

describe("sender", () => {
  // Theme and style change what the viewer sees, so only the host window may set them, the same
  // rule params follow. Anything else posting to this window is a child frame or an extension.
  it.each([
    ["the shell's own window", () => window],
    ["a child frame", () => ({}) as Window],
    ["no source at all", () => null],
  ])("ignores theme and style posted by %s", (_label, source) => {
    ctx = setupClient();
    const themeListener = vi.fn();
    const styleListener = vi.fn();
    ctx.client.theme.subscribe(themeListener);
    ctx.client.style.subscribe(styleListener);

    dispatch({ type: "dashboard:theme", theme: "dark" }, { source: source() });
    dispatch({ type: "dashboard:style", style: { paddingBottom: 96 } }, { source: source() });

    expect(themeListener).not.toHaveBeenCalled();
    expect(styleListener).not.toHaveBeenCalled();
    expect(ctx.client.theme.get()).toBe("light");
    expect(ctx.client.style.get()).toEqual({});
  });

  it("ignores theme and style when opened standalone, where the target is the page itself", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    // jsdom has no parent frame, so the default target is this very window.
    const client = new DashboardClient();
    client.start();

    try {
      expect(client.isEmbedded).toBe(false);
      dispatch({ type: "dashboard:theme", theme: "dark" }, { source: window });
      dispatch({ type: "dashboard:style", style: { paddingBottom: 96 } }, { source: window });
      expect(client.theme.get()).toBe("light");
      expect(client.style.get()).toEqual({});
    } finally {
      client.stop();
    }
  });
});

describe("style equality", () => {
  it("tells a missing key apart from an undefined value", () => {
    ctx = setupClient();
    const listener = vi.fn();
    ctx.client.style.subscribe(listener);

    ctx.fromHost({ type: "dashboard:style", style: { a: undefined } });
    ctx.fromHost({ type: "dashboard:style", style: { b: undefined } });

    expect(listener).toHaveBeenCalledTimes(2);
    expect(Object.keys(ctx.client.style.get())).toEqual(["b"]);
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
