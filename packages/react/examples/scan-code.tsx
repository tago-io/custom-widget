/**
 * Scan Code Example
 *
 * Shows how to ask the TagoIO mobile app to scan a QR code or a barcode.
 * This is the React equivalent of the JavaScript "scan-code.html" example.
 *
 * The scanner is not wrapped by the SDK, so the request and the reply are plain
 * postMessage. The SDK's own listener ignores these messages, so a listener of
 * your own runs happily alongside TagoIOProvider.
 */

import { TagoIOProvider } from "@tago-io/custom-widget-react";
import React, { useEffect, useRef, useState } from "react";

type ScanMethod = "barcode" | "qrcode";

function App() {
  return (
    <TagoIOProvider>
      <Scanner />
    </TagoIOProvider>
  );
}

function Scanner() {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState("Pick one to start.");
  const [sent, setSent] = useState("");

  // The reply carries no correlation key, so only one request is kept in flight.
  const pendingRef = useRef<ScanMethod | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      // Opened outside a dashboard, `window.parent` is this same window, so the request
      // arrives here too. Inside a dashboard the host is a different window.
      if (event.source === window) {
        return;
      }

      const message = event.data as { method?: string; data?: unknown } | null;
      if (!message || (message.method !== "barcode" && message.method !== "qrcode")) {
        return;
      }

      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
      pendingRef.current = null;

      if (typeof message.data !== "string" || message.data === "") {
        setStatus(`The scanner answered "${message.method}" with no value.`);
        return;
      }

      setValue(message.data);
      setStatus(`Scanned with "${message.method}", ${message.data.length} characters.`);
    }

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  function requestScan(method: ScanMethod) {
    pendingRef.current = method;
    setSent(`sent { method: "${method}" }`);
    setStatus("Waiting for the scanner...");

    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }
    // The platform drops the request in silence outside the mobile app, so nothing
    // ever answers there. Say so rather than waiting forever.
    timeoutRef.current = window.setTimeout(() => {
      if (pendingRef.current) {
        pendingRef.current = null;
        setStatus(
          "No answer. The scanner only opens inside the TagoIO mobile app; anywhere else the request is ignored."
        );
      }
    }, 5000);

    window.parent.postMessage({ method }, "*");
  }

  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: 20 }}>
      <h1>Scan a QR code or a barcode</h1>
      <p>
        Both buttons open the same scanner in the TagoIO mobile app. The reply carries back whichever method you asked
        for.
      </p>

      <button
        type="button"
        onClick={() => requestScan("barcode")}
        style={{ fontSize: 16, padding: "12px 16px", marginRight: 8 }}
      >
        Scan barcode
      </button>
      <button type="button" onClick={() => requestScan("qrcode")} style={{ fontSize: 16, padding: "12px 16px" }}>
        Scan QR code
      </button>

      <p style={{ color: "#555", fontFamily: "monospace", fontSize: 13 }}>{sent}</p>
      <p style={{ color: "#555" }}>{status}</p>

      <h3>Scanned value</h3>
      <div
        style={{ fontFamily: "monospace", fontSize: 20, wordBreak: "break-all", border: "1px solid #ddd", padding: 10 }}
      >
        {value || "-"}
      </div>
    </div>
  );
}

export default App;
