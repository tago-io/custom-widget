import type {
  TagoDashboardError,
  TCallOptions,
  TEndpointCallResult,
  TEndpointRequest,
} from "@tago-io/custom-dashboard";
import { useCallback, useRef, useState } from "react";

import { toDashboardError } from "../utils.js";
import { useDashboardClient } from "./use-dashboard-client.js";

export type TUseCallEndpointReturn = {
  /**
   * Resolves the Endpoint's answer for every HTTP status, 4xx and 5xx included, so check `status` before reading
   * `body`. Rejects, with the same error it puts in `error`, only when the call did not complete. Every call is sent:
   * two identical calls are two requests.
   */
  callEndpoint: <TBody = unknown>(
    analysisID: string,
    request?: TEndpointRequest,
    options?: TCallOptions
  ) => Promise<TEndpointCallResult<TBody>>;
  /** True while the latest call waits for its answer. */
  isCalling: boolean;
  /** The latest call's rejection. An HTTP 4xx or 5xx answer resolves and leaves it null. */
  error: TagoDashboardError | null;
  /** Back to idle. A call in flight still settles its own promise but no longer changes `isCalling` or `error`. */
  reset: () => void;
};

/**
 * Call an Analysis Endpoint, typically to save a form. `isCalling` and `error` follow only the latest call.
 *
 * No mounted guard: an answer that lands while StrictMode replays effects or a hidden `<Activity>` holds the caller
 * must still clear `isCalling`, and React 18 and later ignore an update after unmount.
 */
export function useCallEndpoint(): TUseCallEndpointReturn {
  const client = useDashboardClient();
  const [isCalling, setIsCalling] = useState(false);
  const [error, setError] = useState<TagoDashboardError | null>(null);
  const latestCall = useRef(0);

  const callEndpoint = useCallback(
    async <TBody = unknown>(
      analysisID: string,
      request?: TEndpointRequest,
      options?: TCallOptions
    ): Promise<TEndpointCallResult<TBody>> => {
      const call = (latestCall.current += 1);
      setIsCalling(true);
      setError(null);
      try {
        const answer = await client.endpoint.call<TBody>(analysisID, request, options);
        if (call === latestCall.current) {
          setIsCalling(false);
        }
        return answer;
      } catch (cause) {
        const failure = toDashboardError(cause);
        if (call === latestCall.current) {
          setError(failure);
          setIsCalling(false);
        }
        throw failure;
      }
    },
    [client]
  );

  const reset = useCallback(() => {
    latestCall.current += 1;
    setIsCalling(false);
    setError(null);
  }, []);

  return { callEndpoint, isCalling, error, reset };
}
