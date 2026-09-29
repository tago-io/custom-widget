/**
 * Run Analysis Example
 *
 * Shows how to run the Analysis selected in the widget settings and watch for the data it writes.
 * This is the React equivalent of the JavaScript "run-analysis.html" example.
 *
 * useRunAnalysis returns only { runAnalysis }. The dashboard never replies to it, so the hook
 * has no busy or error state: the only sign the page gets that the Analysis ran is new data,
 * from useRealtimeData, on a variable this widget reads.
 */

import type { TDataRecord } from "@tago-io/custom-widget-react";
import { TagoIOProvider, useRealtimeData, useRunAnalysis, useWidget } from "@tago-io/custom-widget-react";
import React, { useEffect, useState } from "react";

// A slow Analysis, a failed one and one that writes elsewhere all look the same from here,
// so after this long the page gives a hint, not a verdict.
const HINT_AFTER_MS = 30000;

type AnalysisRequest = {
  sentAt: Date;
  scope: object[];
  // Ids of the records on screen when the request went out.
  knownIds: Set<string>;
};

function App() {
  return (
    <TagoIOProvider>
      <AnalysisRunner />
    </TagoIOProvider>
  );
}

function newest(records: TDataRecord[]): TDataRecord | null {
  let latest: TDataRecord | null = null;
  for (const record of records) {
    if (!latest || new Date(record.time) > new Date(latest.time)) {
      latest = record;
    }
  }
  return latest;
}

function describe(record: TDataRecord): string {
  const unit = record.unit ? ` ${record.unit}` : "";
  return `${record.variable} = ${record.value}${unit} at ${new Date(record.time).toLocaleString()}`;
}

function AnalysisRunner() {
  const { widget, variables, isLoading } = useWidget();
  const { records } = useRealtimeData();
  const { runAnalysis } = useRunAnalysis();
  const [request, setRequest] = useState<AnalysisRequest | null>(null);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (request === null) {
      return;
    }
    const hintTimeoutId = window.setTimeout(() => setSlow(true), HINT_AFTER_MS);
    return () => window.clearTimeout(hintTimeoutId);
  }, [request]);

  if (isLoading) {
    return <p style={{ padding: 20 }}>Loading widget...</p>;
  }

  // The dashboard ignores runAnalysis when no Analysis is selected, and analysis_run is the
  // field it checks.
  const hasAnalysis = Boolean(widget?.analysis_run);
  const latest = newest(records);
  // Match by id, not by time: a record's time is whatever its writer set.
  const fresh = request ? newest(records.filter((record) => !request.knownIds.has(record.id))) : null;

  function handleRun() {
    // The Analysis receives this array as its scope. Send plain objects in an array: a string
    // does not arrive as sent, and the dashboard strips the keys source, displayValue and
    // orderingValue (a source value can also rewrite or drop the item).
    // device tells the Analysis which device the widget shows. On a blueprint dashboard it is
    // the selected device, and null while none is selected.
    const scope = [{ device: variables[0]?.origin.id || null, requested_at: new Date().toISOString() }];
    runAnalysis(scope);
    setSlow(false);
    setRequest({ sentAt: new Date(), scope, knownIds: new Set(records.map((record) => record.id)) });
  }

  let status = "";
  if (fresh) {
    status = `New data after the request: ${describe(fresh)}`;
  } else if (request && slow) {
    status =
      `No new data after ${HINT_AFTER_MS / 1000} seconds. ` +
      "Check that the Analysis ran and that it writes to a variable this widget reads.";
  } else if (request) {
    status = `Request sent at ${request.sentAt.toLocaleTimeString()}. Waiting for new data...`;
  }

  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: 20 }}>
      <h1>Run an Analysis</h1>
      <p>
        The button runs the Analysis selected in the widget settings. No reply comes back, so the page watches for new
        data instead.
      </p>

      {hasAnalysis ? null : (
        <p style={{ color: "#7a4f00", background: "#fff8e1", padding: 10 }}>
          No Analysis selected. In the widget settings, open <strong>Options</strong> and pick one under{" "}
          <strong>Run analysis when sending data</strong>.
        </p>
      )}

      <button
        type="button"
        disabled={!hasAnalysis}
        onClick={handleRun}
        style={{ fontSize: 16, padding: "12px 16px", minHeight: 48 }}
      >
        Run Analysis
      </button>

      {status ? <p style={{ background: "#f0f0f0", padding: 10 }}>{status}</p> : null}
      {request ? (
        <p style={{ color: "#555", fontFamily: "monospace", fontSize: 13, wordBreak: "break-all" }}>
          scope: {JSON.stringify(request.scope)}
        </p>
      ) : null}

      <h3>Latest record</h3>
      <div style={{ border: "1px solid #ddd", padding: 10 }}>{latest ? describe(latest) : "No data yet."}</div>
    </div>
  );
}

export default App;
