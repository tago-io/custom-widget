/**
 * Read Resource Example
 *
 * This example demonstrates how to access TagoIO platform resources such as
 * user information and blueprint device configurations using the Custom Widget SDK.
 *
 * Features demonstrated:
 * - Accessing user information with onSyncUserInformation
 * - Working with blueprint devices via onSyncBlueprintDevices
 * - Displaying user context and authentication data
 * - Handling dynamic device selection
 *
 * Usage: Include this script in an HTML file with the TagoIO Custom Widget SDK
 */

let userInfo = null;
let blueprintDevices = null;

// HTML structure and styles - Set up first
document.body.innerHTML = `
    <div class="widget-container">
        <h2>Resource Reader Widget</h2>
        <p>This widget demonstrates how to access TagoIO platform resources and user information.</p>
        
        <div id="error-message"></div>
        
        <div class="resources-grid">
            <!-- User Information Section -->
            <div class="resource-section">
                <h3>User Information</h3>
                <div id="user-info" class="info-card">
                    <p class="loading">Loading user information...</p>
                </div>
            </div>
            
            <!-- Blueprint Devices Section -->
            <div class="resource-section">
                <h3>Blueprint Devices</h3>
                <div id="blueprint-info" class="info-card">
                    <p class="loading">Loading blueprint information...</p>
                </div>
            </div>
            
            <!-- Widget Configuration Section -->
            <div class="resource-section">
                <h3>Widget Configuration</h3>
                <div id="widget-config" class="info-card">
                    <p class="loading">Loading widget configuration...</p>
                </div>
            </div>
            
            <!-- Resource Actions Section -->
            <div class="resource-section">
                <h3>Resource Actions</h3>
                <div class="actions-card">
                    <button onclick="refreshUserInfo()" class="action-btn primary">Refresh User Info</button>
                    <button onclick="refreshBlueprints()" class="action-btn secondary">Refresh Blueprints</button>
                    <button onclick="exportResourceData()" class="action-btn tertiary">Export Data</button>
                </div>
            </div>
        </div>
        
        <!-- Resource Details Modal -->
        <div id="details-modal" class="modal hidden">
            <div class="modal-content">
                <div class="modal-header">
                    <h4 id="modal-title">Resource Details</h4>
                    <button onclick="closeModal()" class="close-btn">&times;</button>
                </div>
                <div id="modal-body" class="modal-body">
                    <!-- Details will be populated here -->
                </div>
            </div>
        </div>
    </div>
    
    <style>
        .widget-container {
            padding: 20px;
            font-family: Arial, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .resources-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .resource-section {
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .resource-section h3 {
            background-color: #2196f3;
            color: white;
            margin: 0;
            padding: 15px 20px;
            font-size: 16px;
        }
        
        .info-card {
            padding: 20px;
            min-height: 150px;
        }
        
        .actions-card {
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        .loading {
            color: #666;
            font-style: italic;
            text-align: center;
            padding: 20px;
        }
        
        .info-item {
            margin-bottom: 12px;
            padding: 8px;
            background-color: #f8f9fa;
            border-radius: 4px;
        }
        
        .info-label {
            font-weight: bold;
            color: #333;
            display: inline-block;
            min-width: 120px;
        }
        
        .info-value {
            color: #666;
        }
        
        .info-value.sensitive {
            font-family: monospace;
            font-size: 12px;
            background-color: #e3f2fd;
            padding: 2px 6px;
            border-radius: 3px;
        }
        
        .device-list {
            max-height: 200px;
            overflow-y: auto;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 10px;
            background-color: #fafafa;
        }
        
        .device-item {
            padding: 8px;
            border-bottom: 1px solid #eee;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        
        .device-item:hover {
            background-color: #e3f2fd;
        }
        
        .device-item:last-child {
            border-bottom: none;
        }
        
        .device-name {
            font-weight: bold;
            color: #333;
        }
        
        .device-id {
            font-size: 12px;
            color: #666;
            font-family: monospace;
        }
        
        .action-btn {
            padding: 12px 16px;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
            transition: background-color 0.3s;
        }
        
        .action-btn.primary {
            background-color: #4caf50;
            color: white;
        }
        
        .action-btn.primary:hover {
            background-color: #45a049;
        }
        
        .action-btn.secondary {
            background-color: #2196f3;
            color: white;
        }
        
        .action-btn.secondary:hover {
            background-color: #1976d2;
        }
        
        .action-btn.tertiary {
            background-color: #ff9800;
            color: white;
        }
        
        .action-btn.tertiary:hover {
            background-color: #f57c00;
        }
        
        .modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }
        
        .modal.hidden {
            display: none;
        }
        
        .modal-content {
            background: white;
            border-radius: 8px;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }
        
        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px;
            border-bottom: 1px solid #ddd;
        }
        
        .modal-header h4 {
            margin: 0;
            color: #333;
        }
        
        .close-btn {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #666;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .close-btn:hover {
            color: #333;
        }
        
        .modal-body {
            padding: 20px;
        }
        
        .json-display {
            background-color: #f8f9fa;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 15px;
            font-family: monospace;
            font-size: 12px;
            white-space: pre-wrap;
            max-height: 400px;
            overflow-y: auto;
        }
        
        .error-message {
            background-color: #ffebee;
            color: #c62828;
            padding: 10px;
            border-radius: 4px;
            border-left: 4px solid #c62828;
            margin-bottom: 15px;
        }
        
        .success-message {
            background-color: #e8f5e8;
            color: #2e7d32;
            padding: 10px;
            border-radius: 4px;
            border-left: 4px solid #4caf50;
            margin-bottom: 15px;
        }
    </style>
`;

