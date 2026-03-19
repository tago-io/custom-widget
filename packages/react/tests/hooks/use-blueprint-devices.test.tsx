import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { TagoIOProvider } from "../../src/provider/tago-io-provider.js";
import { useBlueprintDevices } from "../../src/hooks/use-blueprint-devices.js";
import type { TBlueprintDevicesSyncData } from "@tago-io/custom-widget-core";

const mockBlueprintDevices: TBlueprintDevicesSyncData = {
  selected: {
    bp1: { name: "Device 1", device: { id: "d1", name: "Dev 1" } },
    bp2: null,
  },
  settings: [
    { name: "BP1", id: "bp1", conditions: [{ key: "type", value: "sensor" }] },
    { name: "BP2", id: "bp2", conditions: [] },
  ],
};

function wrapper({ children }: { children: ReactNode }) {
  return <TagoIOProvider>{children}</TagoIOProvider>;
}

describe("useBlueprintDevices", () => {
  beforeEach(() => {
    window.parent.postMessage = vi.fn();
  });

  it("returns null initially", () => {
    const { result } = renderHook(() => useBlueprintDevices(), { wrapper });
    expect(result.current.blueprintDevices).toBeNull();
    expect(result.current.selected).toEqual({});
    expect(result.current.settings).toEqual([]);
  });

  it("updates when blueprint devices arrive", () => {
    const { result } = renderHook(() => useBlueprintDevices(), { wrapper });

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", { data: { blueprintDevices: mockBlueprintDevices } })
      );
    });

    expect(result.current.blueprintDevices).toEqual(mockBlueprintDevices);
    expect(result.current.selected.bp1?.device?.id).toBe("d1");
    expect(result.current.selected.bp2).toBeNull();
    expect(result.current.settings).toHaveLength(2);
  });
});
