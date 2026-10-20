import type { TEndpointCallError, TEndpointCallOptions, TEndpointCallResult } from "@tago-io/custom-widget-core";
import { useCallback, useRef, useState } from "react";

import { useStore } from "./use-store-selector.js";

export interface UseCallEndpointReturn {
  callEndpoint: <TBody = unknown>(
    endpointID: string,
    options?: TEndpointCallOptions
  ) => Promise<TEndpointCallResult<TBody>>;
  /** True while the latest call waits for its answer. */
  isCalling: boolean;
  /** The latest call's rejection. An HTTP 4xx or 5xx answer resolves and leaves it null. */
  error: TEndpointCallError | null;
  /** Back to idle. A call in flight still settles its own promise but no longer changes isCalling or error. */
  reset: () => void;
}

export function useCallEndpoint(): UseCallEndpointReturn {
  const { store } = useStore();
  const [isCalling, setIsCalling] = useState(false);
  const [error, setError] = useState<TEndpointCallError | null>(null);
  // Numbers the calls so isCalling and error follow only the latest one, and so reset() can detach a call
  // in flight: that call still settles its own promise but no longer writes state.
  const latestCall = useRef(0);

  const callEndpoint = useCallback(
    async <TBody = unknown>(endpointID: string, options?: TEndpointCallOptions) => {
      latestCall.current += 1;
      const call = latestCall.current;
      setIsCalling(true);
      setError(null);
      try {
        const result = await store.callEndpoint<TBody>(endpointID, options);
        if (call === latestCall.current) setIsCalling(false);
        return result;
      } catch (err) {
        if (call === latestCall.current) {
          setError(err as TEndpointCallError);
          setIsCalling(false);
        }
        throw err;
      }
    },
    [store]
  );

  const reset = useCallback(() => {
    latestCall.current += 1;
    setIsCalling(false);
    setError(null);
  }, []);

  return { callEndpoint, isCalling, error, reset };
}
