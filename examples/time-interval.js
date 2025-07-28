/**
 * Time Interval Example
 *
 * This example demonstrates how to work with time intervals, preset time ranges,
 * and time-based data operations in TagoIO Custom Widgets. It shows how to
 * implement common time interval patterns used in IoT dashboards.
 *
 * Features demonstrated:
 * - Preset time intervals (last hour, day, week, month)
 * - Custom time range selection
 * - Time-based data filtering
 * - Real-time clock display
 * - Time zone handling
 *
 * Usage: Include this script in an HTML file with the TagoIO Custom Widget SDK
 */

let currentTimeInterval = null;
let clockInterval = null;
let dataHistory = [];

// Preset time intervals in milliseconds
const TIME_INTERVALS = {
  "5min": { label: "Last 5 Minutes", ms: 5 * 60 * 1000 },
  "30min": { label: "Last 30 Minutes", ms: 30 * 60 * 1000 },
  "1hour": { label: "Last Hour", ms: 60 * 60 * 1000 },
  "6hours": { label: "Last 6 Hours", ms: 6 * 60 * 60 * 1000 },
  "1day": { label: "Last 24 Hours", ms: 24 * 60 * 60 * 1000 },
  "1week": { label: "Last Week", ms: 7 * 24 * 60 * 60 * 1000 },
  "1month": { label: "Last Month", ms: 30 * 24 * 60 * 60 * 1000 },
};

