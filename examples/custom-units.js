/**
 * Custom Units Example
 *
 * This example demonstrates how to work with custom units and unit conversions
 * in TagoIO Custom Widgets. It shows how to handle different measurement units,
 * perform conversions, and display data with appropriate units.
 *
 * Features demonstrated:
 * - Unit conversion between different measurement systems
 * - Custom unit definitions and formatting
 * - Dynamic unit selection and display
 * - Data validation with units
 * - Unit-aware data operations
 *
 * Usage: Include this script in an HTML file with the TagoIO Custom Widget SDK
 */

let widgetData = {};
let unitPreferences = {
  temperature: "celsius",
  distance: "meters",
  weight: "kilograms",
  speed: "kmh",
};

// HTML structure and styles - Set up first
document.body.innerHTML = `
    <div class="widget-container">
        <h2>Custom Units Converter</h2>
        <p>This widget demonstrates custom unit conversions and dynamic unit selection for sensor data.</p>
        
        <div id="error-message"></div>
        
        <div class="unit-controls-section">
            <h4>Unit Preferences</h4>
            <div id="unit-selectors" class="unit-selectors">
                <!-- Unit selectors will be populated here -->
            </div>
            <div class="global-actions">
                <button onclick="resetToDefaults()" class="action-btn secondary">Reset to Defaults</button>
                <button onclick="savePreferences()" class="action-btn primary">Save Preferences</button>
            </div>
        </div>
        
        <div class="data-display-section">
            <div class="current-readings">
                <h4>Current Readings</h4>
                <div id="readings-grid" class="readings-grid">
                    <div class="no-readings">No sensor data available</div>
                </div>
            </div>
            
            <div class="conversion-panel">
                <h4>Unit Converter</h4>
                <div class="converter-form">
                    <div class="form-group">
                        <label>Value:</label>
                        <input type="number" id="convert-value" placeholder="Enter value" class="form-control">
                    </div>
                    <div class="form-group">
                        <label>From Unit:</label>
                        <select id="from-unit" class="form-control">
                            <option value="">Select unit...</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>To Unit:</label>
                        <select id="to-unit" class="form-control">
                            <option value="">Select unit...</option>
                        </select>
                    </div>
                    <button onclick="performConversion()" class="action-btn primary full-width">Convert</button>
                    <div id="conversion-result" class="conversion-result"></div>
                </div>
            </div>
        </div>
        
        <div class="history-section">
            <h4>Conversion History</h4>
            <div id="conversion-history" class="conversion-history">
                <p class="no-history">No conversions performed yet</p>
            </div>
            <button onclick="clearHistory()" class="action-btn tertiary">Clear History</button>
        </div>
    </div>
    
    <style>
        .widget-container {
            padding: 20px;
            font-family: Arial, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .unit-controls-section, .data-display-section, .history-section {
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .unit-controls-section h4, .data-display-section h4, .history-section h4 {
            margin: 0 0 15px 0;
            color: #333;
            border-bottom: 2px solid #2196f3;
            padding-bottom: 8px;
        }
        
        .unit-selectors {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }
        
        .unit-selector {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px;
            background-color: #f8f9fa;
            border-radius: 6px;
        }
        
        .unit-selector label {
            font-weight: bold;
            color: #555;
            min-width: 80px;
        }
        
        .unit-selector select {
            flex: 1;
            padding: 6px 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
        }
        
        .global-actions {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
        }
        
        .data-display-section {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 20px;
        }
        
        .readings-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
        }
        
        .reading-card {
            background-color: #f8f9fa;
            border: 1px solid #ddd;
            border-radius: 6px;
            padding: 15px;
            text-align: center;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .reading-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        
        .reading-card.updated {
            border-color: #4caf50;
            background-color: #e8f5e8;
        }
        
        .reading-name {
            font-weight: bold;
            color: #333;
            margin-bottom: 8px;
        }
        
        .reading-value {
            font-size: 24px;
            font-weight: bold;
            color: #2196f3;
            margin-bottom: 5px;
        }
        
        .reading-unit {
            color: #666;
            font-size: 14px;
        }
        
        .reading-time {
            color: #888;
            font-size: 12px;
            margin-top: 8px;
        }
        
        .no-readings, .no-history {
            text-align: center;
            color: #888;
            font-style: italic;
            padding: 20px;
        }
        
        .converter-form {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }
        
        .form-group {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        
        .form-group label {
            font-weight: bold;
            color: #555;
            font-size: 14px;
        }
        
        .form-control {
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
        }
        
        .form-control:focus {
            outline: none;
            border-color: #2196f3;
            box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.2);
        }
        
        .action-btn {
            padding: 10px 20px;
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
        
        .action-btn.full-width {
            width: 100%;
        }
        
        .conversion-result {
            margin-top: 15px;
            padding: 15px;
            background-color: #e3f2fd;
            border-radius: 6px;
            text-align: center;
            font-weight: bold;
            color: #1976d2;
            display: none;
        }
        
        .conversion-result.show {
            display: block;
        }
        
        .conversion-history {
            max-height: 200px;
            overflow-y: auto;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 10px;
            margin-bottom: 15px;
        }
        
        .history-item {
            padding: 8px;
            border-bottom: 1px solid #eee;
            font-family: monospace;
            font-size: 13px;
        }
        
        .history-item:last-child {
            border-bottom: none;
        }
        
        .history-item .timestamp {
            color: #666;
            font-size: 11px;
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

// Unit conversion definitions
const UNIT_CONVERSIONS = {
  temperature: {
    celsius: {
      name: "Celsius",
      symbol: "°C",
      toBase: (val) => val,
      fromBase: (val) => val,
    },
    fahrenheit: {
      name: "Fahrenheit",
      symbol: "°F",
      toBase: (val) => ((val - 32) * 5) / 9,
      fromBase: (val) => (val * 9) / 5 + 32,
    },
    kelvin: {
      name: "Kelvin",
      symbol: "K",
      toBase: (val) => val - 273.15,
      fromBase: (val) => val + 273.15,
    },
  },
  distance: {
    meters: {
      name: "Meters",
      symbol: "m",
      toBase: (val) => val,
      fromBase: (val) => val,
    },
    feet: {
      name: "Feet",
      symbol: "ft",
      toBase: (val) => val * 0.3048,
      fromBase: (val) => val / 0.3048,
    },
    kilometers: {
      name: "Kilometers",
      symbol: "km",
      toBase: (val) => val * 1000,
      fromBase: (val) => val / 1000,
    },
  },
  weight: {
    kilograms: {
      name: "Kilograms",
      symbol: "kg",
      toBase: (val) => val,
      fromBase: (val) => val,
    },
    pounds: {
      name: "Pounds",
      symbol: "lbs",
      toBase: (val) => val * 0.453592,
      fromBase: (val) => val / 0.453592,
    },
    grams: {
      name: "Grams",
      symbol: "g",
      toBase: (val) => val / 1000,
      fromBase: (val) => val * 1000,
    },
  },
  speed: {
    kmh: {
      name: "Kilometers per Hour",
      symbol: "km/h",
      toBase: (val) => val,
      fromBase: (val) => val,
    },
    mph: {
      name: "Miles per Hour",
      symbol: "mph",
      toBase: (val) => val * 1.60934,
      fromBase: (val) => val / 1.60934,
    },
    ms: {
      name: "Meters per Second",
      symbol: "m/s",
      toBase: (val) => val * 3.6,
      fromBase: (val) => val / 3.6,
    },
  },
};

// Now set up the widget functionality after DOM is ready
document.addEventListener("DOMContentLoaded", function () {
  /**
   * Handle widget startup
   */
  window.TagoIO.onStart(function (widget) {
    console.log("Custom Units Widget started");

    // Setup unit selectors
    setupUnitSelectors();

    // Initialize conversion form
    setupConversionForm();

    // Update display
    updateDisplay();
  });

  /**
   * Handle realtime data with unit processing
   */
  window.TagoIO.onRealtime(function (realtimeData) {
    console.log("Realtime data received for unit processing:", realtimeData);

    realtimeData.forEach(function (dataGroup) {
      if (dataGroup.result && dataGroup.result.length > 0) {
        dataGroup.result.forEach(function (dataPoint) {
          // Store data with original unit
          widgetData[dataPoint.variable] = {
            value: dataPoint.value,
            unit: dataPoint.unit || detectUnit(dataPoint.variable),
            time: dataPoint.time,
            originalValue: dataPoint.value,
            originalUnit: dataPoint.unit || detectUnit(dataPoint.variable),
          };
        });

        updateDisplay();
      }
    });
  });

  /**
   * Handle errors
   */
  window.TagoIO.onError(function (error) {
    console.error("Custom units error:", error);
    showError("Error with unit operations: " + error.message);
  });

  /**
   * Initialize the widget
   */
  window.TagoIO.ready({
    header: {
      color: "#795548",
    },
  });
});

/**
 * Setup unit selector dropdowns
 */
function setupUnitSelectors() {
  const selectorsContainer = document.getElementById("unit-selectors");
  if (!selectorsContainer) return;

  selectorsContainer.innerHTML = "";

  Object.keys(UNIT_CONVERSIONS).forEach(function (category) {
    const selectorDiv = document.createElement("div");
    selectorDiv.className = "unit-selector";

    const label = document.createElement("label");
    label.textContent = category.charAt(0).toUpperCase() + category.slice(1) + ":";

    const select = document.createElement("select");
    select.id = `unit-${category}`;
    select.onchange = function () {
      changeUnitPreference(category, this.value);
    };

    Object.keys(UNIT_CONVERSIONS[category]).forEach(function (unitKey) {
      const unit = UNIT_CONVERSIONS[category][unitKey];
      const option = document.createElement("option");
      option.value = unitKey;
      option.textContent = `${unit.name} (${unit.symbol})`;
      option.selected = unitPreferences[category] === unitKey;
      select.appendChild(option);
    });

    selectorDiv.appendChild(label);
    selectorDiv.appendChild(select);
    selectorsContainer.appendChild(selectorDiv);
  });
}

/**
 * Setup conversion form dropdowns
 */
function setupConversionForm() {
  const fromUnit = document.getElementById("from-unit");
  const toUnit = document.getElementById("to-unit");

  if (!fromUnit || !toUnit) return;

  // Populate unit options
  Object.keys(UNIT_CONVERSIONS).forEach(function (category) {
    Object.keys(UNIT_CONVERSIONS[category]).forEach(function (unitKey) {
      const unit = UNIT_CONVERSIONS[category][unitKey];

      const fromOption = document.createElement("option");
      fromOption.value = unit.symbol;
      fromOption.textContent = `${unit.name} (${unit.symbol})`;
      fromUnit.appendChild(fromOption);

      const toOption = document.createElement("option");
      toOption.value = unit.symbol;
      toOption.textContent = `${unit.name} (${unit.symbol})`;
      toUnit.appendChild(toOption);
    });
  });
}

/**
 * Change unit preference for a category
 */
function changeUnitPreference(category, unitKey) {
  unitPreferences[category] = unitKey;
  updateDisplay();
  showSuccess(`Unit preference changed: ${category} → ${UNIT_CONVERSIONS[category][unitKey].name}`);
}

/**
 * Detect unit category from variable name
 */
function detectUnit(variable) {
  const varLower = variable.toLowerCase();

  if (varLower.includes("temp")) return "°C";
  if (varLower.includes("distance") || varLower.includes("height")) return "m";
  if (varLower.includes("weight") || varLower.includes("mass")) return "kg";
  if (varLower.includes("speed")) return "km/h";

  return "";
}

/**
 * Get unit category from unit symbol
 */
function getUnitCategory(unitSymbol) {
  for (const category in UNIT_CONVERSIONS) {
    for (const unitKey in UNIT_CONVERSIONS[category]) {
      if (UNIT_CONVERSIONS[category][unitKey].symbol === unitSymbol) {
        return category;
      }
    }
  }
  return null;
}

/**
 * Convert value between units
 */
function convertValue(value, fromUnit, toUnit) {
  if (fromUnit === toUnit) return value;

  const category = getUnitCategory(fromUnit);
  if (!category) return null;

  const fromUnitDef = Object.values(UNIT_CONVERSIONS[category]).find((u) => u.symbol === fromUnit);
  const toUnitDef = Object.values(UNIT_CONVERSIONS[category]).find((u) => u.symbol === toUnit);

  if (!fromUnitDef || !toUnitDef) return null;

  const baseValue = fromUnitDef.toBase(value);
  return toUnitDef.fromBase(baseValue);
}

/**
 * Update display with current data and unit preferences
 */
function updateDisplay() {
  const readingsGrid = document.getElementById("readings-grid");
  if (!readingsGrid) return;

  const dataKeys = Object.keys(widgetData);

  if (dataKeys.length === 0) {
    readingsGrid.innerHTML = '<div class="no-readings">No sensor data available</div>';
    return;
  }

  readingsGrid.innerHTML = "";

  dataKeys.forEach(function (variable) {
    const data = widgetData[variable];
    const category = getUnitCategory(data.originalUnit);

    let convertedValue = data.originalValue;
    let displayUnit = data.originalUnit;

    if (category && unitPreferences[category]) {
      const preferredUnit = UNIT_CONVERSIONS[category][unitPreferences[category]];
      if (preferredUnit) {
        convertedValue = convertValue(data.originalValue, data.originalUnit, preferredUnit.symbol);
        displayUnit = preferredUnit.symbol;
      }
    }

    const card = document.createElement("div");
    card.className = "reading-card";
    card.innerHTML = `
      <div class="reading-name">${variable}</div>
      <div class="reading-value">${convertedValue?.toFixed(2) || data.value}</div>
      <div class="reading-unit">${displayUnit}</div>
      <div class="reading-time">${new Date(data.time).toLocaleTimeString()}</div>
    `;

    readingsGrid.appendChild(card);
  });
}

/**
 * Perform unit conversion
 */
function performConversion() {
  const value = parseFloat(document.getElementById("convert-value").value);
  const fromUnit = document.getElementById("from-unit").value;
  const toUnit = document.getElementById("to-unit").value;
  const resultElement = document.getElementById("conversion-result");

  if (isNaN(value) || !fromUnit || !toUnit) {
    showError("Please fill in all conversion fields");
    return;
  }

  const convertedValue = convertValue(value, fromUnit, toUnit);

  if (convertedValue === null) {
    showError("Cannot convert between these units");
    return;
  }

  resultElement.innerHTML = `${value} ${fromUnit} = ${convertedValue.toFixed(4)} ${toUnit}`;
  resultElement.classList.add("show");

  // Add to history
  addToHistory(value, fromUnit, convertedValue, toUnit);
}

/**
 * Add conversion to history
 */
function addToHistory(fromValue, fromUnit, toValue, toUnit) {
  const historyContainer = document.getElementById("conversion-history");
  if (!historyContainer) return;

  // Remove no-history message
  const noHistory = historyContainer.querySelector(".no-history");
  if (noHistory) noHistory.remove();

  const historyItem = document.createElement("div");
  historyItem.className = "history-item";
  historyItem.innerHTML = `
    <div>${fromValue} ${fromUnit} → ${toValue.toFixed(4)} ${toUnit}</div>
    <div class="timestamp">${new Date().toLocaleTimeString()}</div>
  `;

  historyContainer.insertBefore(historyItem, historyContainer.firstChild);

  // Keep only last 10 items
  const items = historyContainer.querySelectorAll(".history-item");
  if (items.length > 10) {
    items[items.length - 1].remove();
  }
}

/**
 * Reset to default unit preferences
 */
function resetToDefaults() {
  unitPreferences = {
    temperature: "celsius",
    distance: "meters",
    weight: "kilograms",
    speed: "kmh",
  };

  setupUnitSelectors();
  updateDisplay();
  showSuccess("Unit preferences reset to defaults");
}

/**
 * Save unit preferences (simulated)
 */
function savePreferences() {
  // In a real implementation, this might save to localStorage or send to server
  showSuccess("Unit preferences saved successfully");
}

/**
 * Clear conversion history
 */
function clearHistory() {
  const historyContainer = document.getElementById("conversion-history");
  if (historyContainer) {
    historyContainer.innerHTML = '<p class="no-history">No conversions performed yet</p>';
  }
}

/**
 * Show success message
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
