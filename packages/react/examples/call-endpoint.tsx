/**
 * Call Endpoint Example
 *
 * Shows how to save a setpoint through an Analysis Endpoint and show the field error it answers with.
 * This is the React equivalent of the JavaScript "call-endpoint.html" example.
 *
 * useCallEndpoint returns { callEndpoint, isCalling, error, reset }. Every HTTP answer except a
 * redirect resolves, 4xx and 5xx included, so the form reads its status. error holds a plain { code, message }
 * object only when the call did not complete.
 *
 * The Analysis is the one from the "Validate a Custom Dashboard form" recipe. Set it up as the
 * recipe's Set up and Permissions sections say:
 * https://docs.tago.io/docs/tagoio/analysis/endpoints/recipes/validate-dashboard-form#set-up
 * https://docs.tago.io/docs/tagoio/analysis/endpoints/recipes/validate-dashboard-form#permissions
 * The Run user needs Access to the dashboard that holds this widget and Call Endpoint on the
 * Analysis, and the Analysis needs Access and Send data on the devices. Open that dashboard in
 * TagoRUN as the Run user: the recipe answers 403 to anyone else, Admin included.
 */

import { TagoIOProvider, useCallEndpoint, useWidget } from "@tago-io/custom-widget-react";
import React, { useState } from "react";

// The Analysis ID, the 24-character ID in its Endpoint URL. Left as it is, Save shows the
// bad_request rejection.
const ENDPOINT_ID = "YOUR_ANALYSIS_ID";

// The recipe answers { ok, setpoint } when it saves, { errors: { setpoint } } with 422, and
// { error } with another 4xx.
type SetpointAnswer = {
  ok?: boolean;
  setpoint?: number;
  error?: string;
  errors?: { setpoint?: string };
};

type Feedback = { text: string; failed: boolean };

const controlStyle = { fontSize: 16, padding: "12px 16px", minHeight: 48 };

function App() {
  return (
    <TagoIOProvider>
      <SetpointForm />
    </TagoIOProvider>
  );
}

function SetpointForm() {
  const { isLoading } = useWidget();
  const { callEndpoint, isCalling, error } = useCallEndpoint();
  const [setpoint, setSetpoint] = useState("22");
  // What the Endpoint answered to the latest call.
  const [answer, setAnswer] = useState<Feedback | null>(null);

  async function save() {
    setAnswer(null);
    try {
      // The Endpoint checks the value, so the field's text goes as typed, inside an object
      // sent as JSON. A string body would go as text/plain, and the Analysis would get scope
      // as nil.
      const result = await callEndpoint<SetpointAnswer>(ENDPOINT_ID, {
        method: "POST",
        path: "/setpoint",
        body: { setpoint },
      });
      // Every HTTP status except a redirect resolves, 4xx and 5xx included, so check it before
      // reading the body.
      if (result.status === 422) {
        setAnswer({ text: result.body?.errors?.setpoint ?? "Invalid setpoint.", failed: true });
      } else if (result.status >= 400) {
        // Such as 403 "Sign in first." outside TagoRUN, 404 without Call Endpoint, or 429 when
        // the profile's allowance ran out.
        setAnswer({ text: result.body?.error ?? `Request failed (${result.status}).`, failed: true });
      } else {
        setAnswer({ text: `Saved: ${result.body.setpoint} C`, failed: false });
      }
    } catch {
      // The hook rethrows a rejection and keeps it in `error`, so there is nothing more to do
      // here. It never reaches useWidgetErrors.
    }
  }

  let feedback: Feedback | null = answer;
  if (isLoading) {
    feedback = { text: "Waiting for the widget settings...", failed: false };
  } else if (isCalling) {
    feedback = { text: "Saving...", failed: false };
  } else if (error) {
    // The call did not complete: error is a plain { code, message } object.
    feedback = { text: `Not completed (${error.code}): ${error.message}`, failed: true };
  }

  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: 20 }}>
      <h1>Room temperature</h1>
      <p>
        The form saves a setpoint through an Analysis Endpoint. The Endpoint checks the value, stores it on the viewer's
        device and answers with the saved setpoint or a field error.
      </p>

      {/* A form, so Enter in the field saves too. */}
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <label htmlFor="setpoint">Setpoint (5 to 30 C)</label>{" "}
        <input
          id="setpoint"
          value={setpoint}
          inputMode="decimal"
          aria-describedby="feedback"
          onChange={(event) => setSetpoint(event.target.value)}
          style={{ ...controlStyle, width: "6em" }}
        />{" "}
        {/* callEndpoint rejects with not_ready until the widget settings arrive, and a click
            during a call would start another one. */}
        <button type="submit" disabled={isLoading || isCalling} style={controlStyle}>
          Save setpoint
        </button>
      </form>

      <p
        id="feedback"
        role="status"
        style={{ background: "#f0f0f0", padding: feedback ? 10 : 0, color: feedback?.failed ? "#b00020" : undefined }}
      >
        {feedback?.text}
      </p>
    </div>
  );
}

export default App;
