import {
  serializeQueryParams,
  type TagoDashboardError,
  type TQueryParam,
  type TSqlRow,
  type TSqlRunResult,
} from "@tago-io/custom-dashboard";
import { useCallback, useEffect, useRef, useState } from "react";

import { useDashboardClient } from "./use-dashboard-client.js";
import { toDashboardError } from "./use-sql-queries.js";

export type TUseSqlQueryReturn<TRow extends TSqlRow = TSqlRow> = {
  /** Kept across a refetch, so the table does not blink on every refresh. */
  data: TSqlRunResult<TRow> | null;
  isLoading: boolean;
  error: TagoDashboardError | null;
  /** Never throws — the outcome lands in `error`. */
  refetch: () => Promise<void>;
};

/**
 * Run a saved TagoSQL query. Pass `null` to stay idle.
 *
 * `params` is the wire shape, `[{ key: "$1", value: "30" }]`. A fresh array literal every
 * render is fine: the effect keys off a serialized form, not the array's identity.
 */
export function useSqlQuery<TRow extends TSqlRow = TSqlRow>(
  queryID: string | null | undefined,
  params?: TQueryParam[],
  options?: { timeoutMs?: number }
): TUseSqlQueryReturn<TRow> {
  const client = useDashboardClient();
  const [data, setData] = useState<TSqlRunResult<TRow> | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(queryID));
  const [error, setError] = useState<TagoDashboardError | null>(null);

  const paramsKey = serializeQueryParams(params);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const timeoutMs = options?.timeoutMs;
  const runID = useRef(0);

  const refetch = useCallback(async () => {
    const current = (runID.current += 1);

    if (!queryID) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await client.sql.run<TRow>(
        queryID,
        paramsRef.current,
        timeoutMs === undefined ? undefined : { timeoutMs }
      );
      // A superseded run must not overwrite a newer one; there is no cancel in the protocol.
      if (current !== runID.current) {
        return;
      }
      setData(result);
    } catch (cause) {
      if (current !== runID.current) {
        return;
      }
      setError(toDashboardError(cause));
    } finally {
      if (current === runID.current) {
        setIsLoading(false);
      }
    }
    // paramsKey is deliberately a dependency the callback never reads. It stands in for
    // `params`, whose array identity changes on every render while its contents do not —
    // depending on the array itself would refire the query forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, queryID, paramsKey, timeoutMs]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, isLoading, error, refetch };
}
