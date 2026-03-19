/**
 * TagoIO Custom Widget SDK
 *
 * This is the main entry point for the TagoIO Custom Widget SDK. It provides a JavaScript
 * interface for creating interactive widgets that can be embedded in TagoIO dashboards.
 *
 * The SDK handles communication between your widget and the TagoIO platform through
 * a postMessage-based messaging system.
 */
/**
 * Global type declaration for the TagoIO SDK interface
 * This makes the TagoIO object available on the window object
 */
declare global {
    interface Window {
        /**
         * Send and receive data from the widget and variables from TagoIO
         */
        TagoIO: TTagoIO;
    }
}
/**
 * Event listener function that receives messages sent by the parent component
 *
 * This is the core communication handler that processes all messages from the TagoIO platform,
 * including widget initialization, real-time data updates, user information, and operation responses.
 *
 * @param event - Event coming from the parent component containing data and metadata
 */
declare const receiveMessage: (event: TEvent) => void;
/**
 * Send message to parent component
 *
 * This function handles all outbound communication from the widget to the TagoIO platform,
 * using the postMessage API to send data across iframe boundaries.
 *
 * @param message - Message object to send to the parent component
 */
declare const sendMessage: (message: TMessage) => void;
/**
 * Register a callback function to handle widget startup
 *
 * This callback is triggered when the widget is initialized and receives its configuration
 * from the TagoIO platform. Use this to set up your widget's initial state.
 *
 * @param callback - Function to call when the widget starts, receives widget configuration
 */
declare const onStart: (callback: TStartCallback) => void;
/**
 * Register a callback function to handle real-time data updates
 *
 * This callback is triggered whenever new data arrives for the variables configured
 * in your widget. Use this to update your widget's display with live data.
 *
 * @param callback - Function to call when real-time data is received
 */
declare const onRealtime: (callback: TRealtimeCallback) => void;
/**
 * Register a callback function to handle errors
 *
 * This callback is triggered when operations fail or other errors occur.
 * Use this to display error messages or handle error conditions gracefully.
 *
 * @param callback - Function to call when errors occur
 */
declare const onError: (callback: TErrorCallback) => void;
/**
 * Send data to TagoIO devices
 *
 * This is the primary function for sending data from your widget back to TagoIO devices.
 * It supports both callback and Promise patterns for handling responses.
 *
 * When autoFill is enabled, the function automatically determines the target device and bucket
 * based on the widget's variable configuration. When disabled, you must specify these manually.
 *
 * @param variables - Single data record or array of data records to send
 * @param callback - Optional callback function to handle the response
 * @returns Promise when no callback is provided, void when callback is provided
 */
declare const sendData: (variables: TDataRecord | TDataRecord[], callback?: TSendDataCallback) => Promise<TData> | undefined;
/**
 * Edit existing data in TagoIO devices
 *
 * This function allows you to modify existing data records in TagoIO devices.
 * Similar to sendData, it supports both callback and Promise patterns.
 *
 * @param variables - Single data record or array of data records to edit
 * @param callback - Optional callback function to handle the response
 * @returns Promise when no callback is provided, void when callback is provided
 */
declare const editData: (variables: TDataRecord | TDataRecord[], callback?: TSendDataCallback) => Promise<TData> | undefined;
/**
 * Delete data from TagoIO devices
 *
 * This function allows you to remove data records from TagoIO devices.
 * Use with caution as deleted data cannot be recovered.
 *
 * @param variables - Single data record or array of data records to delete
 * @param callback - Optional callback function to handle the response
 * @returns Promise when no callback is provided, void when callback is provided
 */
declare const deleteData: (variables: TDataRecord | TDataRecord[], callback?: TSendDataCallback) => Promise<TData> | undefined;
/**
 * Edit resource data in TagoIO
 *
 * This function allows you to modify resource-level data in TagoIO, which may include
 * configuration data, metadata, or other resource-specific information.
 *
 * @param variables - Single data record or array of data records to edit at resource level
 * @param callback - Optional callback function to handle the response
 * @returns Promise when no callback is provided, void when callback is provided
 */
declare const editResourceData: (variables: TDataRecord | TDataRecord[], callback?: TSendDataCallback) => Promise<TData> | undefined;
/**
 * Close the widget modal
 *
 * If your widget is displayed in a modal dialog, this function allows you to
 * programmatically close that modal from within the widget.
 */
declare const closeModal: TTagoIO["closeModal"];
/**
 * Export functions for potential direct import usage
 * These exports allow the functions to be imported directly in environments
 * where the global window.TagoIO object might not be preferred.
 */
export { closeModal, deleteData, editData, editResourceData, onError, onRealtime, onStart, receiveMessage, sendData, sendMessage, };
//# sourceMappingURL=custom-widget.d.ts.map