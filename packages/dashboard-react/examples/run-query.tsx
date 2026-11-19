/**
 * Run Query Example
 *
 * The smallest useful shell: list the profile's saved TagoSQL queries, let the user pick
 * one, run it, and render the result.
 *
 * Wrap your app in <DashboardProvider> once, then use useSqlQueries / useSqlQuery.
 */

import { DashboardProvider, useSqlQueries, useSqlQuery } from "@tago-io/custom-dashboard-react";
import React, { useState } from "react";

function App() {
  return (
    <DashboardProvider>
      <QueryRunner />
    </DashboardProvider>
  );
}

function QueryRunner() {
  const { queries, isLoading: loadingQueries, error: queriesError } = useSqlQueries();
  const [queryID, setQueryID] = useState<string | null>(null);

  // Passing null keeps the hook idle — nothing is requested until a query is picked.
  const { data, isLoading, error, refetch } = useSqlQuery(queryID);

  if (loadingQueries) {
    return <p style={{ padding: 20 }}>Loading queries…</p>;
  }
  if (queriesError) {
    // error.message is the server's own text. Render it as text, never as HTML.
    return <p style={{ padding: 20, color: "#dc2626" }}>{queriesError.message}</p>;
  }

  return (
    <div style={{ padding: 20, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <select value={queryID ?? ""} onChange={(event) => setQueryID(event.target.value || null)}>
          <option value="">Pick a query…</option>
          {queries.map((query) => (
            <option key={query.id} value={query.id}>
              {query.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => void refetch()} disabled={!queryID || isLoading}>
          {isLoading ? "Running…" : "Run"}
        </button>
      </div>

      {error && <p style={{ color: "#dc2626" }}>{error.message}</p>}

      {data && (
        <>
          <p style={{ fontSize: 12, color: "#667" }}>
            {data.rows.length} rows · {data.meta.execution_ms ?? "?"} ms
            {data.meta.served_from_cache ? " · cached" : ""}
          </p>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                {data.columns.map((column) => (
                  <th key={column} style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, index) => (
                <tr key={index}>
                  {data.columns.map((column) => (
                    <td key={column} style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                      {formatCell(row[column])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

/** Row values are `unknown` by contract — nothing validates them — so narrow before printing. */
function formatCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value) ?? "";
}

export default App;
