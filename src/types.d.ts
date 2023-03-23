/**
 * Type of the messaging methods according to the operation used.
 */
type TMethod = "delete" | "edit" | "edit-resource" | "send" | "open-link" | "close-modal" | "apply-formula";

/**
 * Type for the user information when passed to the Custom Widget.
 */
type TUserInformation = {
  token: string | null;
  language: string | null;
  runURL: string | null;
};

/**
 * Type for the results of the formulas being applied.
 */
type TFormulaResults = {
  /**
   * Unique identifier set by the Custom Widget when applying formulas to different datasets.
   *
   * Since postMessage is asynchronous, the Custom Widget can apply formulas to different datasets at the same time.
   */
  id: string;
  /**
   * Data with the formula applied.
   */
  data: TDataRecord[];
};

/**
 * Type for the event data received from the IFrame.
 */
type TEventData = {
  /**
   * Realtime data.
   */
  realtime?: TRealtimeData[];
  /**
   * Widget's configuration data.
   */
  widget?: TWidget;
  /**
   * Status for the API call related to the event.
   */
  status?: boolean;
  /**
   * Key for the IFrame element.
   */
  key?: string;
  /**
   * Message.
   */
  message?: string;
  /**
   * User information data.
   *
   * Useful for setting up functionalities such as the Dictionary inside the Custom Widget.
   */
  userInformation?: TUserInformation;
  /**
   * Results for the event's API call.
   */
  result?: TDataRecord[] | TResultData[];
  /**
   * Results from applying formula sent to the IFrame.
   */
  formulaResults?: TFormulaResults;
};

/**
 * Type for the messages sent from this library to the IFrame.
 */
type TMessage = {
  /**
   * Whether the the library has been loaded.
   */
  loaded?: boolean;
  /**
   * Data records for the API operation.
   */
  variables?: TDataRecord[];
  /**
   * Options for the apply formula method.
   */
  formulaOptions?: {
    id: string;
    settings: TFormulaSettings;
    data: TDataRecord[];
  };
  /**
   * Key for the IFrame element.
   */
  key?: string;
  /**
   * Options for the Custom Widget.
   */
  options?: TReadyOptions;
  /**
   * URL to be opened with the open link function.
   */
  url?: string;
  /**
   * Name of the method used in the operation depending on the Custom Widget library function called.
   *
   * When not passed, the default method is `"send"`.
   *
   * @default "send"
   */
  method?: TMethod;
};

/**
 * Type for the widget's configuration data.
 *
 * This is a simplified type covering only the properties used in this library.
 */
type TWidget = {
  /**
   * Widget ID.
   */
  id: string;
  /**
   * Dashboard ID for the widget.
   */
  dashboard: string;
  /**
   * Analysis to run whenever the Custom Widget sends data.
   */
  analysis_run?: string | null;
  /**
   * Display properties of the widget.
   */
  display: {
    header_buttons?: [];
    help?: string;
    url?: string;
    variables: TWidgetVariable[];
    watermark?: boolean;
  };
  /**
   * Widget's title. Displayed on the header.
   */
  label?: string;
  /**
   * Widget type.
   */
  type?: string;
};

/**
 * Type for the result data.
 */
type TResultData = {
  value?: string[];
  action: {
    type?: string;
    payload?: string[];
  };
};

/**
 * Type for the data returned from a successful callback.
 */
type TData = {
  /**
   * Status for the API request.
   */
  status: boolean;
  /**
   * Result data.
   */
  result: TResultData[];
  /**
   * Key for the IFrame element.
   */
  key: string;
};

/**
 * Type for the options to be used when starting the widget.
 */
type TReadyOptions = {
  header?: {
    /**
     * Set the widget's header position as absolute.
     *
     * When this is `true`, the header will not occupy space in the widget.
     */
    absolute?: boolean;
    /**
     * Color of the widget's header.
     */
    color?: string;
  };
};

/**
 * Type for the errors with information regarding failed API requests.
 */
type TError = {
  /**
   * Status of the API request.
   */
  status: boolean;
  /**
   * Error message explaining the cause of the error.
   */
  message: string;
  /**
   * Results from the API request.
   */
  result: TDataRecord[];
  /**
   * Key for the IFrame element.
   */
  key: string;
};

/**
 * Type for the data received from TagoIO's realtime endpoint.
 */
type TRealtimeData = {
  /**
   * Data object with information about where the result data belongs.
   */
  data?: {
    variable: string[];
    origin?: string;
    bucket?: string;
  };
  result?: TDataRecord[];
};

/**
 * Type for the callback function that handles receiving realtime data from TagoIO.
 *
 * @param data Data received from the realtime endpoint.
 */
type TRealtimeCallback = (data: TRealtimeData[]) => void;

/**
 * Type for the callback function that handles errors.
 *
 * @param eventData Event data that can be parsed to extract the errors.
 */
type TErrorCallback = (eventData: TEventData) => void;

/**
 * Type for the callback function that handles setting up the Custom Widget with the widget's settings.
 */
type TStartCallback = (widget: TWidget) => void;

/**
 * Type for the callback function to handle the results of data submission calls.
 */
type TSendDataCallback = (data: TData, error?: TError) => void;

/**
 * Type for the callback function to handle passing the user information to the Custom Widget.
 */
type TUserInformationCallback = (userInformation: TUserInformation) => void;

/**
 * Type for the callback function that handles receiving realtime data from TagoIO.
 *
 * @param data Data received from the realtime endpoint.
 */
type TReceiveFormulaResultsCallback = (formulaResults: TFormulaResults) => void;

/**
 * Type for the messages received from the IFrame.
 */
