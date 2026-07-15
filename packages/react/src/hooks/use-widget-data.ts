import type { TDataRecord, TError, TWidget, WidgetState } from "@tago-io/custom-widget-core";

import { useStoreSelector } from "./use-store-selector.js";

export interface UseWidgetDataReturn {
  widget: TWidget | null;
  isLoading: boolean;
  records: TDataRecord[];
  realtimeEventCount: number;
  lastUpdatedAt: Date | null;
  errors: TError[];
}

function flattenRecords(state: WidgetState): TDataRecord[] {
  const records: TDataRecord[] = [];
  for (const block of state.realtimeData) {
    if (block.resource || !block.result) continue;
    for (const record of block.result as TDataRecord[]) {
      records.push(record);
    }
  }
  return records;
}

const selector = (state: WidgetState): UseWidgetDataReturn => ({
  widget: state.widget,
  isLoading: !state.isReady,
  records: flattenRecords(state),
  realtimeEventCount: state.realtimeEventCount,
  lastUpdatedAt: state.lastRealtimeAt ? new Date(state.lastRealtimeAt) : null,
  errors: state.errors,
});

function widgetDataEqual(a: UseWidgetDataReturn, b: UseWidgetDataReturn): boolean {
  return (
    a.widget === b.widget &&
    a.isLoading === b.isLoading &&
    a.realtimeEventCount === b.realtimeEventCount &&
    a.errors === b.errors
  );
}

export function useWidgetData(): UseWidgetDataReturn {
  return useStoreSelector(selector, widgetDataEqual);
}
