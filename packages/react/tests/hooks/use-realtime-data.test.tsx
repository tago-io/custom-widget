import type { TRealtimeData } from "@tago-io/custom-widget-core";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { useRealtimeData } from "../../src/hooks/use-realtime-data.js";
import { TagoIOProvider } from "../../src/provider/tago-io-provider.js";

const mockRealtime: TRealtimeData[] = [
  {
    data: { variable: ["temp"], origin: "dev1" },
    result: [{ id: "r1", variable: "temp", value: 25, time: "2024-01-01T00:00:00Z" }],
  },
];

const mockRealtimeHumidity: TRealtimeData[] = [
  {
    data: { variable: ["humidity"], origin: "dev2" },
    result: [{ id: "r2", variable: "humidity", value: 60, time: "2024-01-01T00:00:00Z" }],
  },
];

function wrapper({ children }: { children: ReactNode }) {
  return <TagoIOProvider>{children}</TagoIOProvider>;
}

describe("useRealtimeData", () => {
  beforeEach(() => {
    window.parent.postMessage = vi.fn();
  });

  it("returns empty data initially", () => {
    const { result } = renderHook(() => useRealtimeData(), { wrapper });
    expect(result.current.data).toEqual([]);
    expect(result.current.records).toEqual([]);
    expect(result.current.eventCount).toBe(0);
    expect(result.current.lastUpdatedAt).toBeNull();
  });

  it("updates when realtime data arrives", () => {
    const { result } = renderHook(() => useRealtimeData(), { wrapper });

    act(() => {
      window.dispatchEvent(new MessageEvent("message", { data: { realtime: mockRealtime } }));
    });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.records).toHaveLength(1);
    expect(result.current.records[0].variable).toBe("temp");
    expect(result.current.eventCount).toBe(1);
    expect(result.current.lastUpdatedAt).toBeInstanceOf(Date);
  });

  it("supports custom selector to filter data", () => {
    const { result } = renderHook(
      () =>
        useRealtimeData({
          selector: (data) => data.filter((d) => d.data?.variable?.includes("temp")),
        }),
      { wrapper }
    );

    act(() => {
      window.dispatchEvent(new MessageEvent("message", { data: { realtime: mockRealtime } }));
    });

    act(() => {
      window.dispatchEvent(new MessageEvent("message", { data: { realtime: mockRealtimeHumidity } }));
    });

    expect(result.current.records).toHaveLength(1);
    expect(result.current.records[0].variable).toBe("temp");
  });

  it("clear resets the data", () => {
    const { result } = renderHook(() => useRealtimeData(), { wrapper });

    act(() => {
      window.dispatchEvent(new MessageEvent("message", { data: { realtime: mockRealtime } }));
    });

    expect(result.current.records).toHaveLength(1);

    act(() => {
      result.current.clear();
    });

    expect(result.current.data).toEqual([]);
    expect(result.current.records).toEqual([]);
    expect(result.current.eventCount).toBe(0);
  });
});
