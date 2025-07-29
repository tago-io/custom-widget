/**
 * Basic Custom Widget Example
 *
 * This example demonstrates the minimal setup required to create a functional
 * TagoIO Custom Widget. It shows how to initialize the widget, handle startup,
 * and display basic information.
 *
 * Features demonstrated:
 * - Widget initialization with TagoIO.ready()
 * - Handling widget startup with onStart callback
 * - Basic error handling
 * - Simple HTML structure
 *
 * Usage: Include this script in an HTML file with the TagoIO Custom Widget SDK
 */

/**
 * Initialize the widget when it starts
 * This callback receives the widget configuration and variables
 */
window.TagoIO.onStart(function (widget) {
  console.log("Widget started with configuration:", widget);

  // Display widget information
  document.getElementById("widget-info").innerHTML = `
        <h3>Widget Information</h3>
        <p><strong>Widget ID:</strong> ${widget.id}</p>
        <p><strong>Dashboard ID:</strong> ${widget.dashboard}</p>
        <p><strong>Widget Label:</strong> ${widget.label || "No label set"}</p>
        <p><strong>Variables Count:</strong> ${widget.display.variables.length}</p>
    `;

  // List configured variables
  const variablesList = document.getElementById("variables-list");
  variablesList.innerHTML = ""; // Clear existing content
  widget.display.variables.forEach(function (variable) {
    const listItem = document.createElement("li");
    listItem.innerHTML = `
            <strong>${variable.variable}</strong> 
            (Device: ${variable.origin.id})
        `;
    variablesList.appendChild(listItem);
  });
});

/**
 * Handle any errors that occur during widget operations
 */
window.TagoIO.onError(function (error) {
  console.error("Widget error:", error);
  document.getElementById("error-message").innerHTML = `
        <div style="color: red; padding: 10px; border: 1px solid red; border-radius: 4px;">
            <strong>Error:</strong> ${error.message}
        </div>
    `;
});

/**
 * Signal to TagoIO that the widget is ready to start
 * This should be called after all event listeners are set up
 */
window.TagoIO.ready({
  header: {
    color: "#2196F3", // Optional: Set header color
  },
});
