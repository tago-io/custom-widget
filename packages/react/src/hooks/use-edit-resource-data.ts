import type { TData, TError, TResourceEditInput } from "@tago-io/custom-widget-core";
import { useCallback, useEffect, useRef, useState } from "react";

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
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const editResourceData = useCallback(
    async (records: TResourceEditInput | TResourceEditInput[]) => {
      setIsEditing(true);
      setError(null);
      try {
        const result = await store.editResourceData(records);
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

  return { editResourceData, isEditing, error, reset };
}
