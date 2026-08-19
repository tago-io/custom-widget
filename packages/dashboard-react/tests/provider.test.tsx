import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { useDashboardClient } from "../src/hooks/use-dashboard-client.js";
import { DashboardProvider } from "../src/provider/dashboard-provider.js";
import { createHarness } from "./helpers/harness.js";

afterEach(() => {
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

  it("announces the shell exactly once", async () => {
    const harness = createHarness();
    render(<DashboardProvider client={harness.client}>ok</DashboardProvider>);

    await waitFor(() => expect(harness.readyCount()).toBe(1));
  });

  it("announces once per mount under StrictMode, and never more", async () => {
    const harness = createHarness();
    render(
      <StrictMode>
        <DashboardProvider client={harness.client}>ok</DashboardProvider>
      </StrictMode>
    );

    await waitFor(() => expect(harness.readyCount()).toBeGreaterThan(0));

    // StrictMode mounts, unmounts, and mounts again, so the shell announces twice in dev.
    // That is the correct trade: making `stop()` irreversible to avoid it would leave the
    // client dead after the first cleanup. The host answers every ready and never dedupes,
    // so the only cost is one extra theme+style pair.
    expect(harness.readyCount()).toBe(2);
  });

  it("leaves a working client after StrictMode's mount, unmount, mount cycle", async () => {
    const harness = createHarness();
    const { result } = renderHook(() => useDashboardClient(), {
      wrapper: ({ children }) => (
        <StrictMode>
          <DashboardProvider client={harness.client}>{children}</DashboardProvider>
        </StrictMode>
      ),
    });

    const promise = result.current.sql.list();
    await waitFor(() => expect(harness.requests()).toHaveLength(1));
    harness.respondOk({ queries: [{ id: "a", name: "a" }] });

    await expect(promise).resolves.toEqual([{ id: "a", name: "a" }]);
  });

  it("stops the client on unmount", async () => {
    const harness = createHarness();
    const { unmount } = render(<DashboardProvider client={harness.client}>ok</DashboardProvider>);

    unmount();

    // Nothing is listening any more, so a theme push must not land.
    harness.fromHost({ type: "dashboard:theme", theme: "dark" });
    expect(harness.client.theme.get()).toBe("light");
  });
});

describe("useDashboardClient", () => {
  it("fails loudly outside a provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => renderHook(() => useDashboardClient())).toThrow(/DashboardProvider/);
  });
});
