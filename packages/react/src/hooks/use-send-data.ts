import { type TData, type TDataRecordInput, type TError, autoFillRecords } from "@tago-io/custom-widget-core";
import { useCallback, useEffect, useRef, useState } from "react";

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
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const sendData = useCallback(
    async (records: TDataRecordInput | TDataRecordInput[]) => {
      setIsSending(true);
      setError(null);
      try {
        const vars = Array.isArray(records) ? records : [records];
        const filled = autoFillRecords(vars, variables);
        const result = await store.sendData(filled);
        if (mountedRef.current) setIsSending(false);
        return result;
      } catch (err) {
        if (mountedRef.current) {
          setError(err as TError);
          setIsSending(false);
        }
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
