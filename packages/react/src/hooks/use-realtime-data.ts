import type { TDataRecord, TRealtimeData, WidgetState } from "@tago-io/custom-widget-core";
import { useCallback, useRef } from "react";
import { useStore, useStoreSelector } from "./use-store-selector.js";

export interface UseRealtimeDataOptions {
  selector?: (data: TRealtimeData[]) => TRealtimeData[];
}

export interface UseRealtimeDataReturn {
  data: TRealtimeData[];
  records: TDataRecord[];
  eventCount: number;
  lastUpdatedAt: Date | null;
  clear: () => void;
}

function flattenRecords(data: TRealtimeData[]): TDataRecord[] {
  const records: TDataRecord[] = [];
  for (const block of data) {
    if (block.result) {
      for (const record of block.result) {
        records.push(record);
      }
    }
  }
  return records;
}

export function useRealtimeData(options?: UseRealtimeDataOptions): UseRealtimeDataReturn {
  const { store } = useStore();
  const userSelector = options?.selector;

  const prevDataRef = useRef<TRealtimeData[]>([]);
  const prevRecordsRef = useRef<TDataRecord[]>([]);

  const stateSelector = useCallback(
    (state: WidgetState) => {
      let data = state.realtimeData;
      if (userSelector) {
        data = userSelector(data);
      }
      return {
        data,
        eventCount: state.realtimeEventCount,
        lastRealtimeAt: state.lastRealtimeAt,
      };
    },
    [userSelector]
  );

  const equalityFn = useCallback(
    (
      a: { data: TRealtimeData[]; eventCount: number; lastRealtimeAt: number | null },
      b: { data: TRealtimeData[]; eventCount: number; lastRealtimeAt: number | null }
    ) => {
      if (a.eventCount !== b.eventCount) return false;
      if (a.data === b.data) return true;
      if (a.data.length !== b.data.length) return false;
      return a.data.every((block, i) => block === b.data[i]);
    },
    []
  );

  const selected = useStoreSelector(stateSelector, equalityFn);

  const data = selected.data;
  if (data !== prevDataRef.current) {
    prevDataRef.current = data;
    prevRecordsRef.current = flattenRecords(data);
  }

  const clear = useCallback(() => {
    store.clearRealtimeData();
  }, [store]);

  return {
    data,
    records: prevRecordsRef.current,
    eventCount: selected.eventCount,
    lastUpdatedAt: selected.lastRealtimeAt ? new Date(selected.lastRealtimeAt) : null,
    clear,
  };
}
