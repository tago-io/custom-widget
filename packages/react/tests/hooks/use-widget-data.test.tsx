import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { TagoIOProvider } from "../../src/provider/tago-io-provider.js";
import { useWidgetData } from "../../src/hooks/use-widget-data.js";
import type { TRealtimeData, TWidget } from "@tago-io/custom-widget-core";

const mockWidget: TWidget = {
  id: "w1",
  dashboard: "d1",
  display: { variables: [{ variable: "temp", origin: { id: "dev1" } }] },
};

const mockRealtime: TRealtimeData[] = [
  {
    data: { variable: ["temp"], origin: "dev1" },
    result: [{ id: "r1", variable: "temp", value: 25, time: "2024-01-01T00:00:00Z" }],
  },
];

function wrapper({ children }: { children: ReactNode }) {
  return <TagoIOProvider>{children}</TagoIOProvider>;
}

describe("useWidgetData", () => {
  beforeEach(() => {
    window.parent.postMessage = vi.fn();
  });

  it("returns loading state initially", () => {
    const { result } = renderHook(() => useWidgetData(), { wrapper });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.widget).toBeNull();
    expect(result.current.records).toEqual([]);
    expect(result.current.realtimeEventCount).toBe(0);
    expect(result.current.lastUpdatedAt).toBeNull();
    expect(result.current.errors).toEqual([]);
  });

  it("combines widget and realtime data", () => {
    const { result } = renderHook(() => useWidgetData(), { wrapper });

    act(() => {
      window.dispatchEvent(new MessageEvent("message", { data: { widget: mockWidget } }));
    });

    act(() => {
      window.dispatchEvent(new MessageEvent("message", { data: { realtime: mockRealtime } }));
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.widget).toEqual(mockWidget);
    expect(result.current.records).toHaveLength(1);
    expect(result.current.records[0].variable).toBe("temp");
    expect(result.current.realtimeEventCount).toBe(1);
    expect(result.current.lastUpdatedAt).toBeInstanceOf(Date);
  });
});
