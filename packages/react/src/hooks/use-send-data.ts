import type { TData, TDataRecordInput, TError } from "@tago-io/custom-widget-core";
import { useCallback, useRef, useState } from "react";
import { useStore } from "./use-store-selector.js";

export interface UseSendDataReturn {
  sendData: (records: TDataRecordInput | TDataRecordInput[]) => Promise<TData>;
  isSending: boolean;
  error: TError | null;
  reset: () => void;
}

export function useSendData(): UseSendDataReturn {
  const { store } = useStore();
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<TError | null>(null);
  const mountedRef = useRef(true);

  const sendData = useCallback(
    async (records: TDataRecordInput | TDataRecordInput[]) => {
      setIsSending(true);
      setError(null);
      try {
        const result = await store.sendData(records);
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
    [store]
  );

  const reset = useCallback(() => {
    setIsSending(false);
    setError(null);
  }, []);

  return { sendData, isSending, error, reset };
}
