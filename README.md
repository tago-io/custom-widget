# TagoIO Custom Widget SDK

Create amazing custom widgets and run them inside TagoIO Admin with this comprehensive toolkit. The Custom Widget SDK provides a powerful JavaScript interface for building interactive IoT dashboards and data visualization components.

## 🚀 Quick Start

### CDN Installation (Recommended for beginners)

The simplest way to get started is to include the SDK directly in your HTML:

```html
<!DOCTYPE html>
<html>
<head>
    <title>My Custom Widget</title>
    <script src="https://admin.tago.io/dist/custom-widget.min.js"></script>
    <link rel="stylesheet" href="https://admin.tago.io/dist/custom-widget.min.css"> <!-- OPTIONAL -->
</head>
<body>
    <script>
        // Your widget code here
        window.TagoIO.onStart(function(widget) {
            console.log('Widget started!', widget);
        });
        
        window.TagoIO.ready();
    </script>
</body>
</html>
```

### NPM Installation (For development environments)

For projects using webpack or other build tools:

```bash
npm install @tago-io/custom-widget --save
```

Then import in your entry component:

```javascript
import "@tago-io/custom-widget";
import "@tago-io/custom-widget/dist/custom-widget.css"; // OPTIONAL
```

## 📚 SDK Documentation

### Core API Reference

The TagoIO Custom Widget SDK provides a comprehensive API through the global `window.TagoIO` object:

#### Initialization Functions
- **`TagoIO.ready(options)`** - Signal that your widget is ready to start
- **`TagoIO.onStart(callback)`** - Handle widget startup and receive configuration
- **`TagoIO.onError(callback)`** - Handle API errors and widget issues

#### Data Operations
- **`TagoIO.sendData(data, callback)`** - Send data to TagoIO devices
- **`TagoIO.editData(data, callback)`** - Edit existing device data
- **`TagoIO.deleteData(data, callback)`** - Delete device data
- **`TagoIO.editResourceData(data, callback)`** - Edit platform resources

#### Real-time Data
- **`TagoIO.onRealtime(callback)`** - Receive real-time data updates
- **`TagoIO.onSyncUserInformation(callback)`** - Access user context and authentication
- **`TagoIO.onSyncBlueprintDevices(callback)`** - Access blueprint device configurations

#### Utility Functions
- **`TagoIO.openLink(url)`** - Navigate to other dashboards or external links
- **`TagoIO.closeModal()`** - Close widget modal (for header button widgets)

#### Configuration
- **`TagoIO.autoFill`** - Boolean flag to enable/disable automatic device/bucket ID filling

### Complete API Documentation

For detailed API documentation, type definitions, and advanced usage patterns, visit:

