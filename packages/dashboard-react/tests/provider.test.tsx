import { DashboardClient } from "@tago-io/custom-dashboard";
import { cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import { type ReactNode, StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { useDashboardClient } from "../src/hooks/use-dashboard-client.js";
import { DashboardProvider } from "../src/provider/dashboard-provider.js";
import { createHarness, createHostStub } from "./helpers/harness.js";

// Globals are off, so Testing Library cannot register its own cleanup; a provider left mounted
// would keep its client listening into the next test.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("DashboardProvider", () => {
  it("renders its children", () => {
    const harness = createHarness();
    render(
      <DashboardProvider client={harness.client}>
        <p>shell</p>
      </DashboardProvider>
    );

    expect(screen.getByText("shell")).toBeDefined();
  });
});

describe("DashboardProvider with a client it creates", () => {
  it("announces the shell exactly once", async () => {
    const host = createHostStub();
    render(<DashboardProvider targetWindow={host.hostWindow}>ok</DashboardProvider>);

    await waitFor(() => expect(host.readyCount()).toBe(1));
  });

  it("announces once per mount under StrictMode, and never more", async () => {
    const host = createHostStub();
    render(
      <StrictMode>
        <DashboardProvider targetWindow={host.hostWindow}>ok</DashboardProvider>
      </StrictMode>
    );

    await waitFor(() => expect(host.readyCount()).toBeGreaterThan(0));

    // StrictMode mounts, unmounts, and mounts again, so the shell announces twice in dev.
    // That is the correct trade: making `stop()` irreversible to avoid it would leave the
    // client dead after the first cleanup. The host answers every ready and never dedupes,
    // so the only cost is one extra theme+style pair.
    expect(host.readyCount()).toBe(2);
  });

  it("leaves a working client after StrictMode's mount, unmount, mount cycle", async () => {
    const host = createHostStub();
    const { result } = renderHook(() => useDashboardClient(), {
      wrapper: ({ children }) => (
        <StrictMode>
          <DashboardProvider targetWindow={host.hostWindow}>{children}</DashboardProvider>
        </StrictMode>
      ),
    });

    const promise = result.current.sql.list();
    await waitFor(() => expect(host.requests()).toHaveLength(1));
    host.respondOk({ queries: [{ id: "a", name: "a" }] });

    await expect(promise).resolves.toEqual([{ id: "a", name: "a" }]);
  });

  it("stops it on unmount", () => {
    const host = createHostStub();
    const { result, unmount } = renderHook(() => useDashboardClient(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <DashboardProvider targetWindow={host.hostWindow}>{children}</DashboardProvider>
      ),
    });
    const client = result.current;

    unmount();

    // Nothing is listening any more, so a theme push must not land.
    host.fromHost({ type: "dashboard:theme", theme: "dark" });
    expect(client.theme.get()).toBe("light");
  });
});

describe("DashboardProvider with a client it is given", () => {
  it("does not start it", () => {
    const host = createHostStub();
    const client = new DashboardClient({ targetWindow: host.hostWindow });
    render(<DashboardProvider client={client}>ok</DashboardProvider>);

    expect(host.readyCount()).toBe(0);
    host.fromHost({ type: "dashboard:theme", theme: "dark" });
    expect(client.theme.get()).toBe("light");
  });

  it("leaves it running on unmount, so the code sharing it keeps getting answers", async () => {
    const harness = createHarness();
    const { unmount } = render(<DashboardProvider client={harness.client}>ok</DashboardProvider>);

    unmount();

    const promise = harness.client.sql.list();
    expect(harness.requests()).toHaveLength(1);
    harness.respondOk({ queries: [{ id: "a", name: "a" }] });
    await expect(promise).resolves.toEqual([{ id: "a", name: "a" }]);

    harness.fromHost({ type: "dashboard:theme", theme: "dark" });
    expect(harness.client.theme.get()).toBe("dark");
  });
});

describe("useDashboardClient", () => {
  it("fails loudly outside a provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => renderHook(() => useDashboardClient())).toThrow(/DashboardProvider/);
  });
});
