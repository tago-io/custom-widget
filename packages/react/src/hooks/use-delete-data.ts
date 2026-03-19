import type { TData, TDataRecordInput, TError } from "@tago-io/custom-widget-core";
import { useCallback, useRef, useState } from "react";
import { useStore } from "./use-store-selector.js";

export interface UseDeleteDataReturn {
  deleteData: (records: TDataRecordInput | TDataRecordInput[]) => Promise<TData>;
  isDeleting: boolean;
  error: TError | null;
  reset: () => void;
}

export function useDeleteData(): UseDeleteDataReturn {
  const { store } = useStore();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<TError | null>(null);
  const mountedRef = useRef(true);

  const deleteData = useCallback(
    async (records: TDataRecordInput | TDataRecordInput[]) => {
      setIsDeleting(true);
      setError(null);
      try {
        const result = await store.deleteData(records);
        if (mountedRef.current) setIsDeleting(false);
        return result;
      } catch (err) {
        if (mountedRef.current) {
          setError(err as TError);
          setIsDeleting(false);
        }
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
