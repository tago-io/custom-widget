import type { TWidget } from "@tago-io/custom-widget-core";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { useWidget } from "../../src/hooks/use-widget.js";
import { TagoIOProvider } from "../../src/provider/tago-io-provider.js";

const mockWidget: TWidget = {
  id: "w1",
  dashboard: "d1",
  display: { variables: [{ variable: "temp", origin: { id: "dev1" } }] },
  label: "My Widget",
};

function wrapper({ children }: { children: ReactNode }) {
  return <TagoIOProvider>{children}</TagoIOProvider>;
}

describe("useWidget", () => {
  beforeEach(() => {
    window.parent.postMessage = vi.fn();
  });

  it("returns loading state initially", () => {
    const { result } = renderHook(() => useWidget(), { wrapper });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.widget).toBeNull();
    expect(result.current.variables).toEqual([]);
    expect(result.current.dashboardId).toBeNull();
    expect(result.current.widgetId).toBeNull();
    expect(result.current.label).toBeNull();
  });

  it("updates when widget message arrives", () => {
    const { result } = renderHook(() => useWidget(), { wrapper });

    act(() => {
      window.dispatchEvent(new MessageEvent("message", { data: { widget: mockWidget } }));
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.widget).toEqual(mockWidget);
    expect(result.current.variables).toEqual(mockWidget.display.variables);
    expect(result.current.dashboardId).toBe("d1");
    expect(result.current.widgetId).toBe("w1");
    expect(result.current.label).toBe("My Widget");
  });

  it("throws when used outside provider", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => {
      renderHook(() => useWidget());
    }).toThrow("useStore must be used within a <TagoIOProvider>");
    consoleSpy.mockRestore();
  });
});
