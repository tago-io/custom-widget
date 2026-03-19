import { MessageBridge } from "../bridge/message-bridge.js";
import type {
  InboundMessage,
  RealtimeStrategy,
  StoreOptions,
  TData,
  TDataRecordInput,
  TError,
  TReadyOptions,
  TRealtimeData,
  WidgetState,
} from "../types/index.js";
import { appendStrategy, mergeStrategy, replaceStrategy } from "./realtime-strategies.js";

const INITIAL_STATE: WidgetState = {
  widget: null,
  realtimeData: [],
  userInformation: null,
  blueprintDevices: null,
  errors: [],
  isReady: false,
  realtimeEventCount: 0,
  lastRealtimeAt: null,
};

const SERVER_SNAPSHOT: WidgetState = { ...INITIAL_STATE };

export class WidgetStore {
  private state: WidgetState = { ...INITIAL_STATE };
  private listeners = new Set<() => void>();
  private bridge: MessageBridge;
  private initialized = false;
  private strategy: RealtimeStrategy;
  private maxRecords: number;
  private readyOptions: TReadyOptions;
  private unsubBridge: (() => void) | null = null;

  constructor(options: StoreOptions = {}) {
    this.strategy = options.realtimeStrategy ?? "merge";
    this.maxRecords = options.realtimeMaxRecords ?? 1000;
    this.readyOptions = options.readyOptions ?? {};

    this.bridge = new MessageBridge({
      allowedOrigins: options.allowedOrigins,
    });

    if (typeof window !== "undefined") {
      this.unsubBridge = this.bridge.onMessage(this.handleInbound);
    }
  }

  private handleInbound = (data: InboundMessage): void => {
    if (data.userInformation) {
      this.updateState({ userInformation: data.userInformation });
    }

    if (data.blueprintDevices) {
      this.updateState({ blueprintDevices: data.blueprintDevices });
    }

    if (data.widget) {
      this.updateState({
        widget: data.widget,
        isReady: true,
      });
    }

    if (data.realtime) {
      this.updateRealtime(data.realtime);
    }

    if (data.status === false) {
      const error = data as unknown as TError;
      this.updateState({
        errors: [...this.state.errors, error],
      });
    }
  };

  private updateRealtime(incoming: TRealtimeData[]): void {
    let newData: TRealtimeData[];

    switch (this.strategy) {
      case "replace":
        newData = replaceStrategy(this.state.realtimeData, incoming);
        break;
      case "append":
        newData = appendStrategy(this.state.realtimeData, incoming, this.maxRecords);
        break;
      default:
        newData = mergeStrategy(this.state.realtimeData, incoming);
        break;
    }

    this.state = {
      ...this.state,
      realtimeData: newData,
      realtimeEventCount: this.state.realtimeEventCount + 1,
      lastRealtimeAt: Date.now(),
    };
    this.emit();
  }

  private updateState(partial: Partial<WidgetState>): void {
    this.state = { ...this.state, ...partial };
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  subscribe = (callback: () => void): (() => void) => {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  };

  getSnapshot = (): WidgetState => {
    return this.state;
  };

  getServerSnapshot = (): WidgetState => {
    return SERVER_SNAPSHOT;
  };

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.bridge.send({ loaded: true, ...this.readyOptions });
  }

  destroy(): void {
    this.unsubBridge?.();
    this.bridge.destroy();
    this.listeners.clear();
    this.initialized = false;
  }

  sendData(records: TDataRecordInput | TDataRecordInput[]): Promise<TData> {
    const vars = Array.isArray(records) ? records : [records];
    return this.bridge.sendWithResponse({ variables: vars });
  }

  editData(records: TDataRecordInput | TDataRecordInput[]): Promise<TData> {
    const vars = Array.isArray(records) ? records : [records];
    return this.bridge.sendWithResponse({ variables: vars, method: "edit" });
  }

  deleteData(records: TDataRecordInput | TDataRecordInput[]): Promise<TData> {
    const vars = Array.isArray(records) ? records : [records];
    return this.bridge.sendWithResponse({ variables: vars, method: "delete" });
  }

  editResourceData(records: TDataRecordInput | TDataRecordInput[]): Promise<TData> {
    const vars = Array.isArray(records) ? records : [records];
    return this.bridge.sendWithResponse({ variables: vars, method: "edit-resource" });
  }

  openLink(url: string): void {
    this.bridge.send({ method: "open-link", url });
  }

  closeModal(): void {
    this.bridge.send({ method: "close-modal" });
  }

  clearErrors(): void {
    this.updateState({ errors: [] });
  }

  clearRealtimeData(): void {
    this.updateState({
      realtimeData: [],
      realtimeEventCount: 0,
      lastRealtimeAt: null,
    });
  }

  getBridge(): MessageBridge {
    return this.bridge;
  }
}
