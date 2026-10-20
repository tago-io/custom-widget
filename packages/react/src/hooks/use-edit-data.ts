import { type TData, type TDataRecordInput, type TError, autoFillRecords } from "@tago-io/custom-widget-core";
import { useCallback, useState } from "react";

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

  const editData = useCallback(
    async (records: TDataRecordInput | TDataRecordInput[]) => {
      setIsEditing(true);
      setError(null);
      // No mounted guard: a reply that lands while StrictMode replays effects or an <Activity> hides this
      // component must still clear the flag, and React 18 and later ignore an update after unmount.
      try {
        const vars = Array.isArray(records) ? records : [records];
        const filled = autoFillRecords(vars, variables);
        const result = await store.editData(filled);
        setIsEditing(false);
        return result;
      } catch (err) {
        setError(err as TError);
        setIsEditing(false);
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
