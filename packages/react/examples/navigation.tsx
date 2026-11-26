/**
 * Navigation Example
 *
 * Shows how to open another dashboard or a web page, and how to close the modal a widget is open in.
 * This is the React equivalent of the JavaScript "navigation.html" example.
 *
 * useNavigation gives you openLink(url) and closeModal(). Both only post a message to the
 * dashboard: they return nothing and no reply comes back. useWidget gives the widget's
 * variables, which carry the device that the dashboard link passes along.
 */

import { TagoIOProvider, useNavigation, useWidget } from "@tago-io/custom-widget-react";
import React, { useState } from "react";

// The dashboard to open: the 24-character id in that dashboard's URL.
const TARGET_DASHBOARD_ID = "REPLACE_WITH_DASHBOARD_ID";

// A blueprint dashboard reads its device selection from the query string. The key is the
// Identifier of one of its blueprint devices, and the value is a device id.
const BLUEPRINT_IDENTIFIER = "device";

const DOCS_URL = "https://docs.tago.io/docs/tagoio/widgets/custom-widget/";

function App() {
  return (
    <TagoIOProvider>
      <Navigation />
    </TagoIOProvider>
  );
}

function Navigation() {
  // No loading gate: openLink and closeModal work before the widget settings arrive. Only
  // the device for the dashboard link comes from them, and the link goes without it until then.
  const { variables } = useWidget();
  const { openLink, closeModal } = useNavigation();
  const [status, setStatus] = useState("Pick one to start.");

  const deviceId = variables[0]?.origin.id;

  // Navigate with openLink from onClick, never a plain <a href>: a link navigates the
  // widget's own iframe instead of the dashboard around it.
  function openDashboard() {
    if (!/^[a-f0-9]{24}$/i.test(TARGET_DASHBOARD_ID)) {
      setStatus("Set TARGET_DASHBOARD_ID to the id of the dashboard to open.");
      return;
    }

    // In the Admin and TagoRUN, a link that contains "/dashboards/info/<id>" opens that
    // dashboard in this tab, without a page reload, and keeps the query string. The host
    // drops everything before "/dashboards/", so a relative link works whatever domain
    // the dashboard runs on. Keep "/info/": the "/dashboards/<id>" address in the browser
    // bar is not treated as a dashboard link.
    let link = `/dashboards/info/${TARGET_DASHBOARD_ID}`;
    if (deviceId) {
      link += `?${new URLSearchParams({ [BLUEPRINT_IDENTIFIER]: deviceId })}`;
    }

    openLink(link);
    setStatus(`Asked the dashboard to open ${link}`);
  }

  // A web page opens in a new tab: the dashboard page calls window.open with the URL.
  // Browsers can block that when the click was not recent, so call openLink from the
  // click handler itself, not after waiting on a request or a timer. Admin pages other
  // than dashboards, such as "https://admin.tago.io/devices/<id>", do not open at all.
  function openDocs() {
    openLink(DOCS_URL);
    setStatus("Asked the dashboard to open the docs in a new tab.");
  }

  // closeModal closes the modal this widget is open in, such as the one a header button
  // opens when it is set to open a widget. On a dashboard tile it does nothing, and the
  // widget cannot tell which of the two it is in. Closing removes the widget from the
  // page, so let a pending sendData or editData settle first, or its reply is lost.
  function requestClose() {
    closeModal();
    setStatus("Asked the dashboard to close this modal. On a dashboard tile nothing happens.");
  }

  const buttonStyle = { fontSize: 16, padding: "12px 16px", marginRight: 8, marginBottom: 8, minHeight: 48 };

  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: 20 }}>
      <h1>Navigation</h1>
      <p>
        Switch this tab to another dashboard, open a web page in a new tab, or close the modal this widget is open in.
      </p>

      <button type="button" onClick={openDashboard} style={buttonStyle}>
        Open dashboard
      </button>
      <button type="button" onClick={openDocs} style={buttonStyle}>
        Open the docs
      </button>
      <button type="button" onClick={requestClose} style={buttonStyle}>
        Close
      </button>

      <p style={{ color: "#555", wordBreak: "break-all" }}>{status}</p>
    </div>
  );
}

export default App;
