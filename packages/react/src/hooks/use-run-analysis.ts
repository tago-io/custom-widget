import { useCallback } from "react";

import { useStore } from "./use-store-selector.js";

export interface UseRunAnalysisReturn {
  runAnalysis: (scope?: unknown) => void;
}

export function useRunAnalysis(): UseRunAnalysisReturn {
  const { store } = useStore();

  const runAnalysis = useCallback(
    (scope?: unknown) => {
      store.runAnalysis(scope);
    },
    [store]
  );

  return { runAnalysis };
}
