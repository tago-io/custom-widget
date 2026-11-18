import type { TEndpointCallError, TEndpointCallOptions, TEndpointCallResult } from "@tago-io/custom-widget-core";
import { useCallback } from "react";

import { useLatestCall } from "./use-latest-call.js";
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
  const { run, isPending: isCalling, error, reset } = useLatestCall<TEndpointCallError>();

  const callEndpoint = useCallback(
    <TBody = unknown>(endpointID: string, options?: TEndpointCallOptions) =>
      run(() => store.callEndpoint<TBody>(endpointID, options)),
    [run, store]
  );

  return { callEndpoint, isCalling, error, reset };
}
