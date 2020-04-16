interface IVariable {
  variable: string;
  value: string | number;
  id?: string;
  bucket?: string;
  origin?: string;
  time?: string;
}

interface IRealtime {
  data?: {
    variable: [string];
    value: string | number;
    bucket?: string;
    origin?: string;
  };
  result?: [IVariable];
}

interface ICallbackRealtime {
  (data: IRealtime): void;
}

interface IError {
  status: boolean;
  message: string;
  result: [IVariable];
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

interface IWidget {
  analysis_run?: null;
  dashboard: string;
  display: {
    header_buttons?: [];
    help?: string;
    url?: string;
    variables: Array<ITagoVariables>;
    watermark?: boolean;
  };
  id: string;
  label?: string;
  realtime?: null;
  type?: string;
}

interface ICallbackStart {
  (widget?: IWidget): void;
}

interface ICallbackSendData {
  (data: IData, error?: IError): void;
}

interface IOptions {
  autoFill: boolean;
}

interface ITagoIO {
  /**
   * @param callback function that runs when a TagoIO error arrives
   */
  onError: (callback: ICallbackError) => void;
  /**
   * @param callback function that loads the information from the widget
   */
  onStart: (callback: ICallbackStart) => void;
  /**
   * @param callback function that executes whenever a realtime data arrives
   */
  onRealtime: (callback: ICallbackRealtime) => void;
  /**
   * @param variables Array containing all variables
   * @param options Data sending options
   * @param callback function it performs when the response to the request arrives
   */
  sendData: (variables: Array<IVariable>, options: IOptions, callback: ICallbackSendData) => Promise<IData> | void;
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
