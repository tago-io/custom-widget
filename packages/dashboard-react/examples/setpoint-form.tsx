/**
 * Setpoint Form Example
 *
 * Save a form through an Analysis Endpoint and show its field errors. The Analysis is the one from the docs.tago.io
 * recipe "Validate a Custom Dashboard form":
 * https://docs.tago.io/docs/tagoio/analysis/endpoints/recipes/validate-dashboard-form
 *
 * It answers POST /setpoint with 200 and { ok, setpoint } when the value is from 5 to 30, with 422 and
 * { errors: { setpoint } } otherwise, and with another 4xx and { error } when the caller cannot save. A Run user needs
 * Call Endpoint on that Analysis.
 *
 * There is no <form onSubmit>: the dashboard frame blocks native form submission, so the button and Enter save instead.
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

/** What the recipe's Analysis answers. The platform answers some errors itself, so every field is optional. */
type TSetpointAnswer = { ok?: boolean; setpoint?: number; error?: string; errors?: { setpoint?: string } } | null;

type TFeedback = { kind: "ok" | "error"; text: string };

/** Every HTTP status resolves, so branch on it before reading the body. */
function describeAnswer({ status, body }: TEndpointCallResult<TSetpointAnswer>, setpoint: string): TFeedback {
  if (status === 422) {
    return { kind: "error", text: body?.errors?.setpoint ?? "Invalid setpoint." };
  }
  if (status >= 400) {
    return { kind: "error", text: body?.error ?? `Request failed (${status}).` };
  }
  return { kind: "ok", text: `Saved: ${body?.setpoint ?? setpoint} C` };
}

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
  const [feedback, setFeedback] = useState<TFeedback | null>(null);

  async function save() {
    if (isCalling) return;
    setFeedback(null);

    try {
      const answer = await callEndpoint<TSetpointAnswer>(ANALYSIS_ID, {
        method: "POST",
        path: "/setpoint",
        body: { setpoint },
      });
      setFeedback(describeAnswer(answer, setpoint));
    } catch (error) {
      // The call did not complete; the hook's `error` holds the same TagoDashboardError. After no_response, aborted
      // or api_error the Analysis may still have run, so do not retry on your own.
      const { code, message } = error as TagoDashboardError;
      setFeedback({ kind: "error", text: `Not completed (${code}): ${message}` });
    }
  }

  return (
    <div style={{ margin: 48, fontFamily: "system-ui, sans-serif", fontSize: 18 }}>
      <h1>Room temperature</h1>
      <label>
        Setpoint (5 to 30 C)
        <input
          value={setpoint}
          onChange={(event) => setSetpoint(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void save();
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
