/**
 * Theme Example
 *
 * The SDK reports the host's theme; applying it is yours, because your CSS contract is not
 * the SDK's to invent. Two halves matter:
 *
 * 1. The first paint. The host puts the theme on the shell URL, so a one-line script in
 *    <head> beats an effect — a bundled entry is deferred and would paint the wrong theme
 *    first. Put this in your index.html, before the module script:
 *
 *      <script>
 *        document.documentElement.dataset.theme =
 *          new URLSearchParams(location.search).get("theme") === "dark" ? "dark" : "light";
 *      </script>
 *
 * 2. Later changes, which is what useTheme is for.
 */

import { DashboardProvider, useTheme } from "@tago-io/custom-dashboard-react";
import React, { useEffect } from "react";

function App() {
  return (
    <DashboardProvider>
      <ThemedShell />
    </DashboardProvider>
  );
}

function ThemedShell() {
  const theme = useTheme();

  // Mirror it wherever your styles expect it — a data attribute, a class, both.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // This re-renders only when the theme really changes. The host re-sends the current theme
  // on any <html> class mutation on its side, and the SDK filters those out.
  return (
    <div style={{ padding: 20, fontFamily: "system-ui, sans-serif" }}>
      <p>Host theme: {theme}</p>
      <Chart theme={theme} />
    </div>
  );
}

/** Anything that needs the value in JS rather than in CSS — a chart library, a canvas. */
function Chart({ theme }: { theme: "dark" | "light" }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 8,
        background: theme === "dark" ? "#0b0b0c" : "#ffffff",
        color: theme === "dark" ? "#f4f4f5" : "#111114",
        border: "1px solid #8884",
      }}
    >
      Rendered for the {theme} theme
    </div>
  );
}

export default App;
