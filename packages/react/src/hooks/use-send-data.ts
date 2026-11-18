import { type TData, type TDataRecordInput, type TError, autoFillRecords } from "@tago-io/custom-widget-core";
import { useCallback } from "react";

import { useLatestCall } from "./use-latest-call.js";
import { useStore } from "./use-store-selector.js";
import { useWidget } from "./use-widget.js";

export interface UseSendDataReturn {
  sendData: (records: TDataRecordInput | TDataRecordInput[]) => Promise<TData>;
  /** True while the latest call waits for its answer. */
  isSending: boolean;
  /**
   * The latest call's rejection: the dashboard's failure reply, or an Error when the request could not be posted
   * or the provider unmounted before the answer.
   */
  error: TError | Error | null;
  /** Back to idle. A call in flight still settles its own promise but no longer changes isSending or error. */
  reset: () => void;
}

export function useSendData(): UseSendDataReturn {
  const { store } = useStore();
  const { variables } = useWidget();
  const { run, isPending: isSending, error, reset } = useLatestCall<TError | Error>();

  const sendData = useCallback(
    (records: TDataRecordInput | TDataRecordInput[]) =>
      run(() => {
        const vars = Array.isArray(records) ? records : [records];
        return store.sendData(autoFillRecords(vars, variables));
      }),
    [run, store, variables]
  );

  return { sendData, isSending, error, reset };
}
