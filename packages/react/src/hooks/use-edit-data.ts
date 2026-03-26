import type { TData, TDataRecordInput, TError } from "@tago-io/custom-widget-core";
import { useCallback, useRef, useState } from "react";

import { useStore } from "./use-store-selector.js";

export interface UseEditDataReturn {
  editData: (records: TDataRecordInput | TDataRecordInput[]) => Promise<TData>;
  isEditing: boolean;
  error: TError | null;
  reset: () => void;
}

export function useEditData(): UseEditDataReturn {
  const { store } = useStore();
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<TError | null>(null);
  const mountedRef = useRef(true);

  const editData = useCallback(
    async (records: TDataRecordInput | TDataRecordInput[]) => {
      setIsEditing(true);
      setError(null);
      try {
        const result = await store.editData(records);
        if (mountedRef.current) setIsEditing(false);
        return result;
      } catch (err) {
        if (mountedRef.current) {
          setError(err as TError);
          setIsEditing(false);
        }
        throw err;
      }
    },
    [store]
  );

  const reset = useCallback(() => {
    setIsEditing(false);
    setError(null);
  }, []);

  return { editData, isEditing, error, reset };
}
