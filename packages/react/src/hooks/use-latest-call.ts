import { useCallback, useRef, useState } from "react";

export interface UseLatestCallReturn<TCallError> {
  /** True while the latest call waits for its answer. */
  isPending: boolean;
  /** The latest call's rejection. */
  error: TCallError | null;
  /** Runs `operation` as the latest call and settles with it, rethrowing its rejection. */
  run: <TResult>(operation: () => Promise<TResult>) => Promise<TResult>;
  /** Back to idle. A call in flight still settles its own promise but no longer changes isPending or error. */
  reset: () => void;
}

/**
 * The busy flag and error of a mutation hook. Calls are numbered so the state follows only the latest one, and so
 * reset() can detach a call in flight.
 *
 * No mounted guard: a reply that lands while StrictMode replays effects or an <Activity> hides the component must
 * still clear the flag, and React 18 and later ignore an update after unmount.
 */
export function useLatestCall<TCallError>(): UseLatestCallReturn<TCallError> {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<TCallError | null>(null);
  const latestCall = useRef(0);

  const run = useCallback(async <TResult>(operation: () => Promise<TResult>): Promise<TResult> => {
    latestCall.current += 1;
    const call = latestCall.current;
    setIsPending(true);
    setError(null);
    try {
      const result = await operation();
      if (call === latestCall.current) setIsPending(false);
      return result;
    } catch (err) {
      if (call === latestCall.current) {
        setError(err as TCallError);
        setIsPending(false);
      }
      throw err;
    }
  }, []);

  const reset = useCallback(() => {
    latestCall.current += 1;
    setIsPending(false);
    setError(null);
  }, []);

  return { isPending, error, run, reset };
}
