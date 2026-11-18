import { type TData, type TDataRecordInput, type TError, autoFillRecords } from "@tago-io/custom-widget-core";
import { useCallback } from "react";

import { useLatestCall } from "./use-latest-call.js";
import { useStore } from "./use-store-selector.js";
import { useWidget } from "./use-widget.js";

export interface UseEditDataReturn {
  editData: (records: TDataRecordInput | TDataRecordInput[]) => Promise<TData>;
  /** True while the latest call waits for its answer. */
  isEditing: boolean;
  /** The latest call's rejection. */
  error: TError | null;
  /** Back to idle. A call in flight still settles its own promise but no longer changes isEditing or error. */
  reset: () => void;
}

export function useEditData(): UseEditDataReturn {
  const { store } = useStore();
  const { variables } = useWidget();
  const { run, isPending: isEditing, error, reset } = useLatestCall<TError>();

  const editData = useCallback(
    (records: TDataRecordInput | TDataRecordInput[]) =>
      run(() => {
        const vars = Array.isArray(records) ? records : [records];
        return store.editData(autoFillRecords(vars, variables));
      }),
    [run, store, variables]
  );

  return { editData, isEditing, error, reset };
}
