import type { TData, TDataRecord, TError } from "@tago-io/custom-widget-core";
import { useCallback } from "react";

import { useLatestCall } from "./use-latest-call.js";
import { useStore } from "./use-store-selector.js";

export interface UseDeleteDataReturn {
  deleteData: (records: TDataRecord | TDataRecord[]) => Promise<TData>;
  /** True while the latest call waits for its answer. */
  isDeleting: boolean;
  /** The latest call's rejection. */
  error: TError | null;
  /** Back to idle. A call in flight still settles its own promise but no longer changes isDeleting or error. */
  reset: () => void;
}

/**
 * Formats records into the "id:device" string payload expected by the TagoIO dashboard for delete operations.
 */
function toDeletePayload(records: TDataRecord | TDataRecord[]): string[] {
  const arr = Array.isArray(records) ? records : [records];
  return arr.map((r) => `${r.id}:${r.device}`);
}

export function useDeleteData(): UseDeleteDataReturn {
  const { store } = useStore();
  const { run, isPending: isDeleting, error, reset } = useLatestCall<TError>();

  const deleteData = useCallback(
    (records: TDataRecord | TDataRecord[]) => run(() => store.deleteData(toDeletePayload(records))),
    [run, store]
  );

  return { deleteData, isDeleting, error, reset };
}
