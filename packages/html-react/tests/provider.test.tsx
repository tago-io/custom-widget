import { DashboardClient } from "@tago-io/custom-html";
import { cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import { type ReactNode, StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { useDashboardClient } from "../src/hooks/use-dashboard-client.js";
import { useSqlQueries } from "../src/hooks/use-sql-queries.js";
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
    // reactStrictMode, not a <StrictMode> inside the wrapper: React 19 double-invokes effects only
    // when StrictMode sits at or above the topmost newly mounted fiber, which the wrapper is.
    const { result } = renderHook(() => useDashboardClient(), {
      reactStrictMode: true,
      wrapper: ({ children }) => <DashboardProvider targetWindow={host.hostWindow}>{children}</DashboardProvider>,
    });
    await waitFor(() => expect(host.readyCount()).toBe(2));

    const promise = result.current.sql.list();
    await waitFor(() => expect(host.requests()).toHaveLength(1));
    host.respondOk({ queries: [{ id: "a", name: "a" }] });

    await expect(promise).resolves.toEqual([{ id: "a", name: "a" }]);
  });

  it("answers a child's query issued in StrictMode's remount, before the provider restarts", async () => {
    const host = createHostStub();
    const { result } = renderHook(() => useSqlQueries(), {
      reactStrictMode: true,
      wrapper: ({ children }) => <DashboardProvider targetWindow={host.hostWindow}>{children}</DashboardProvider>,
    });

    // The remount re-runs the hook's effect while the client is still stopped. That call must
    // wait for the provider's start() in the same tick, not fail as aborted. The first mount's call
    // was still waiting for start() when StrictMode stopped the client, so it never reached the
    // host: one execution, not two.
    await waitFor(() => expect(host.requests()).toHaveLength(1));
    host.respondOk({ queries: [{ id: "a", name: "a" }] });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.queries).toEqual([{ id: "a", name: "a" }]);
    expect(host.requests()).toHaveLength(1);
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
  it("fails a hook's call on it as aborted when nobody started it, instead of waiting out the timeout", async () => {
    const host = createHostStub();
    const client = new DashboardClient({ targetWindow: host.hostWindow });
    const { result } = renderHook(() => useSqlQueries(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <DashboardProvider client={client}>{children}</DashboardProvider>
      ),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error?.code).toBe("aborted");
    expect(host.requests()).toHaveLength(0);
  });

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
