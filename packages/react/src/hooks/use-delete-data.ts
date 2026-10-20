import type { TData, TDataRecord, TError } from "@tago-io/custom-widget-core";
import { useCallback, useState } from "react";

import { useStore } from "./use-store-selector.js";

export interface UseDeleteDataReturn {
  deleteData: (records: TDataRecord | TDataRecord[]) => Promise<TData>;
  isDeleting: boolean;
  error: TError | null;
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
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<TError | null>(null);

  const deleteData = useCallback(
    async (records: TDataRecord | TDataRecord[]) => {
      setIsDeleting(true);
      setError(null);
      // No mounted guard: a reply that lands while StrictMode replays effects or an <Activity> hides this
      // component must still clear the flag, and React 18 and later ignore an update after unmount.
      try {
        const result = await store.deleteData(toDeletePayload(records));
        setIsDeleting(false);
        return result;
      } catch (err) {
        setError(err as TError);
        setIsDeleting(false);
        throw err;
      }
    },
    [store]
  );

  const reset = useCallback(() => {
    setIsDeleting(false);
    setError(null);
  }, []);

  return { deleteData, isDeleting, error, reset };
}
