import type { TData, TError, TResourceEditInput } from "@tago-io/custom-widget-core";
import { useCallback } from "react";

import { useLatestCall } from "./use-latest-call.js";
import { useStore } from "./use-store-selector.js";

export interface UseEditResourceDataReturn {
  editResourceData: (records: TResourceEditInput | TResourceEditInput[]) => Promise<TData>;
  /** True while the latest call waits for its answer. */
  isEditing: boolean;
  /** The latest call's rejection. */
  error: TError | null;
  /** Back to idle. A call in flight still settles its own promise but no longer changes isEditing or error. */
  reset: () => void;
}

export function useEditResourceData(): UseEditResourceDataReturn {
  const { store } = useStore();
  const { run, isPending: isEditing, error, reset } = useLatestCall<TError>();

  const editResourceData = useCallback(
    (records: TResourceEditInput | TResourceEditInput[]) => run(() => store.editResourceData(records)),
    [run, store]
  );

  return { editResourceData, isEditing, error, reset };
}
