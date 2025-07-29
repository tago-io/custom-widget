# TagoIO Custom Widget Examples

This folder contains practical HTML examples demonstrating how to use the TagoIO Custom Widget SDK. Each example showcases different aspects and features of the SDK with complete, runnable code.

## 📋 Available Examples

### 1. **basic-widget.html** - Minimal Setup
**Purpose**: Demonstrates the minimal setup required to create a functional TagoIO Custom Widget.

**Features**:
- Widget initialization with `TagoIO.ready()`
- Handling widget startup with `onStart` callback
- Basic error handling with `onError`
- Pre-defined HTML structure and embedded styling
- Displaying widget configuration information

**Best for**: Beginners who want to understand the basic structure and lifecycle of a Custom Widget.

### 2. **read-data.html** - Data Retrieval
**Purpose**: Shows how to retrieve and display data from TagoIO devices using realtime data streams.

**Features**:
- Reading realtime data with `onRealtime` callback
- Accessing widget variable data
- Data formatting and display with animations
- Error handling for data operations
- Dynamic data cards with timestamps

**Best for**: Developers who need to display device data in their widgets.

### 3. **read-resource.html** - Resource Access
**Purpose**: Demonstrates how to access TagoIO resources like user information and blueprint devices.

**Features**:
- Accessing user information with `onSyncUserInformation`
- Working with blueprint devices using `onSyncBlueprintDevices`
- Displaying resource information in structured format
- Resource synchronization status tracking

**Best for**: Widgets that need to interact with TagoIO platform resources and user context.

### 4. **read-entity.html** - Entity Data Handling
**Purpose**: Shows how to work with structured entity-like data and complex data relationships.

**Features**:
- Working with entity-like data structures
- Handling complex data relationships
- Data organization by device/origin
- Statistical analysis of entity attributes
- Structured information display

**Best for**: Applications dealing with complex, structured IoT data that goes beyond simple variables.

### 5. **send-data.html** - Data Transmission
**Purpose**: Comprehensive example of sending data to TagoIO devices with different approaches.

**Features**:
- Sending single data points using Promise approach
- Sending multiple data points using callback approach
- Advanced data with metadata and location
- AutoFill functionality management
- Form-based data input with validation

**Best for**: Widgets that need to send data back to TagoIO devices or create interactive data input interfaces.

### 6. **time-interval.html** - Time-Based Operations
**Purpose**: Demonstrates working with time intervals, preset time ranges, and time-based data operations.

**Features**:
- Preset time intervals (5 minutes to 1 month)
- Custom time range selection
- Time-based data filtering and analysis
- Real-time clock display
- Time zone handling
- Statistical analysis over time periods

**Best for**: Dashboards that need time-based data analysis, historical data views, or time range controls.

### 7. **custom-units.html** - Unit Conversions
**Purpose**: Shows how to work with custom units and unit conversions for different measurement systems.

**Features**:
- Unit conversion between measurement systems
- Dynamic unit selection and display
- Support for temperature, distance, weight, and speed units
- Automatic unit detection from variable names
- Real-time unit preference switching
- Conversion examples and test data functionality

**Best for**: Applications dealing with sensor data that needs to be displayed in different unit systems.

## 🚀 How to Use These Examples

### Method 1: Direct HTML Upload (Recommended)
1. Download any of the HTML example files
2. Upload directly to TagoIO as a Custom Widget
3. The HTML files are complete and ready to use - they include:
   - TagoIO Custom Widget SDK reference
   - Complete HTML structure
   - Embedded CSS styling
   - JavaScript functionality in `<script>` tags

### Method 2: Development Environment
1. Clone this repository
2. Install dependencies: `npm install`
3. Use the examples as reference for your own widget development
4. Build your widget: `npm run build`

### Method 3: Copy and Customize
1. Open any HTML example file
2. Copy the HTML structure, CSS, and JavaScript code
3. Customize the styling and functionality for your needs
4. Upload to TagoIO as a Custom Widget

## 📖 Understanding the Examples

### Common Patterns

All examples follow these common patterns:

1. **Complete HTML Structure**: Each file is a complete HTML document with proper DOCTYPE, head, and body
2. **Embedded SDK**: TagoIO SDK is included via CDN: `<script src="https://admin.tago.io/dist/custom-widget.min.js"></script>`
3. **Widget Startup**: Use `window.TagoIO.onStart()` to handle widget initialization
4. **Error Handling**: Implement `window.TagoIO.onError()` for robust error handling
5. **Ready Signal**: Call `window.TagoIO.ready()` to signal the widget is ready
6. **Proper Cleanup**: Handle cleanup for timers and event listeners

### Key SDK Functions Demonstrated

| Function | Purpose | Examples Using It |
|----------|---------|-------------------|
| `TagoIO.ready()` | Signal widget is ready | All examples |
| `TagoIO.onStart()` | Handle widget startup | All examples |
| `TagoIO.onError()` | Handle errors | All examples |
| `TagoIO.onRealtime()` | Receive realtime data | read-data, read-entity, time-interval, custom-units |
| `TagoIO.sendData()` | Send data to devices | send-data, custom-units |
| `TagoIO.onSyncUserInformation()` | Access user info | read-resource |
| `TagoIO.onSyncBlueprintDevices()` | Access blueprint devices | read-resource |

## 🎨 Styling and UI

Each example includes:
- **Responsive CSS Grid layouts** for modern, flexible designs
- **Consistent color schemes** that match TagoIO's design language
- **Interactive elements** with hover effects and transitions
- **Mobile-friendly** responsive design
- **Accessibility considerations** with proper labels and contrast

## 🔧 Customization Tips

### Adapting Examples
1. **Change Colors**: Update CSS color variables to match your brand
2. **Modify Layouts**: Adjust CSS Grid properties for different layouts
3. **Add Features**: Combine patterns from multiple examples
4. **Error Handling**: Customize error messages and handling logic

### Performance Considerations
- **Data Limits**: Be mindful of data storage limits (examples include cleanup)
- **Update Frequency**: Implement throttling for high-frequency data updates
- **Memory Management**: Clear unused data and intervals

### Best Practices
- **Always handle errors** gracefully with user-friendly messages
- **Validate user input** before sending data
- **Provide loading states** for better user experience
- **Use semantic HTML** for accessibility
- **Test with different data types** and edge cases

## 📚 Additional Resources

- **[TagoIO Custom Widget Documentation](https://help.tago.io/portal/en/kb/articles/450-custom-widget)**
- **[TagoIO SDK Reference](https://github.com/tago-io/custom-widget)**
- **[Boilerplate Project](https://github.com/tago-io/custom-widget-boilerplate)**
- **[Send Data Example Project](https://github.com/tago-io/custom-widget-example-send-data)**
- **[Wizard Example Project](https://github.com/tago-io/custom-widget-example-wizard)**

## 🤝 Contributing

Found an issue or want to improve an example? Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

These examples are provided under the Apache-2.0 License. See the main repository LICENSE file for details. 