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

// Set up the HTML structure first
document.body.innerHTML = `
    <div style="padding: 20px; font-family: Arial, sans-serif;">
        <h2>Basic Custom Widget</h2>
        <p>This is a minimal example of a TagoIO Custom Widget.</p>
        
        <div id="error-message"></div>
        
        <div id="widget-info">
            <p>Loading widget information...</p>
        </div>
        
        <div>
            <h4>Configured Variables:</h4>
            <ul id="variables-list"></ul>
        </div>
        
        <div style="margin-top: 20px; padding: 10px; background-color: #f5f5f5; border-radius: 4px;">
            <small>
                <strong>Tip:</strong> Check the browser console for detailed logs and information.
            </small>
        </div>
    </div>
`;

// Wait for the DOM to be fully loaded, then set up the widget
document.addEventListener("DOMContentLoaded", function () {
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
});
