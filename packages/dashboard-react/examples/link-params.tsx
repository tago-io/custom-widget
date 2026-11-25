/**
 * Link Parameters Example
 *
 * Open the dashboard from a link such as `/dashboards/<id>?device=<device id>`. The host forwards
 * that querystring, and this component scopes a saved query to the device. Change the URL without
 * a reload and the query reruns for the new device.
 *
 * Every value is a string, so it goes straight into a TagoSQL param.
 */

import { DashboardProvider, useDashboardParams, useSqlQuery } from "@tago-io/custom-dashboard-react";
import React from "react";

const QUERY_ID = "0000000000000000000000aa"; // a saved query whose $1 is a device id

function App() {
  return (
    <DashboardProvider>
      <DeviceReadings />
    </DashboardProvider>
  );
}

function DeviceReadings() {
  const { device } = useDashboardParams();

  // `null` keeps the hook idle until the link names a device.
  const { data, isLoading, error } = useSqlQuery(
    device ? QUERY_ID : null,
    device ? [{ key: "$1", value: device }] : []
  );

  if (!device) {
    // Also the first render on a scoped link: the host sends the params after the handshake.
    return <p style={{ padding: 20 }}>No device on the link.</p>;
  }

  return (
    <div style={{ padding: 20, fontFamily: "system-ui, sans-serif" }}>
      <p>Device {device}</p>
      {isLoading && <p>Running…</p>}
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
