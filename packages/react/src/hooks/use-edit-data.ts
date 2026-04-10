import { type TData, type TDataRecordInput, type TError, autoFillRecords } from "@tago-io/custom-widget-core";
import { useCallback, useEffect, useRef, useState } from "react";

import { useStore } from "./use-store-selector.js";
import { useWidget } from "./use-widget.js";

export interface UseEditDataReturn {
  editData: (records: TDataRecordInput | TDataRecordInput[]) => Promise<TData>;
  isEditing: boolean;
  error: TError | null;
  reset: () => void;
}

export function useEditData(): UseEditDataReturn {
  const { store } = useStore();
  const { variables } = useWidget();
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<TError | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const editData = useCallback(
    async (records: TDataRecordInput | TDataRecordInput[]) => {
      setIsEditing(true);
      setError(null);
      try {
        const vars = Array.isArray(records) ? records : [records];
        const filled = autoFillRecords(vars, variables);
        const result = await store.editData(filled);
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
    [store, variables]
  );

  const reset = useCallback(() => {
    setIsEditing(false);
    setError(null);
  }, []);

  return { editData, isEditing, error, reset };
}
