import { afterEach, describe, expect, it, vi } from "vite-plus/test";

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("src/index.ts", () => {
  it("registers no listeners on import, which is what keeps it safe to bundle and to import on a server", async () => {
    vi.resetModules();
    const addEventListener = vi.spyOn(window, "addEventListener");

    await import("../src/index.js");

    const messageListeners = addEventListener.mock.calls.filter(([type]) => type === "message");
    expect(messageListeners).toHaveLength(0);
  });

  it("exports the public surface", async () => {
    const api = await import("../src/index.js");

    expect(typeof api.createDashboardClient).toBe("function");
    expect(typeof api.DashboardClient).toBe("function");
    expect(typeof api.getInitialTheme).toBe("function");
    expect(typeof api.isValidQueryId).toBe("function");
    expect(typeof api.serializeQueryParams).toBe("function");
    expect(typeof api.isDashboardError).toBe("function");
    expect(typeof api.TagoDashboardError).toBe("function");
  });

  it("does not export a generic op caller or a dashboard-id reader", async () => {
    const api = await import("../src/index.js");

    expect(api).not.toHaveProperty("request");
    expect(api).not.toHaveProperty("getDashboardId");
  });
});

describe("src/global.ts", () => {
  it("installs the global and announces itself on load", async () => {
    vi.resetModules();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);

    await import("../src/global.js");

    expect(window.TagoDashboard).toBeDefined();
    expect(typeof window.TagoDashboard.sql.list).toBe("function");
    expect(typeof window.TagoDashboard.getInitialTheme).toBe("function");
    expect(postMessage).toHaveBeenCalledWith({ type: "dashboard:ready" }, "*");

    window.TagoDashboard.stop();
  });
});

describe("isDashboardError", () => {
  it("recognizes an error from a second copy of the bundle", async () => {
    const { isDashboardError } = await import("../src/index.js");

    // Structurally identical, but not the same class identity.
    const foreign = Object.assign(new Error("boom"), { name: "TagoDashboardError", code: "not_found" });
    expect(isDashboardError(foreign)).toBe(true);
    expect(isDashboardError(new Error("boom"))).toBe(false);
    expect(isDashboardError(null)).toBe(false);
  });
});