// HTML structure and styles - Set up first
document.body.innerHTML = `
    <div class="widget-container">
        <h2>Time Interval Widget</h2>
        <p>This widget demonstrates working with time intervals and time-based data analysis.</p>
        
        <div id="error-container"></div>
        
        <div class="time-controls-grid">
            <div class="preset-intervals">
                <h4>Quick Time Ranges</h4>
                <div id="interval-buttons" class="interval-buttons">
                    <!-- Buttons will be populated here -->
                </div>
            </div>
            
            <div class="custom-range">
                <h4>Custom Time Range</h4>
                <div class="date-inputs">
                    <div class="date-group">
                        <label>From:</label>
                        <input type="datetime-local" id="start-time" class="date-input">
                    </div>
                    <div class="date-group">
                        <label>To:</label>
                        <input type="datetime-local" id="end-time" class="date-input">
                    </div>
                    <button onclick="applyCustomRange()" class="apply-btn">Apply Range</button>
                </div>
            </div>
        </div>
        
        <div id="widget-info" class="info-section">
            <p>Loading widget information...</p>
        </div>
        
        <div class="current-time-section">
            <h4>Current Time</h4>
            <div id="current-time" class="time-display">
                <div class="time-value">--:--:--</div>
                <div class="date-value">Loading...</div>
            </div>
        </div>
        
        <div class="interval-data-section">
            <h4>Time-Filtered Data</h4>
            <div id="filtered-data" class="data-grid">
                <p class="no-data">Select a time interval to view filtered data</p>
            </div>
        </div>
        
        <div class="data-timeline">
            <h4>Data Timeline</h4>
            <div id="timeline-container" class="timeline">
                <div class="timeline-placeholder">
                    <p>Timeline will appear here when data is available</p>
                </div>
            </div>
        </div>
    </div>
    
    <style>
        .widget-container {
            padding: 20px;
            font-family: Arial, sans-serif;
            max-width: 1400px;
            margin: 0 auto;
        }
        
        .time-controls-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
        }
        
        .preset-intervals, .custom-range {
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .preset-intervals h4, .custom-range h4 {
            margin: 0 0 15px 0;
            color: #333;
            border-bottom: 2px solid #2196f3;
            padding-bottom: 8px;
        }
        
        .interval-buttons {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 10px;
        }
        
        .interval-btn {
            padding: 12px 16px;
            border: 1px solid #ddd;
            background-color: white;
            border-radius: 6px;
            cursor: pointer;
            text-align: center;
            font-size: 14px;
            transition: all 0.3s;
        }
        
        .interval-btn:hover {
            background-color: #e3f2fd;
            border-color: #2196f3;
        }
        
        .interval-btn.active {
            background-color: #2196f3;
            color: white;
            border-color: #2196f3;
        }
        
        .date-inputs {
            display: grid;
            grid-template-columns: 1fr 1fr auto;
            gap: 15px;
            align-items: end;
        }
        
        .date-group {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        
        .date-group label {
            font-weight: bold;
            color: #555;
            font-size: 14px;
        }
        
        .date-input {
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
        }
        
        .date-input:focus {
            outline: none;
            border-color: #2196f3;
            box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.2);
        }
        
        .apply-btn {
            padding: 8px 20px;
            background-color: #4caf50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            height: fit-content;
        }
        
        .apply-btn:hover {
            background-color: #45a049;
        }
        
        .info-section {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        
        .current-time-section {
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .current-time-section h4 {
            margin: 0 0 15px 0;
            color: #333;
        }
        
        .time-display {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
        }
        
        .time-value {
            font-size: 48px;
            font-weight: bold;
            color: #2196f3;
            font-family: 'Courier New', monospace;
        }
        
        .date-value {
            font-size: 18px;
            color: #666;
        }
        
        .interval-data-section {
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .interval-data-section h4 {
            margin: 0 0 15px 0;
            color: #333;
        }
        
        .data-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 15px;
        }
        
        .data-card {
            background-color: #f8f9fa;
            border: 1px solid #ddd;
            border-radius: 6px;
            padding: 15px;
            text-align: center;
        }
        
        .data-card.in-range {
            border-color: #4caf50;
            background-color: #e8f5e8;
        }
        
        .data-name {
            font-weight: bold;
            color: #333;
            margin-bottom: 8px;
        }
        
        .data-value {
            font-size: 20px;
            font-weight: bold;
            color: #2196f3;
            margin-bottom: 5px;
        }
        
        .data-time {
            color: #666;
            font-size: 12px;
        }
        
        .data-timeline {
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .data-timeline h4 {
            margin: 0 0 15px 0;
            color: #333;
        }
        
        .timeline {
            position: relative;
            min-height: 200px;
            border: 1px solid #eee;
            border-radius: 4px;
            background-color: #fafafa;
        }
        
        .timeline-placeholder {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 200px;
            color: #888;
            font-style: italic;
        }
        
        .timeline-item {
            position: absolute;
            background-color: #2196f3;
            color: white;
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 12px;
            cursor: pointer;
            transition: transform 0.2s;
        }
        
        .timeline-item:hover {
            transform: scale(1.1);
            z-index: 10;
        }
        
        .no-data {
            text-align: center;
            color: #888;
            font-style: italic;
            padding: 40px;
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
    console.log("Time Interval Widget started");

    // Display widget information
    const widgetInfoElement = document.getElementById("widget-info");
    if (widgetInfoElement) {
      widgetInfoElement.innerHTML = `
        <h4>Time Interval Configuration</h4>
        <p><strong>Widget ID:</strong> ${widget.id}</p>
        <p><strong>Variables:</strong> ${widget.display.variables.length}</p>
        <p><strong>Current Time Zone:</strong> ${Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
      `;
    }

    // Setup preset interval buttons
    setupIntervalButtons();

    // Start real-time clock
    startClock();

    // Initialize custom time inputs with current time
    initializeTimeInputs();
  });

  /**
   * Handle realtime data with time filtering
   */
  window.TagoIO.onRealtime(function (realtimeData) {
    console.log("Time interval data received:", realtimeData);

    realtimeData.forEach(function (dataGroup) {
      if (dataGroup.result && dataGroup.result.length > 0) {
        dataGroup.result.forEach(function (dataPoint) {
          // Add to data history
          dataHistory.push({
            ...dataPoint,
            receivedAt: new Date(),
          });

          // Keep only last 200 data points
          if (dataHistory.length > 200) {
            dataHistory = dataHistory.slice(-200);
          }
        });

        // Update displays
        updateFilteredData();
        updateTimeline();
      }
    });
  });

  /**
   * Handle errors
   */
  window.TagoIO.onError(function (error) {
    console.error("Time interval error:", error);
    showError("Error with time operations: " + error.message);
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
 * Setup preset interval buttons
 */
function setupIntervalButtons() {
  const buttonsContainer = document.getElementById("interval-buttons");
  if (!buttonsContainer) return;

  buttonsContainer.innerHTML = "";

  Object.keys(TIME_INTERVALS).forEach(function (intervalKey) {
    const interval = TIME_INTERVALS[intervalKey];
    const button = document.createElement("button");
    button.className = "interval-btn";
    button.textContent = interval.label;
    button.onclick = function () {
      selectTimeInterval(intervalKey);
    };
    buttonsContainer.appendChild(button);
  });
}

/**
 * Select a preset time interval
 */
function selectTimeInterval(intervalKey) {
  currentTimeInterval = intervalKey;

  // Update button states
  document.querySelectorAll(".interval-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  // Find and activate the selected button
  const buttons = document.querySelectorAll(".interval-btn");
  buttons.forEach((btn) => {
    if (btn.textContent === TIME_INTERVALS[intervalKey].label) {
      btn.classList.add("active");
    }
  });

  console.log(`Selected time interval: ${TIME_INTERVALS[intervalKey].label}`);
  updateFilteredData();
  showSuccess(`Time range set to: ${TIME_INTERVALS[intervalKey].label}`);
}

/**
 * Apply custom time range
 */
function applyCustomRange() {
  const startInput = document.getElementById("start-time");
  const endInput = document.getElementById("end-time");

  if (!startInput || !endInput) return;

  const startTime = startInput.value;
  const endTime = endInput.value;

  if (!startTime || !endTime) {
    showError("Please select both start and end times");
    return;
  }

  const startDate = new Date(startTime);
  const endDate = new Date(endTime);

  if (startDate >= endDate) {
    showError("Start time must be before end time");
    return;
  }

  currentTimeInterval = {
    custom: true,
    start: startDate,
    end: endDate,
    label: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
  };

  // Clear preset button selections
  document.querySelectorAll(".interval-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  console.log("Applied custom time range:", currentTimeInterval);
  updateFilteredData();
  showSuccess(`Custom time range applied: ${currentTimeInterval.label}`);
}

/**
 * Update filtered data display
 */
function updateFilteredData() {
  const filteredContainer = document.getElementById("filtered-data");
  if (!filteredContainer) return;

  if (!currentTimeInterval) {
    filteredContainer.innerHTML = '<p class="no-data">Select a time interval to view filtered data</p>';
    return;
  }

  let filteredData = [];
  const now = new Date();

  if (currentTimeInterval.custom) {
    // Custom range filtering
    filteredData = dataHistory.filter((item) => {
      const itemTime = new Date(item.time);
      return itemTime >= currentTimeInterval.start && itemTime <= currentTimeInterval.end;
    });
  } else {
    // Preset interval filtering
    const intervalMs = TIME_INTERVALS[currentTimeInterval].ms;
    const cutoffTime = new Date(now.getTime() - intervalMs);

    filteredData = dataHistory.filter((item) => {
      const itemTime = new Date(item.time);
      return itemTime >= cutoffTime;
    });
  }

  if (filteredData.length === 0) {
    filteredContainer.innerHTML = '<p class="no-data">No data found in the selected time range</p>';
    return;
  }

  // Group data by variable
  const groupedData = {};
  filteredData.forEach((item) => {
    if (!groupedData[item.variable]) {
      groupedData[item.variable] = [];
    }
    groupedData[item.variable].push(item);
  });

  // Display grouped data
  filteredContainer.innerHTML = "";
  Object.keys(groupedData).forEach((variable) => {
    const items = groupedData[variable];
    const latestItem = items[items.length - 1];

    const card = document.createElement("div");
    card.className = "data-card in-range";
    card.innerHTML = `
      <div class="data-name">${variable}</div>
      <div class="data-value">${latestItem.value}</div>
      <div class="data-time">${items.length} data points</div>
      <div class="data-time">Latest: ${new Date(latestItem.time).toLocaleString()}</div>
    `;

    filteredContainer.appendChild(card);
  });
}

/**
 * Update timeline visualization
 */
function updateTimeline() {
  const timelineContainer = document.getElementById("timeline-container");
  if (!timelineContainer || dataHistory.length === 0) return;

  // Clear existing timeline
  timelineContainer.innerHTML = "";

  // Create timeline items
  const containerWidth = timelineContainer.offsetWidth - 40;
  const now = new Date();
  const timeRange = 24 * 60 * 60 * 1000; // Last 24 hours

  dataHistory.slice(-50).forEach((item, index) => {
    const itemTime = new Date(item.time);
    const timeDiff = now.getTime() - itemTime.getTime();

    if (timeDiff <= timeRange) {
      const position = ((timeRange - timeDiff) / timeRange) * containerWidth;

      const timelineItem = document.createElement("div");
      timelineItem.className = "timeline-item";
      timelineItem.style.left = position + "px";
      timelineItem.style.top = (index % 5) * 25 + 20 + "px";
      timelineItem.textContent = `${item.variable}: ${item.value}`;
      timelineItem.title = `${item.variable}: ${item.value} at ${itemTime.toLocaleString()}`;

      timelineContainer.appendChild(timelineItem);
    }
  });

  if (timelineContainer.children.length === 0) {
    timelineContainer.innerHTML = '<div class="timeline-placeholder"><p>No recent data for timeline</p></div>';
  }
}

/**
 * Initialize time inputs with current time
 */
function initializeTimeInputs() {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const startInput = document.getElementById("start-time");
  const endInput = document.getElementById("end-time");

  if (startInput && endInput) {
    startInput.value = oneHourAgo.toISOString().slice(0, 16);
    endInput.value = now.toISOString().slice(0, 16);
  }
}

/**
 * Start the real-time clock
 */
function startClock() {
  function updateClock() {
    const now = new Date();
    const timeElement = document.getElementById("current-time");

    if (timeElement) {
      timeElement.innerHTML = `
        <div class="time-value">${now.toLocaleTimeString()}</div>
        <div class="date-value">${now.toLocaleDateString()}</div>
      `;
    }
  }

  updateClock();
  clockInterval = setInterval(updateClock, 1000);
}

/**
 * Show success message
 */
function showSuccess(message) {
  const errorContainer = document.getElementById("error-container");
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
 */
function showError(message) {
  const errorContainer = document.getElementById("error-container");
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

// Cleanup when widget is destroyed
window.addEventListener("beforeunload", function () {
  if (clockInterval) {
    clearInterval(clockInterval);
  }
});
