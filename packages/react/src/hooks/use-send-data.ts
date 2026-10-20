import { type TData, type TDataRecordInput, type TError, autoFillRecords } from "@tago-io/custom-widget-core";
import { useCallback, useState } from "react";

import { useStore } from "./use-store-selector.js";
import { useWidget } from "./use-widget.js";

export interface UseSendDataReturn {
  sendData: (records: TDataRecordInput | TDataRecordInput[]) => Promise<TData>;
  isSending: boolean;
  error: TError | null;
  reset: () => void;
}

export function useSendData(): UseSendDataReturn {
  const { store } = useStore();
  const { variables } = useWidget();
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<TError | null>(null);

  const sendData = useCallback(
    async (records: TDataRecordInput | TDataRecordInput[]) => {
      setIsSending(true);
      setError(null);
      // No mounted guard: a reply that lands while StrictMode replays effects or an <Activity> hides this
      // component must still clear the flag, and React 18 and later ignore an update after unmount.
      try {
        const vars = Array.isArray(records) ? records : [records];
        const filled = autoFillRecords(vars, variables);
        const result = await store.sendData(filled);
        setIsSending(false);
        return result;
      } catch (err) {
        setError(err as TError);
        setIsSending(false);
        throw err;
      }
    },
    [store, variables]
  );

  const reset = useCallback(() => {
    setIsSending(false);
    setError(null);
  }, []);

  return { sendData, isSending, error, reset };
}
