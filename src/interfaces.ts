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
  (data: IRealtime): void;
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
 * Options to be used when sending data.
 */
interface IOptions {
  autoFill: boolean;
}

/**
 * Options to be used when starting the widget.
 */
interface IStartOptions {
  header: {
    /**
     * Changes the position of the card header
     */
    absolute: boolean;
    /**
     * Changes the card header color
     */
    color: string;
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
   * Starts the widget's flow. This should be the first function you call as soon as you're ready
   * to begin displaying your custom widget.
   *
   *
   * @param callback function that loads the information from the widget
   */
  onStart: (callback?: ICallbackStart) => void;
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
   * @param options Data sending options
   * @param callback Callback function
   * @return Promise or null
   */
  sendData: (variables: Array<IVariable>, options?: IOptions, callback?: ICallbackSendData) => Promise<IData> | void;
  /**
   * enables and disables auto fill of variables
   */
  autoFill: boolean;
  /**
   * starts communication with Tago
   */
  ready: (options: IStartOptions) => void;
}

interface IEventData {
  realtime?: IRealtime;
  widget?: IWidget | undefined;
  status?: boolean;
  key?: string;
  message?: string;
  result?: [IVariable | IResultData];
}

interface IEvent {
  data: IEventData;
}

interface IMessage {
  loaded?: boolean;
  variables?: IVariable[];
  key?: string;
  options?: IStartOptions;
}

export {
  ITagoIO,
  IOptions,
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
};
