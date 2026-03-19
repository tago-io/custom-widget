/**
 * Read Resource Example
 *
 * Shows how to access user information and blueprint devices.
 * This is the React equivalent of the JavaScript "read-resource.html" example.
 *
 * useUserInformation gives you the current user's language, token, and run URL.
 * useBlueprintDevices gives you the blueprint device configurations and selections.
 */

import React from "react";
import {
  TagoIOProvider,
  useWidget,
  useUserInformation,
  useBlueprintDevices,
} from "@tago-io/custom-widget-react";

function App() {
  return (
    <TagoIOProvider>
      <ResourceViewer />
    </TagoIOProvider>
  );
}

function ResourceViewer() {
  const { widget, isLoading, variables } = useWidget();
  const { language, token, runURL } = useUserInformation();
  const { settings, selected } = useBlueprintDevices();

  if (isLoading) {
    return <p style={{ padding: 20 }}>Loading widget...</p>;
  }

  const sectionStyle = {
    margin: "20px 0",
    padding: 15,
    background: "#f9f9f9",
    border: "1px solid #ddd",
  };

  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: 20 }}>
      <h1>Resource Viewer</h1>

      {/* Widget Configuration */}
      <div style={sectionStyle}>
        <h3>Widget Configuration</h3>
        <p><strong>Widget ID:</strong> {widget?.id}</p>
        <p><strong>Dashboard ID:</strong> {widget?.dashboard}</p>
        <p><strong>Label:</strong> {widget?.label || "No label"}</p>
        <p><strong>Variables:</strong></p>
        {variables.length > 0 ? (
          <ul>
            {variables.map((v) => (
              <li key={`${v.origin.id}-${v.variable}`}>
                {v.variable} (Device: {v.origin.id})
              </li>
            ))}
          </ul>
        ) : (
          <p>No variables configured.</p>
        )}
      </div>

      {/* User Information */}
      <div style={sectionStyle}>
        <h3>User Information</h3>
        <p><strong>Language:</strong> {language || "Not available"}</p>
        <p><strong>Has Token:</strong> {token ? "Yes" : "No"}</p>
        <p><strong>Run URL:</strong> {runURL || "Not available"}</p>
      </div>

      {/* Blueprint Devices */}
      <div style={sectionStyle}>
        <h3>Blueprint Devices</h3>
        {settings.length > 0 ? (
          <ul>
            {settings.map((device) => (
              <li key={device.id}>
                <strong>{device.name}</strong> (ID: {device.id})
              </li>
            ))}
          </ul>
        ) : (
          <p>No blueprint devices available.</p>
        )}

        {Object.keys(selected).length > 0 && (
          <>
            <p><strong>Selected devices:</strong></p>
            <ul>
              {Object.entries(selected).map(([key, entry]) => (
                <li key={key}>{key}: {entry?.name ?? "None"}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