type TEvent = {
  /**
   * Event data.
   */
  data: TEventData;
};

/**
 * Type for the variables configured in the widget.
 */
type TWidgetVariable = {
  /**
   * Name of the variable configured on the widget's data section.
   */
  variable: string;
  /**
   * Origin of the variable.
   */
  origin: {
    /**
     * Device ID for the variable's origin.
     */
    id: string;
    /**
     * Bucket ID for the variable's origin.
     *
     * @deprecated Only for Legacy devices.
     */
    bucket?: string;
  };
};

/**
 * Type for the data records in the widget's variables.
 */
type TDataRecord = {
  /**
   * ID of the data record.
   */
  id: string;
  /**
   * Name of the variable for the data record.
   */
  variable: string;
  /**
   * Value of the data record.
   */
  value?: string | number | boolean;
  /**
   * Group for the data record.
   */
  group?: string;
  /**
   * Device ID for the data record's origin device.
   */
  device?: string;
  /**
   * Unit for the data record.
   */
  unit?: string;
  /**
   * Device ID for the data record's origin device.
   *
   * @deprecated Only relevant for Legacy devices.
   */
  // TODO Check if this is really the device ID.
  origin?: string;
  /**
   * Bucket ID for the data record's origin device.
   */
  bucket?: string;
  /**
   * Timestamp for the data record in the ISO 8601 format.
   */
  time: string;
};

// TODO
type TFormulaSettings = any;

/**
 * Type for the bridge interface between the Custom Widget's code and TagoIO's APIs.
 *
 * Any action regarding the widget's data is available in this type.
 */
type TTagoIO = {
  /**
   * Callback function that fires whenever an API error occurs on the widget's API calls.
   *
   * For example, this callback is called when the wrong data structure is passed to `sendData`.
   *
   * @param callback Callback function to be called on errors.
   */
  onError: (callback: TErrorCallback) => void;
  /**
   * Callback function that fires when the widget is started up.
   *
   * The callback function receives the object with the widget's settings.
   *
   * @param callback Callback function to be called when starting up the widget.
   */
  onStart: (callback: TStartCallback) => void;
  /**
   * Callback function that fires whenever the widget receives data from TagoIO's realtime endpoint.
   *
   * @param callback Callback function to be called when receiving realtime data.
   */
  onRealtime: (callback: TRealtimeCallback) => void;
  /**
   * Callback function that fires whenever the user information changes on Admin/RUN.
   *
   * @param callback Callback function to be called when receiving user information data.
   */
  onSyncUserInformation: (callback: TUserInformationCallback) => void;
  /**
   * Send device variables' data to the TagoIO API.
   *
   * This function supports both Promise-based return or callback returns.
   *
   * @param dataToSend Data to send in the devices' variables.
   * @param callback Callback function to send data to the API.
   *
   * @return Promise for the request itself or `undefined`.
   */
  sendData: (dataToSend: TDataRecord | TDataRecord[], callback?: TSendDataCallback) => Promise<TData> | void;
  /**
   * Delete device variables' data on the TagoIO API.
   *
   * This function supports both Promise-based return or callback returns.
   *
   * @param variables Data to delete in the devices' variables.
   * @param callback Callback function to delete data in the API.
   *
   * @return Promise for the request itself or `undefined`.
   */
  deleteData: (dataToDelete: TDataRecord | TDataRecord[], callback?: TSendDataCallback) => Promise<TData> | void;
  /**
   * Edit device variables' data on the TagoIO API.
   *
   * This function supports both Promise-based return or callback returns.
   *
   * @param dataToEdit Data to edit in the devices' variables.
   * @param callback Callback function to send data to the API.
   *
   * @return Promise for the request itself or `undefined`.
   */
  editData: (dataToEdit: TDataRecord | TDataRecord[], callback?: TSendDataCallback) => Promise<TData> | void;
  /**
   * Edit resource data (e.g devices or users) on the TagoIO API.
   *
   * This function supports both Promise-based return or callback returns.
   *
   * @param dataToEdit Data to edit in the resources.
   * @param callback Callback function to send data to the API.
   *
   * @return Promise for the request itself or `undefined`.
   */
  editResourceData: (dataToEdit: TDataRecord | TDataRecord[], callback?: TSendDataCallback) => Promise<TData> | void;
  /**
   * Whether the logic to auto-fill device and/or bucket IDs in the data being sent to the API is enabled.
   *
   * @default true
   */
  autoFill: boolean;
  /**
   * Function to signal TagoIO that the code is ready to start receiving and sending data.
   *
   * This function should be called on the Custom Widget's code as soon as it's ready to communicate with TagoIO.
   *
   * @param options Options for the Custom Widget.
   */
  ready: (options: TReadyOptions) => void;
  /**
   * Function to open a link from the Custom Widget with the ability to navigate to other dashboards.
   *
   * This function should be used on the elements (e.g. `<button>`, `<a>`) to open dashboards links,
   * such as passing `https://admin.tago.io/dashboards/info/dashboardId` will instruct the Custom Widget
   * to browse to the dashboard with `dashboardId` outside of the Custom Widget's content Iframe.
   *
   * @param url URL to open.
   */
  openLink: (url: string) => void;
  /**
   * Function to close the modal containing the Custom Widget if the widget is used in a header button.
   */
  closeModal: () => void;
  /**
   * Function to apply a formula to the data records.
   *
   * @param data Data records to apply the formula
   * @param formulaSettings Formula settings.
   */
  applyFormula: (data: TDataRecord[], formulaSettings: TFormulaSettings, options: { id: string }) => void;
};
