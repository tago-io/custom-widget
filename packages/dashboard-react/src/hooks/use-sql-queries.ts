import type { TagoDashboardError, TSqlQuerySummary } from "@tago-io/custom-dashboard";
import { useCallback, useEffect, useRef, useState } from "react";

import { toDashboardError } from "../utils.js";
import { useDashboardClient } from "./use-dashboard-client.js";

export type TUseSqlQueriesReturn = {
  queries: TSqlQuerySummary[];
  isLoading: boolean;
  error: TagoDashboardError | null;
  /** Never throws — the outcome lands in `error`. */
  refetch: () => Promise<void>;
};

export function useSqlQueries(): TUseSqlQueriesReturn {
  const client = useDashboardClient();
  const [queries, setQueries] = useState<TSqlQuerySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<TagoDashboardError | null>(null);
  const runID = useRef(0);

  const refetch = useCallback(async () => {
    const current = (runID.current += 1);
    setIsLoading(true);
    setError(null);

    try {
      const result = await client.sql.list();
      if (current !== runID.current) {
        return;
      }
      setQueries(result);
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
  }, [client]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { queries, isLoading, error, refetch };
}
