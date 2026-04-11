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
  private bridgeOptions: { allowedOrigins?: string[] };
  private unsubBridge: (() => void) | null = null;

  constructor(options: StoreOptions = {}) {
    this.strategy = options.realtimeStrategy ?? "merge";
    this.maxRecords = options.realtimeMaxRecords ?? 1000;
    this.readyOptions = options.readyOptions ?? {};
    this.bridgeOptions = { allowedOrigins: options.allowedOrigins };

    this.bridge = new MessageBridge(this.bridgeOptions);

    if (typeof window !== "undefined") {
      this.unsubBridge = this.bridge.onMessage(this.handleInbound);
    }
  }

  private handleInbound = (data: InboundMessage): void => {
    const partial: Partial<WidgetState> = {};

    if (data.userInformation) {
      partial.userInformation = data.userInformation;
    }

    if (data.blueprintDevices) {
      partial.blueprintDevices = data.blueprintDevices;
    }

    if (data.widget) {
      partial.widget = data.widget;
      partial.isReady = true;
    }

    if (data.status === false) {
      const error = data as unknown as TError;
      partial.errors = [...this.state.errors, error];
    }

    if (Object.keys(partial).length > 0) {
      this.state = { ...this.state, ...partial };
    }

    if (data.realtime) {
      this.updateRealtime(data.realtime);
    } else if (Object.keys(partial).length > 0) {
      this.emit();
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

    // Recreate bridge if it was destroyed (e.g. React StrictMode remount)
    if (this.bridge.isDestroyed) {
      this.bridge = new MessageBridge(this.bridgeOptions);
      if (typeof window !== "undefined") {
        this.unsubBridge = this.bridge.onMessage(this.handleInbound);
      }
    }

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

  deleteData(records: string | string[]): Promise<TData> {
    const vars = Array.isArray(records) ? records : [records];
    return this.bridge.sendWithResponse({ variables: vars as unknown as TDataRecordInput[], method: "delete" });
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

  runAnalysis(scope?: unknown): void {
    this.bridge.send({ method: "run-analysis", scope });
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
