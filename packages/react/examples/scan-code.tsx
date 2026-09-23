/**
 * Scan Code Example
 *
 * Shows how to ask the TagoRUN mobile app to scan a QR code or a barcode.
 * This is the React equivalent of the JavaScript "scan-code.html" example.
 *
 * The scanner is not wrapped by the SDK, so the request and the reply are plain
 * postMessage. The SDK's own listener ignores these messages, so a listener of
 * your own runs happily alongside TagoIOProvider.
 */

import { TagoIOProvider } from "@tago-io/custom-widget-react";
import React, { useEffect, useState } from "react";

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
  // The reply carries no `key`, so two requests' replies cannot be told apart.
  // Keep exactly one request in flight: the buttons stay locked while this is set.
  const [pending, setPending] = useState<ScanMethod | null>(null);

  // Listen only while a request is pending. Once the reply lands or the user stops
  // waiting, the cleanup removes the listener, so a late reply is ignored.
  useEffect(() => {
    if (pending === null) {
      return;
    }

    // Inside the app the reply only comes once the user has scanned, which can take a
    // while. Outside the app it never comes, because the platform drops the request in
    // silence. The page cannot tell the two apart, so this is a hint, not a verdict.
    // A second reply can land before the re-render removes this listener; take only the first.
    let answered = false;

    const hintTimeoutId = window.setTimeout(() => {
      setStatus("Still waiting. Outside the mobile app, nothing ever answers.");
    }, 5000);

    function onMessage(event: MessageEvent) {
      // Opened outside a dashboard, `window.parent` is this same window, so the request
      // arrives here too. Inside a dashboard the host is a different window.
      if (event.source === window) {
        return;
      }

      // The reply echoes the method that was asked for and carries the decoded string
      // in `data`.
      const message = event.data as { method?: string; data?: unknown } | null;
      if (!message || (message.method !== "barcode" && message.method !== "qrcode")) {
        return;
      }

      if (answered) {
        return;
      }
      answered = true;
      setPending(null);

      if (typeof message.data !== "string" || message.data === "") {
        setStatus(`The scanner answered "${message.method}" with no value.`);
        return;
      }

      setValue(message.data);
      setStatus(`Scanned with "${message.method}", ${message.data.length} characters.`);
    }

    window.addEventListener("message", onMessage);
    return () => {
      window.clearTimeout(hintTimeoutId);
      window.removeEventListener("message", onMessage);
    };
  }, [pending]);

  function requestScan(method: ScanMethod) {
    setPending(method);
    setSent(`sent { method: "${method}" }`);
    setStatus("Waiting for the scanner...");
    window.parent.postMessage({ method }, "*");
  }

  // The platform documents no reply for a scan the user cancels, so the page needs
  // its own way out.
  function stopWaiting() {
    setPending(null);
    setStatus("Stopped waiting. A reply that arrives now is ignored.");
  }

  const buttonStyle = { fontSize: 16, padding: "12px 16px", marginRight: 8 };

  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: 20 }}>
      <h1>Scan a QR code or a barcode</h1>
      <p>
        Both buttons open the same scanner in the TagoRUN mobile app. The reply carries back whichever method you asked
        for.
      </p>

      <button type="button" disabled={pending !== null} onClick={() => requestScan("barcode")} style={buttonStyle}>
        Scan barcode
      </button>
      <button type="button" disabled={pending !== null} onClick={() => requestScan("qrcode")} style={buttonStyle}>
        Scan QR code
      </button>
      {pending !== null ? (
        <button type="button" onClick={stopWaiting} style={buttonStyle}>
          Stop waiting
        </button>
      ) : null}

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
