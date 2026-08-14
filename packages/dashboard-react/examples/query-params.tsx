/**
 * Query Parameters Example
 *
 * TagoSQL parameters are positional (`$1`, `$2`, …) and every value is a string. The SDK
 * passes them through exactly as given — it does not reshape or convert them.
 *
 * A saved query stores a default for every placeholder, so you can send a subset and let
 * the stored defaults fill the rest.
 */

import { DashboardProvider, useSqlQuery, type TQueryParam } from "@tago-io/custom-dashboard-react";
import React, { useState } from "react";

const QUERY_ID = "0000000000000000000000aa"; // 24 chars, from sql.list

function App() {
  return (
    <DashboardProvider>
      <FilteredReadings />
    </DashboardProvider>
  );
}

function FilteredReadings() {
  const [days, setDays] = useState("30");

  // Values are strings because the API takes strings. A Date becomes date.toISOString().
  const params: TQueryParam[] = [{ key: "$1", value: days }];

  // A fresh array literal every render is fine: the hook keys off the serialized contents,
  // not the array's identity, so this does not refire on unrelated re-renders.
  const { data, isLoading, error } = useSqlQuery(QUERY_ID, params);

  return (
    <div style={{ padding: 20, fontFamily: "system-ui, sans-serif" }}>
      <label>
        Last{" "}
        <select value={days} onChange={(event) => setDays(event.target.value)}>
          <option value="7">7</option>
          <option value="30">30</option>
          <option value="90">90</option>
        </select>{" "}
        days
      </label>

      {isLoading && <p>Running…</p>}

      {/* `bad_params` also covers timeouts, rate limits and plan limits, so show the
          server's message rather than guessing what went wrong. */}
      {error && <p style={{ color: "#dc2626" }}>{error.message}</p>}

      {data && (
        <ul>
          {data.rows.map((row, index) => (
            <li key={index}>{JSON.stringify(row)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default App;
