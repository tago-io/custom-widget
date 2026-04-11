import type {
  TBlueprintDevicesSyncData,
  TDashboardBlueprintDevice,
  TDashboardSelectedBlueprintDevices,
  WidgetState,
} from "@tago-io/custom-widget-core";

import { useStoreSelector } from "./use-store-selector.js";

export interface UseBlueprintDevicesReturn {
  blueprintDevices: TBlueprintDevicesSyncData | null;
  selected: TDashboardSelectedBlueprintDevices;
  settings: TDashboardBlueprintDevice[];
}

const EMPTY_SELECTED: TDashboardSelectedBlueprintDevices = {};
const EMPTY_SETTINGS: TDashboardBlueprintDevice[] = [];

const selector = (state: WidgetState): UseBlueprintDevicesReturn => ({
  blueprintDevices: state.blueprintDevices,
  selected: state.blueprintDevices?.selected ?? EMPTY_SELECTED,
  settings: state.blueprintDevices?.settings ?? EMPTY_SETTINGS,
});

function bpEqual(a: UseBlueprintDevicesReturn, b: UseBlueprintDevicesReturn): boolean {
  return a.blueprintDevices === b.blueprintDevices;
}

export function useBlueprintDevices(): UseBlueprintDevicesReturn {
  return useStoreSelector(selector, bpEqual);
}