// Now set up the widget functionality after DOM is ready
document.addEventListener("DOMContentLoaded", function () {
  /**
   * Handle widget startup
   */
  window.TagoIO.onStart(function (widget) {
    console.log("Resource Reader Widget started");

    // Display widget configuration
    displayWidgetConfig(widget);
  });

  /**
   * Handle user information sync
   */
  window.TagoIO.onSyncUserInformation(function (userData) {
    console.log("User information received:", userData);
    userInfo = userData;
    displayUserInfo(userData);
  });

  /**
   * Handle blueprint devices sync
   */
  window.TagoIO.onSyncBlueprintDevices(function (blueprintData) {
    console.log("Blueprint devices received:", blueprintData);
    blueprintDevices = blueprintData;
    displayBlueprintInfo(blueprintData);
  });

  /**
   * Handle errors
   */
  window.TagoIO.onError(function (error) {
    console.error("Resource reader error:", error);
    showError("Error accessing resources: " + error.message);
  });

  /**
   * Initialize the widget
   */
  window.TagoIO.ready({
    header: {
      color: "#2196F3",
    },
  });
});

/**
 * Display widget configuration information
 * @param {Object} widget - Widget configuration
 */
function displayWidgetConfig(widget) {
  const configElement = document.getElementById("widget-config");
  if (!configElement) return;

  configElement.innerHTML = `
        <div class="info-item">
            <span class="info-label">Widget ID:</span>
            <span class="info-value">${widget.id}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Dashboard ID:</span>
            <span class="info-value">${widget.dashboard}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Label:</span>
            <span class="info-value">${widget.label || "No label set"}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Variables:</span>
            <span class="info-value">${widget.display.variables.length} configured</span>
        </div>
        <div class="info-item">
            <span class="info-label">Type:</span>
            <span class="info-value">${widget.type || "Standard"}</span>
        </div>
    `;
}

/**
 * Display user information
 * @param {Object} userData - User information object
 */
function displayUserInfo(userData) {
  const userElement = document.getElementById("user-info");
  if (!userElement) return;

  userElement.innerHTML = `
        <div class="info-item">
            <span class="info-label">Language:</span>
            <span class="info-value">${userData.language || "Not specified"}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Token Available:</span>
            <span class="info-value">${userData.token ? "Yes" : "No"}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Run URL:</span>
            <span class="info-value">${userData.runURL || "Not available"}</span>
        </div>
        ${
          userData.token
            ? `
        <div class="info-item">
            <span class="info-label">Token (partial):</span>
            <span class="info-value sensitive">${userData.token.substring(0, 20)}...</span>
        </div>
        `
            : ""
        }
        <button onclick="showUserDetails()" class="action-btn primary" style="margin-top: 10px;">
            View Full Details
        </button>
    `;
}

/**
 * Display blueprint devices information
 * @param {Object} blueprintData - Blueprint devices data
 */
function displayBlueprintInfo(blueprintData) {
  const blueprintElement = document.getElementById("blueprint-info");
  if (!blueprintElement) return;

  if (!blueprintData || !blueprintData.selected) {
    blueprintElement.innerHTML = `
            <p class="loading">No blueprint devices configured</p>
        `;
    return;
  }

  const selectedDevices = blueprintData.selected;
  const settings = blueprintData.settings || {};

  blueprintElement.innerHTML = `
        <div class="info-item">
            <span class="info-label">Selected Devices:</span>
            <span class="info-value">${selectedDevices.length} devices</span>
        </div>
        <div class="info-item">
            <span class="info-label">Settings:</span>
            <span class="info-value">${Object.keys(settings).length} configured</span>
        </div>
        <div class="device-list">
            ${selectedDevices
              .map(
                (device) => `
                <div class="device-item" onclick="showDeviceDetails('${device.id}')">
                    <div class="device-name">${device.name || "Unnamed Device"}</div>
                    <div class="device-id">ID: ${device.id}</div>
                </div>
            `
              )
              .join("")}
        </div>
        <button onclick="showBlueprintDetails()" class="action-btn secondary" style="margin-top: 10px;">
            View Full Configuration
        </button>
    `;
}

