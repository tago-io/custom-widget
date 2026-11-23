/**
 * Setpoint Form Example
 *
 * Save a form through an Analysis Endpoint and show its field errors. The Analysis is the one from the docs.tago.io
 * recipe "Validate a Custom Dashboard form":
 * https://docs.tago.io/docs/tagoio/analysis/endpoints/recipes/validate-dashboard-form
 *
 * It answers POST /setpoint with 200 and { ok, setpoint } when the value is from 5 to 30, and with 422 and
 * { errors: { setpoint } } otherwise. A Run user needs Call Endpoint on that Analysis.
 */

import {
  DashboardProvider,
  type TagoDashboardError,
  type TEndpointCallResult,
  useCallEndpoint,
} from "@tago-io/custom-dashboard-react";
import React, { useState } from "react";

// The ID of the Analysis, the 24 characters at the end of its Endpoint URL.
const ANALYSIS_ID = "YOUR_ANALYSIS_ID";

type TSetpointAnswer = { ok?: boolean; setpoint?: number; error?: string; errors?: { setpoint?: string } };

type TFeedback = { kind: "ok" | "error"; text: string } | null;

function App() {
  return (
    <DashboardProvider>
      <SetpointForm />
    </DashboardProvider>
  );
}

function SetpointForm() {
  const { callEndpoint, isCalling } = useCallEndpoint();
  const [setpoint, setSetpoint] = useState("22");
  const [feedback, setFeedback] = useState<TFeedback>(null);

  async function save() {
    setFeedback(null);
    let answer: TEndpointCallResult<TSetpointAnswer | null>;
    try {
      answer = await callEndpoint<TSetpointAnswer | null>(ANALYSIS_ID, {
        method: "POST",
        path: "/setpoint",
        body: { setpoint },
      });
    } catch (error) {
      // The call did not complete, and the hook's `error` holds the same TagoDashboardError. After no_response,
      // aborted or api_error the Analysis may still have run, so do not retry on your own.
      const { code, message } = error as TagoDashboardError;
      setFeedback({ kind: "error", text: `Not completed (${code}): ${message}` });
      return;
    }

    // Every HTTP status resolves, so check it before reading the body. The body is whatever the Analysis answered,
    // or the platform's own error, so read it defensively.
    if (answer.status === 422) {
      setFeedback({ kind: "error", text: answer.body?.errors?.setpoint ?? "Invalid setpoint." });
    } else if (answer.status >= 400) {
      setFeedback({ kind: "error", text: answer.body?.error ?? `Request failed (${answer.status}).` });
    } else {
      const saved = answer.body?.setpoint;
      setFeedback({ kind: "ok", text: typeof saved === "number" ? `Saved: ${saved} C` : "Saved." });
    }
  }

  return (
    <div style={{ margin: 48, fontFamily: "system-ui, sans-serif", fontSize: 18 }}>
      <h1>Room temperature</h1>
      {/* No <form onSubmit>: the dashboard frame blocks native form submission, so a submit event never fires. */}
      <label>
        Setpoint (5 to 30 C)
        <input
          value={setpoint}
          onChange={(event) => setSetpoint(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !isCalling) {
              void save();
            }
          }}
          aria-describedby="feedback"
          style={{ width: "6ch", marginLeft: 8, padding: 10, font: "inherit" }}
        />
      </label>
      <button
        type="button"
        onClick={() => void save()}
        disabled={isCalling}
        style={{ marginLeft: 8, padding: 10, font: "inherit" }}
      >
        {isCalling ? "Saving..." : "Save setpoint"}
      </button>
      {/* Server text renders as text, never through dangerouslySetInnerHTML. */}
      <p
        id="feedback"
        role="status"
        style={{ minHeight: "2em", color: feedback?.kind === "error" ? "#b91c1c" : "#15803d" }}
      >
        {feedback?.text}
      </p>
    </div>
  );
}

export default App;
