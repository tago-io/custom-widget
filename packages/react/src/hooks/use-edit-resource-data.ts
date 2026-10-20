import type { TData, TError, TResourceEditInput } from "@tago-io/custom-widget-core";
import { useCallback, useState } from "react";

import { useStore } from "./use-store-selector.js";

export interface UseEditResourceDataReturn {
  editResourceData: (records: TResourceEditInput | TResourceEditInput[]) => Promise<TData>;
  isEditing: boolean;
  error: TError | null;
  reset: () => void;
}

export function useEditResourceData(): UseEditResourceDataReturn {
  const { store } = useStore();
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<TError | null>(null);

  const editResourceData = useCallback(
    async (records: TResourceEditInput | TResourceEditInput[]) => {
      setIsEditing(true);
      setError(null);
      // No mounted guard: a reply that lands while StrictMode replays effects or an <Activity> hides this
      // component must still clear the flag, and React 18 and later ignore an update after unmount.
      try {
        const result = await store.editResourceData(records);
        setIsEditing(false);
        return result;
      } catch (err) {
        setError(err as TError);
        setIsEditing(false);
        throw err;
      }
    },
    [store]
  );

  const reset = useCallback(() => {
    setIsEditing(false);
    setError(null);
  }, []);

  return { editResourceData, isEditing, error, reset };
}