/**
 * Show user details in modal
 */
function showUserDetails() {
  if (!userInfo) {
    showError("No user information available");
    return;
  }

  showModal(
    "User Information Details",
    `
        <div class="json-display">${JSON.stringify(userInfo, null, 2)}</div>
    `
  );
}

/**
 * Show blueprint details in modal
 */
function showBlueprintDetails() {
  if (!blueprintDevices) {
    showError("No blueprint devices information available");
    return;
  }

  showModal(
    "Blueprint Devices Details",
    `
        <div class="json-display">${JSON.stringify(blueprintDevices, null, 2)}</div>
    `
  );
}

/**
 * Show device details in modal
 * @param {string} deviceId - Device ID to show details for
 */
function showDeviceDetails(deviceId) {
  if (!blueprintDevices || !blueprintDevices.selected) {
    showError("No device information available");
    return;
  }

  const device = blueprintDevices.selected.find((d) => d.id === deviceId);
  if (!device) {
    showError("Device not found");
    return;
  }

  showModal(
    `Device Details: ${device.name || "Unnamed"}`,
    `
        <div class="json-display">${JSON.stringify(device, null, 2)}</div>
    `
  );
}

/**
 * Show modal with content
 * @param {string} title - Modal title
 * @param {string} content - Modal content HTML
 */
function showModal(title, content) {
  const modal = document.getElementById("details-modal");
  const titleElement = document.getElementById("modal-title");
  const bodyElement = document.getElementById("modal-body");

  if (modal && titleElement && bodyElement) {
    titleElement.textContent = title;
    bodyElement.innerHTML = content;
    modal.classList.remove("hidden");
  }
}

/**
 * Close the details modal
 */
function closeModal() {
  const modal = document.getElementById("details-modal");
  if (modal) {
    modal.classList.add("hidden");
  }
}

/**
 * Refresh user information (simulated)
 */
function refreshUserInfo() {
  const userElement = document.getElementById("user-info");
  if (userElement) {
    userElement.innerHTML = '<p class="loading">Refreshing user information...</p>';
  }

  // In a real implementation, you might trigger a re-sync
  setTimeout(() => {
    if (userInfo) {
      displayUserInfo(userInfo);
      showSuccess("User information refreshed");
    } else {
      showError("No user information to refresh");
    }
  }, 1000);
}

/**
 * Refresh blueprint devices (simulated)
 */
function refreshBlueprints() {
  const blueprintElement = document.getElementById("blueprint-info");
  if (blueprintElement) {
    blueprintElement.innerHTML = '<p class="loading">Refreshing blueprint devices...</p>';
  }

  // In a real implementation, you might trigger a re-sync
  setTimeout(() => {
    if (blueprintDevices) {
      displayBlueprintInfo(blueprintDevices);
      showSuccess("Blueprint devices refreshed");
    } else {
      showError("No blueprint devices to refresh");
    }
  }, 1000);
}

/**
 * Export resource data as JSON
 */
function exportResourceData() {
  const data = {
    userInfo: userInfo,
    blueprintDevices: blueprintDevices,
    exportedAt: new Date().toISOString(),
  };

  const dataStr = JSON.stringify(data, null, 2);
  const dataBlob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(dataBlob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "tagoio-resource-data.json";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showSuccess("Resource data exported successfully");
}

/**
 * Show success message
 * @param {string} message - Success message
 */
function showSuccess(message) {
  const errorContainer = document.getElementById("error-message");
  if (errorContainer) {
    errorContainer.innerHTML = `
            <div class="success-message">
                <strong>Success:</strong> ${message}
            </div>
        `;

    setTimeout(() => {
      errorContainer.innerHTML = "";
    }, 3000);
  }
}

/**
 * Show error message
 * @param {string} message - Error message
 */
function showError(message) {
  const errorContainer = document.getElementById("error-message");
  if (errorContainer) {
    errorContainer.innerHTML = `
            <div class="error-message">
                <strong>Error:</strong> ${message}
            </div>
        `;

    setTimeout(() => {
      errorContainer.innerHTML = "";
    }, 5000);
  }
}

// Close modal when clicking outside
document.addEventListener("click", function (event) {
  const modal = document.getElementById("details-modal");
  if (modal && event.target === modal) {
    closeModal();
  }
});
