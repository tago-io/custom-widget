/**
 * Scan Code Example
 *
 * Shows how to ask the dashboard to scan a QR code or a barcode.
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

    // A second reply can land before the re-render removes this listener; take only the first.
    let answered = false;

    // The reply comes once the user scans or cancels, which can take a while. A host
    // with no scanner never answers. The page cannot tell the two apart, so this is a
    // hint, not a verdict.
    const hintTimeoutId = window.setTimeout(() => {
      setStatus("Still waiting. If no scanner opened, nothing will answer. Press Stop waiting.");
    }, 5000);

    function onMessage(event: MessageEvent) {
      // Only the host page answers, and it is this widget's parent window. Opened on its
      // own, `window.parent` is this same window, so no message is a reply.
      if (window.parent === window || event.source !== window.parent) {
        return;
      }

      // The reply echoes the method that was asked for, so a message with any other
      // method is not the answer.
      const message = event.data as { method?: string; data?: string } | null;
      if (!message || message.method !== pending) {
        return;
      }

      if (answered) {
        return;
      }
      answered = true;
      // The cleanup that clears the hint only runs after the re-render, so clear it here or
      // it can land on top of the result.
      window.clearTimeout(hintTimeoutId);
      setPending(null);

      // `data` holds the decoded string, or "" when the user canceled.
      if (!message.data) {
        setStatus("Scan canceled.");
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

  // A cancel answers with an empty `data`, but an older host or app may never answer,
  // so the page keeps its own way out.
  function stopWaiting() {
    setPending(null);
    setStatus("Stopped waiting. A reply that arrives now is ignored.");
  }

  const buttonStyle = { fontSize: 16, padding: "12px 16px", marginRight: 8 };

  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: 20 }}>
      <h1>Scan a QR code or a barcode</h1>
      <p>
        Either button reads QR codes and barcodes. The TagoRUN mobile app opens its own scanner, and a browser opens a
        camera scanner on the page. The reply carries back whichever method you asked for.
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
