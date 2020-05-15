/**
 * This is the information of a single variable used in this widget's configuration.
 */
interface IVariable {
  /**
   * The name of the variable.
   */
  variable: string;
  /**
   * Current value of the variable.
   */
  value: string | number;
  /**
   * The ID of the current value of this variable.
   */
  id?: string;
  /**
   * Bucket that contains this variable.
   */
  bucket?: string;
  /**
   * The device that contains this variable.
   */
  origin?: string;
  /**
   * Time when the current value of this variable was sent.
   */
  time?: string;
}

/**
 * Information received from TagoIO's realtime.
 */
interface IRealtime {
  data?: {
    variable: [string];
    value: string | number;
    bucket?: string;
    origin?: string;
  };
  result?: [IVariable];
}

/**
 * Function used to receive data from TagoIO's realtime data. This is the first parameter
 * in the `onRealtime` function.
 */
interface ICallbackRealtime {
  (data: IRealtime[]): void;
}

/**
 * This error interface is responsible for providing information on why a specific API request didn't succeed.
 * It's used as the first parameter of the `onError` function.
 */
interface IError {
  /**
   * Status code of the API request (400, 401, ...).
   */
  status: boolean;
  /**
   * Error message, explains the cause of the error.
   */
  message: string;
  /**
   *
   */
  result: [IVariable];
  /**
   * Inner key of the iframe.
   */
  key: string;
}

interface IResultData {
  value?: [string];
  action: {
    type?: string;
    payload?: [string];
  };
}

interface IData {
  status: boolean;
  result: Array<IResultData>;
  key: string;
}

interface ICallbackError {
  (error: IEventData): void;
}

interface ITagoVariables {
  variable: string;
  origin: {
    id?: string;
    name?: string;
    bucket?: string;
  };
}

/**
 * A single widget's structure of TagoIO.
 */
interface IWidget {
  /**
   * Which Analysis should run whenever this widget sends data.
   */
  analysis_run?: null;
  /**
   * The dashboard that this widget belongs to.
   */
  dashboard: string;
  /**
   * Display properties of this widget.
   */
  display: {
    header_buttons?: [];
    help?: string;
    url?: string;
    variables: Array<ITagoVariables>;
    watermark?: boolean;
  };
  /**
   * Unique ID for this widget.
   */
  id: string;
  /**
   * Title of this widget.
   */
  label?: string;
  realtime?: null;
  /**
   * Unique type to differentiate this widget from others.
   */
  type?: string;
}

/**
 * Callback for the `onStart` function.
 */
interface ICallbackStart {
  (widget?: IWidget): void;
}

/**
 * Function that contains the result of the operation for sending data.
 */
interface ICallbackSendData {
  (data: IData, error?: IError): void;
}

/**
 * Options to be used when starting the widget.
 */
interface IReadyOptions {
  header?: {
    /**
     * Sets the widget's header position. If this is true, then the widget's header will not
     * occupy space in the widget. The default is false, meaning the header occupies space in the widget.
     */
    absolute?: boolean;
    /**
     * Changes the widget's header color.
     */
    color?: string;
  };
}

/**
 * This is responsible for communication with your widget and with TagoIO's server. Any action regarding your widget's data
 * will be found in this interface.
 */
interface ITagoIO {
  /**
   * This is an error callback listener that will get fired whenever an API error related to this widget occurs.
   *
   * For example if you send the wrong data structure to `sendData`.
   *
   *
   * @param callback function that runs when a TagoIO error arrives
   */
  onError: (callback: ICallbackError) => void;
  /**
   * Callback when the widget is started. In the parameter you will receive an object with the widget's configuration.
   *
   *
   * @param callback function that loads the information from the widget
   */
  onStart: (callback: ICallbackStart) => void;
  /**
   * Realtime data listener. This will get fired whenever this widget receives realtime data from TagoIO.
   *
   *
   * @param callback function that executes whenever realtime data arrives
   */
  onRealtime: (callback: ICallbackRealtime) => void;
  /**
   * Sends data to TagoIO's servers, this is the only way to send variables to your bucket.
   *
   * This function supports both a promise-based return or a callback return.
   *
   *
   * @param variables This is the data
   * @param callback Callback function
   * @return Promise or null
   */
  sendData: (variables: Array<IVariable>, callback?: ICallbackSendData) => Promise<IData> | void;
  /**
   * Delete data from TagoIO's servers
   *
   * This function supports both a promise-based return or a callback return.
   *
   *
   * @param variables This is the data
   * @param callback Callback function
   * @return Promise or null
   */
  deleteData: (variables: Array<IVariable>, callback?: ICallbackSendData) => Promise<IData> | void;
  /**
   * Edit data from TagoIO's servers
   *
   * This function supports both a promise-based return or a callback return.
   *
   *
   * @param variables This is the data
   * @param callback Callback function
   * @return Promise or null
   */
  editData: (variables: Array<IVariable>, callback?: ICallbackSendData) => Promise<IData> | void;
  /**
   * enables and disables auto fill of variables
   */
  autoFill: boolean;
  /**
   * This function signals to TagoIO that you're ready so start receiving and sending data to TagoIO, and thus,
   * this should be the first function you call as soon as you're ready to begin communication with TagoIO.
   */
  ready: (options: IReadyOptions) => void;
}

/**
 * .data property of the message received from the iframe.
 */
interface IEventData {
  realtime?: IRealtime[];
  widget?: IWidget;
  status?: boolean;
  key?: string;
  message?: string;
  result?: [IVariable | IResultData];
}

/**
 * Message received from the IFrame.
 */
interface IEvent {
  data: IEventData;
}

/**
 * Message sent to the IFrame.
 */
interface IMessage {
  loaded?: boolean;
  variables?: IVariable[];
  key?: string;
  options?: IReadyOptions;
  method?: string;
}

export {
  ITagoIO,
  ICallbackSendData,
  ICallbackStart,
  IWidget,
  ITagoVariables,
  IError,
  IData,
  IVariable,
  ICallbackRealtime,
  ICallbackError,
  IEvent,
  IMessage,
  IRealtime,
};
