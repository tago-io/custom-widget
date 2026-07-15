import type {
  TRealtimeData,
  TResourceGroup,
  TResourceRecord,
  TResourceType,
  WidgetState,
} from "@tago-io/custom-widget-core";
import { useCallback, useRef } from "react";

import { useStore, useStoreSelector } from "./use-store-selector.js";

export interface UseResourceDataReturn {
  resources: TResourceGroup[];
  getByType: (type: TResourceType) => TResourceGroup[];
  refresh: () => void;
  eventCount: number;
  lastUpdatedAt: Date | null;
}

function toResourceGroups(data: TRealtimeData[]): TResourceGroup[] {
  const groups: TResourceGroup[] = [];
  for (const block of data) {
    if (block.resource) {
      groups.push({ resource: block.resource, result: (block.result ?? []) as TResourceRecord[] });
    }
  }
  return groups;
}

type ResourceSelection = {
  data: TRealtimeData[];
  eventCount: number;
  lastRealtimeAt: number | null;
};

export function useResourceData(): UseResourceDataReturn {
  const { store } = useStore();
  const prevDataRef = useRef<TRealtimeData[]>([]);
  const prevGroupsRef = useRef<TResourceGroup[]>([]);

  const stateSelector = useCallback(
    (state: WidgetState): ResourceSelection => ({
      data: state.realtimeData,
      eventCount: state.realtimeEventCount,
      lastRealtimeAt: state.lastRealtimeAt,
    }),
    []
  );

  const equalityFn = useCallback((a: ResourceSelection, b: ResourceSelection) => {
    if (a.eventCount !== b.eventCount) return false;
    if (a.data === b.data) return true;
    if (a.data.length !== b.data.length) return false;
    return a.data.every((block, i) => block === b.data[i]);
  }, []);

  const selected = useStoreSelector(stateSelector, equalityFn);

  const data = selected.data;
  if (data !== prevDataRef.current) {
    prevDataRef.current = data;
    prevGroupsRef.current = toResourceGroups(data);
  }

  const resources = prevGroupsRef.current;

  const getByType = useCallback(
    (type: TResourceType): TResourceGroup[] => resources.filter((group) => group.resource.type === type),
    [resources]
  );

  const refresh = useCallback(() => {
    store.refreshResources();
  }, [store]);

  return {
    resources,
    getByType,
    refresh,
    eventCount: selected.eventCount,
    lastUpdatedAt: selected.lastRealtimeAt ? new Date(selected.lastRealtimeAt) : null,
  };
}
