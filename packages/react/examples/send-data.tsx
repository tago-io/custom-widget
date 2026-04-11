/**
 * Send Data Example
 *
 * Shows how to send data back to TagoIO devices using a simple form.
 * This is the React equivalent of the JavaScript "send-data.html" example.
 *
 * The useSendData hook gives you a function to send data, plus loading
 * and error states so you can show feedback to the user.
 */

import { TagoIOProvider, useSendData, useWidget } from "@tago-io/custom-widget-react";
import React, { useState } from "react";

function App() {
  return (
    <TagoIOProvider>
      <SendForm />
    </TagoIOProvider>
  );
}

function SendForm() {
  const { isLoading } = useWidget();
  const { sendData, isSending, error } = useSendData();

  const [variable, setVariable] = useState("temperature");
  const [value, setValue] = useState("25.5");
  const [unit, setUnit] = useState("°C");
  const [success, setSuccess] = useState(false);

  if (isLoading) {
    return <p style={{ padding: 20 }}>Loading widget...</p>;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(false);

    try {
      await sendData({
        variable,
        value: Number(value),
        unit: unit || undefined,
        time: new Date().toISOString(),
      });
      setSuccess(true);
    } catch {
      // error state is already handled by the hook
    }
  }

  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: 20 }}>
      <h1>Send Data</h1>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: "block", fontWeight: "bold", marginBottom: 4 }}>Variable Name</label>
          <input value={variable} onChange={(e) => setVariable(e.target.value)} style={{ padding: 5, width: 200 }} />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ display: "block", fontWeight: "bold", marginBottom: 4 }}>Value</label>
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            style={{ padding: 5, width: 200 }}
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ display: "block", fontWeight: "bold", marginBottom: 4 }}>Unit</label>
          <input value={unit} onChange={(e) => setUnit(e.target.value)} style={{ padding: 5, width: 200 }} />
        </div>

        <button
          type="submit"
          disabled={isSending || !variable || !value}
          style={{ padding: "10px 15px", cursor: "pointer" }}
        >
          {isSending ? "Sending..." : "Send Data"}
        </button>
      </form>

      {success && (
        <p style={{ color: "green", background: "#f0fff0", padding: 10, marginTop: 10 }}>Data sent successfully!</p>
      )}

      {error && (
        <p style={{ color: "red", background: "#fff0f0", padding: 10, marginTop: 10 }}>
          Error: {error.message || "Something went wrong"}
        </p>
      )}
    </div>
  );
}

export default App;
