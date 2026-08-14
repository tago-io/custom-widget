import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { DashboardClient } from "../../src/client/dashboard-client.js";

let client: DashboardClient | undefined;

afterEach(() => {
  client?.stop();
  client = undefined;
  vi.restoreAllMocks();
});

describe("opened without a host", () => {
  it("reports that it is not embedded", () => {
    // jsdom mirrors the real standalone case: window.parent === window.
    client = new DashboardClient();
    expect(client.isEmbedded).toBe(false);
  });

  it("fails calls immediately instead of hanging until the backstop", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    client = new DashboardClient();
    client.start();

    await expect(client.sql.list()).rejects.toMatchObject({ code: "no_host", op: "sql.list" });
  });

  it("says so once, so the cause is obvious in the console", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    client = new DashboardClient();

    client.start();
    client.stop();
    client.start();

    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0][0]).toContain("standalone");
  });

  it("rejects rather than throwing synchronously", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    client = new DashboardClient();
    client.start();

    let promise: Promise<unknown> | undefined;
    expect(() => {
      promise = client?.sql.list();
    }).not.toThrow();
    await expect(promise).rejects.toMatchObject({ code: "no_host" });
  });
});
