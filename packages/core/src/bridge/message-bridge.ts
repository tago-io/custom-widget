import type { InboundMessage, OutboundMessage, TData, TError } from "../types/index.js";
import { generateId } from "./generate-id.js";
import { RequestPool } from "./request-pool.js";

export interface MessageBridgeOptions {
  allowedOrigins?: string[];
}

export type MessageHandler = (data: InboundMessage) => void;

/** The message of the Error a request rejects with when the bridge is or gets destroyed. */
export const BRIDGE_DESTROYED = "MessageBridge destroyed";

export class MessageBridge {
  private allowedOrigins: Set<string> | null;
  private handlers = new Set<MessageHandler>();
  private pool = new RequestPool();
  private destroyed = false;
  private boundReceive: (event: MessageEvent) => void;

  constructor(options: MessageBridgeOptions = {}) {
    this.allowedOrigins = options.allowedOrigins ? new Set(options.allowedOrigins) : null;
    this.boundReceive = this.handleMessage.bind(this);

    if (typeof window !== "undefined") {
      window.addEventListener("message", this.boundReceive, false);
    }
  }

  private handleMessage(event: MessageEvent): void {
    if (this.destroyed) return;

    if (this.allowedOrigins && !this.allowedOrigins.has(event.origin)) {
      return;
    }

    const data = event.data as InboundMessage | undefined;
    if (!data) return;

    if (data.status !== undefined && data.key) {
      if (data.status) {
        this.pool.resolve(data.key, data as unknown as TData);
      } else {
        this.pool.reject(data.key, data as unknown as TError);
      }
    }

    for (const handler of this.handlers) {
      try {
        handler(data);
      } catch (err) {
        console.error("[TagoIO Widget] Message handler threw an error:", err);
      }
    }
  }

  send(message: OutboundMessage): void {
    if (this.destroyed) return;
    if (typeof window === "undefined") return;
    window.parent.postMessage(message, "*");
  }

  sendWithResponse(message: OutboundMessage): Promise<TData> {
    // A destroyed bridge posts nothing, so the request would never be answered.
    if (this.destroyed) {
      return Promise.reject(new Error(BRIDGE_DESTROYED));
    }

    const key = generateId();
    const messageWithKey = { ...message, key };

    return new Promise<TData>((resolve, reject) => {
      this.pool.add(key, { resolve, reject });
      try {
        this.send(messageWithKey);
      } catch (error) {
        // postMessage threw before posting, as with a DataCloneError, so no answer will come for this key.
        this.pool.reject(key, error as TError);
      }
    });
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  destroy(): void {
    this.destroyed = true;
    if (typeof window !== "undefined") {
      window.removeEventListener("message", this.boundReceive, false);
    }
    this.pool.rejectAll(new Error(BRIDGE_DESTROYED));
    this.handlers.clear();
  }

  get pendingCount(): number {
    return this.pool.size;
  }

  get isDestroyed(): boolean {
    return this.destroyed;
  }
}