**📖 [Complete SDK Documentation](https://github.com/tago-io/custom-widget)**

The repository includes:
- Full TypeScript type definitions
- Detailed function parameters and return types
- Advanced usage examples
- Integration guides for different frameworks

## 🎯 Examples & Learning Resources

### Practical Examples

This repository includes a comprehensive `/examples` folder with 7 different JavaScript examples:

| Example | Purpose | Best For |
|---------|---------|----------|
| **basic-widget.js** | Minimal setup and widget lifecycle | Beginners learning the basics |
| **read-data.js** | Displaying real-time device data | Data visualization widgets |
| **read-resource.js** | Accessing platform resources | User context and blueprint devices |
| **read-entity.js** | Complex structured data handling | Advanced data relationships |
| **send-data.js** | Sending data back to devices | Interactive input widgets |
| **time-interval.js** | Time-based data analysis | Historical data and time controls |
| **custom-units.js** | Unit conversions and formatting | Multi-unit sensor displays |

**📁 [View All Examples](./examples/README.md)**

### External Project Examples

Complete project implementations:

- **[Boilerplate Project](https://github.com/tago-io/custom-widget-boilerplate)**: Basic boilerplate project using Preact, showing fundamental SDK usage patterns.

- **[SendData Widget](https://github.com/tago-io/custom-widget-example-send-data)**: Simple example demonstrating how to send data from your Custom Widget to TagoIO.

- **[Wizard Widget](https://github.com/tago-io/custom-widget-example-wizard)**: Advanced demo showing a multi-step wizard built using TagoIO's Custom Widget SDK.

## 🛠️ Development Guide

### Building Your First Widget

1. **Start with a basic structure**:
```javascript
document.addEventListener('DOMContentLoaded', function() {
    // Initialize your widget when DOM is ready
    window.TagoIO.onStart(function(widget) {
        // Widget configuration and variables available here
        console.log('Widget config:', widget);
    });
    
    // Handle errors gracefully
    window.TagoIO.onError(function(error) {
        console.error('Widget error:', error);
    });
    
    // Signal that your widget is ready
    window.TagoIO.ready({
        header: {
            color: '#2196F3' // Optional header customization
        }
    });
});
```

2. **Handle real-time data**:
```javascript
window.TagoIO.onRealtime(function(realtimeData) {
    realtimeData.forEach(function(dataGroup) {
        if (dataGroup.result) {
            dataGroup.result.forEach(function(dataPoint) {
                // Process each data point
                console.log('Variable:', dataPoint.variable);
                console.log('Value:', dataPoint.value);
                console.log('Time:', dataPoint.time);
            });
        }
    });
});
```

3. **Send data back to devices**:
```javascript
async function sendSensorData() {
    try {
        const result = await window.TagoIO.sendData({
            variable: 'temperature',
            value: 25.5,
            unit: '°C',
            time: new Date().toISOString()
        });
        console.log('Data sent successfully:', result);
    } catch (error) {
        console.error('Failed to send data:', error);
    }
}
```

### Development Best Practices

#### Error Handling
Always implement comprehensive error handling:
```javascript
window.TagoIO.onError(function(error) {
    // Log for debugging
    console.error('Widget error:', error);
    
    // Show user-friendly message
    showUserMessage('Something went wrong: ' + error.message);
});
```

#### Data Validation
Validate data before sending:
```javascript
function validateAndSendData(variable, value) {
    if (!variable || value === undefined) {
        throw new Error('Variable and value are required');
    }
    
    if (typeof value === 'number' && isNaN(value)) {
        throw new Error('Invalid numeric value');
    }
    
    return window.TagoIO.sendData({ variable, value });
}
```

#### Performance Optimization
- Use `window.TagoIO.autoFill = true` to automatically handle device/bucket IDs
- Implement data throttling for high-frequency updates
- Clean up timers and event listeners when the widget is destroyed
- Limit stored data to prevent memory issues

### TypeScript Support

The SDK includes comprehensive TypeScript definitions. For TypeScript projects:

```typescript
import "@tago-io/custom-widget";

// Types are automatically available
window.TagoIO.onStart((widget: TWidget) => {
    // Full type safety and IntelliSense support
    widget.display.variables.forEach((variable: TWidgetVariable) => {
        console.log(`Variable: ${variable.variable}, Device: ${variable.origin.id}`);
    });
});
```

## 🎨 UI Design Guidelines

### Responsive Design
All examples include responsive CSS Grid layouts:
```css
.widget-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
    padding: 20px;
}
```

### TagoIO Design Language
Use colors that complement TagoIO's interface:
- Primary: `#2196F3`
- Success: `#4CAF50`
- Warning: `#FF9800`
- Error: `#f44336`
- Neutral: `#607D8B`

### Accessibility
- Use semantic HTML elements
- Provide proper labels for form controls
- Ensure sufficient color contrast
- Support keyboard navigation

## 🔧 Advanced Features

### Working with Blueprint Devices
```javascript
window.TagoIO.onSyncBlueprintDevices(function(blueprintData) {
    // Access blueprint device configurations
    console.log('Blueprint settings:', blueprintData.settings);
    
    // Get currently selected devices
    console.log('Selected devices:', blueprintData.selected);
});
```

### User Context and Authentication
```javascript
window.TagoIO.onSyncUserInformation(function(userInfo) {
    // Access user language, token, and run URL
    console.log('User language:', userInfo.language);
    console.log('Has token:', !!userInfo.token);
    console.log('Run URL:', userInfo.runURL);
});
```

### Custom Header Configuration
```javascript
window.TagoIO.ready({
    header: {
        absolute: true,  // Position header absolutely
        color: '#2196F3' // Custom header color
    }
});
```

### Navigation and Modals
```javascript
// Navigate to another dashboard
window.TagoIO.openLink('https://admin.tago.io/dashboards/info/dashboard-id');

// Close modal (for header button widgets)
window.TagoIO.closeModal();
```

## 📦 Build Process

### Development Scripts

```bash
# Install dependencies
npm install

# Build the library
npm run build

# Run tests
npm test

# Type checking
npm run check:types

# Generate coverage report
npm run coverage
```

### Build Output

The build process generates:
- `dist/custom-widget.js` - Unminified library
- `dist/custom-widget.min.js` - Minified library
- `dist/custom-widget.css` - Optional styles
- `dist/custom-widget.min.css` - Minified styles

## 🤝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Ensure all tests pass: `npm test`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## 📞 Support & Community

### Getting Help

- **📖 [Help Documentation](https://help.tago.io/portal/en/kb/articles/450-custom-widget)** - Complete guide on creating custom widgets
- **💬 [Community Forum](https://community.tago.io)** - Ask questions and share knowledge
- **🐛 [Issue Tracker](https://github.com/tago-io/custom-widget/issues)** - Report bugs and request features
- **📧 [Support Email](mailto:support@tago.io)** - Direct technical support

### Useful Links

- **[TagoIO Platform](https://admin.tago.io)** - Main platform dashboard
- **[TagoIO Documentation](https://docs.tago.io)** - Complete platform documentation
- **[API Reference](https://api.tago.io)** - REST API documentation
- **[TagoRUN](https://run.tago.io)** - End-user portal documentation

## 📄 License

This project is licensed under the Apache-2.0 License - see the [LICENSE.md](LICENSE.md) file for details.

## 🏷️ Version Information

- **Current Version**: 1.1.0
- **Node.js Compatibility**: >= 14.0.0
- **Browser Support**: Modern browsers (ES6+)
- **TypeScript**: Full type definitions included

---

**Made by [Tago LLC](https://tago.io)**

For more information about TagoIO's IoT platform and services, visit [tago.io](https://tago.io).
