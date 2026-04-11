import type { TError, WidgetState } from "@tago-io/custom-widget-core";
import { useCallback } from "react";

import { useStore, useStoreSelector } from "./use-store-selector.js";

export interface UseWidgetErrorsReturn {
  lastError: TError | null;
  errors: TError[];
  clearErrors: () => void;
}

const selector = (state: WidgetState) => state.errors;

export function useWidgetErrors(): UseWidgetErrorsReturn {
  const { store } = useStore();
  const errors = useStoreSelector(selector);

  const clearErrors = useCallback(() => {
    store.clearErrors();
  }, [store]);

  return {
    lastError: errors.length > 0 ? errors[errors.length - 1] : null,
    errors,
    clearErrors,
  };
}
