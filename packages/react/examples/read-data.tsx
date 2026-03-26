/**
 * Read Data Example
 *
 * Shows how to display real-time data from TagoIO devices.
 * This is the React equivalent of the JavaScript "read-data.html" example.
 *
 * Wrap your app in <TagoIOProvider> and use the useWidget / useRealtimeData
 * hooks to access widget configuration and live data.
 */

import { TagoIOProvider, useWidget, useRealtimeData } from "@tago-io/custom-widget-react";
import React from "react";

function App() {
  return (
    <TagoIOProvider>
      <Dashboard />
    </TagoIOProvider>
  );
}

function Dashboard() {
  const { widget, isLoading } = useWidget();
  const { records, eventCount } = useRealtimeData();

  if (isLoading) {
    return <p style={{ padding: 20 }}>Waiting for data...</p>;
  }

  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: 20 }}>
      <h1>{widget?.label || "My Widget"}</h1>
      <p style={{ background: "#f0f0f0", padding: 10 }}>Data updates received: {eventCount}</p>

      {records.length === 0 ? (
        <p>No data received yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {records.map((record) => (
            <li
              key={record.id}
              style={{
                border: "1px solid #ddd",
                padding: 10,
                marginBottom: 8,
              }}
            >
              <strong>{record.variable}</strong>: {record.value} {record.unit || ""}
              <br />
              <small>Time: {new Date(record.time).toLocaleString()}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default App;
