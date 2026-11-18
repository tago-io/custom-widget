import {
  serializeQueryParams,
  type TagoDashboardError,
  type TQueryParam,
  type TSqlRow,
  type TSqlRunResult,
} from "@tago-io/custom-dashboard";
import { useCallback, useEffect, useRef, useState } from "react";

import { toDashboardError } from "../utils.js";
import { useDashboardClient } from "./use-dashboard-client.js";

export type TUseSqlQueryReturn<TRow extends TSqlRow = TSqlRow> = {
  /**
   * Kept across a refetch of the same query, so the table does not blink on every refresh.
   * Null from the very render that changes the query identity, with `isLoading` already true,
   * because rows from the previous query rendered under the new one's identity is worse than an
   * empty table, and an idle empty table would read as "no rows" for a moment.
   */
  data: TSqlRunResult<TRow> | null;
  isLoading: boolean;
  error: TagoDashboardError | null;
  /** Never throws — the outcome lands in `error`. */
  refetch: () => Promise<void>;
};

/** State is tagged with the query it describes, so a render for another query never shows it. */
type TQueryState<TRow extends TSqlRow> = {
  identity: string;
  data: TSqlRunResult<TRow> | null;
  error: TagoDashboardError | null;
  isLoading: boolean;
};

function freshState<TRow extends TSqlRow>(identity: string, queryID: string | null | undefined): TQueryState<TRow> {
  return { identity, data: null, error: null, isLoading: Boolean(queryID) };
}

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
  const paramsKey = serializeQueryParams(params);
  const identity = `${queryID ?? ""}|${paramsKey}`;
  const timeoutMs = options?.timeoutMs;

  const [state, setState] = useState<TQueryState<TRow>>(() => freshState(identity, queryID));
  const runID = useRef(0);

  // refetch keys off paramsKey, not the array, so it reads the array from here. Written in an
  // effect, never during render, and declared before the effect that runs the query, which
  // therefore always sees the params of the same commit.
  const paramsRef = useRef(params);
  useEffect(() => {
    paramsRef.current = params;
  });

  const refetch = useCallback(async () => {
    const current = (runID.current += 1);

    // Both updates hand back the previous state when nothing would change, so a mount does not
    // cost a second render that shows the same thing.
    if (!queryID) {
      setState((previous) => (previous.identity === identity ? previous : freshState(identity, queryID)));
      return;
    }

    setState((previous) => {
      if (previous.identity === identity && previous.isLoading && previous.error === null) {
        return previous;
      }
      // Retention is for a refetch of the same query only.
      return { identity, data: previous.identity === identity ? previous.data : null, error: null, isLoading: true };
    });

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
      setState({ identity, data: result, error: null, isLoading: false });
    } catch (cause) {
      if (current !== runID.current) {
        return;
      }
      setState((previous) => ({
        identity,
        data: previous.identity === identity ? previous.data : null,
        error: toDashboardError(cause),
        isLoading: false,
      }));
    }
  }, [client, queryID, identity, timeoutMs]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  // Until the effect above starts the new run, the state still describes the previous query.
  // Reading it as a fresh, loading state for the new one means no commit ever shows the old rows
  // or an idle empty result, and nothing has to be reset during render.
  const shown = state.identity === identity ? state : freshState<TRow>(identity, queryID);

  return { data: shown.data, isLoading: shown.isLoading, error: shown.error, refetch };
}
