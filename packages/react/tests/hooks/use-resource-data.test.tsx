import type { TRealtimeData } from "@tago-io/custom-widget-core";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { useResourceData } from "../../src/hooks/use-resource-data.js";
import { TagoIOProvider } from "../../src/provider/tago-io-provider.js";

const mockResources: TRealtimeData[] = [
  { resource: { type: "device", view: ["id", "name"] }, result: [{ id: "dev1", name: "Sensor A" }] },
  { resource: { type: "user" }, result: [{ id: "usr1", name: "Alice" }] },
];

const mockMixed: TRealtimeData[] = [
  {
    data: { variable: ["temp"], origin: "dev1" },
    result: [{ id: "r1", variable: "temp", value: 25, time: "2024-01-01T00:00:00Z" }],
  },
  { resource: { type: "entity_list" }, result: [{ id: "e1" }] },
];

function wrapper({ children }: { children: ReactNode }) {
  return <TagoIOProvider>{children}</TagoIOProvider>;
}

describe("useResourceData", () => {
  beforeEach(() => {
    window.parent.postMessage = vi.fn();
  });

  it("returns empty resources initially", () => {
    const { result } = renderHook(() => useResourceData(), { wrapper });
    expect(result.current.resources).toEqual([]);
    expect(result.current.eventCount).toBe(0);
    expect(result.current.lastUpdatedAt).toBeNull();
  });

  it("exposes resource groups from the realtime payload", () => {
    const { result } = renderHook(() => useResourceData(), { wrapper });

    act(() => {
      window.dispatchEvent(new MessageEvent("message", { data: { realtime: mockResources } }));
    });

    expect(result.current.resources).toHaveLength(2);
    expect(result.current.resources[0].resource.type).toBe("device");
    expect(result.current.resources[0].result[0]).toEqual({ id: "dev1", name: "Sensor A" });
    expect(result.current.eventCount).toBe(1);
    expect(result.current.lastUpdatedAt).toBeInstanceOf(Date);
  });

  it("getByType filters groups by resource type", () => {
    const { result } = renderHook(() => useResourceData(), { wrapper });

    act(() => {
      window.dispatchEvent(new MessageEvent("message", { data: { realtime: mockResources } }));
    });

    expect(result.current.getByType("user")).toHaveLength(1);
    expect(result.current.getByType("user")[0].result[0]).toEqual({ id: "usr1", name: "Alice" });
    expect(result.current.getByType("entity")).toHaveLength(0);
  });

  it("ignores data blocks and keeps only resource blocks", () => {
    const { result } = renderHook(() => useResourceData(), { wrapper });

    act(() => {
      window.dispatchEvent(new MessageEvent("message", { data: { realtime: mockMixed } }));
    });

    expect(result.current.resources).toHaveLength(1);
    expect(result.current.resources[0].resource.type).toBe("entity_list");
  });
});
