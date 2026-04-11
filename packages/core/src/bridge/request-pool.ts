import type { TData, TError } from "../types/index.js";

export interface PendingRequest {
  resolve: (data: TData) => void;
  reject: (error: TError | Error) => void;
}

export class RequestPool {
  private pending = new Map<string, PendingRequest>();

  add(key: string, request: PendingRequest): void {
    this.pending.set(key, request);
  }

  resolve(key: string, data: TData): boolean {
    const request = this.pending.get(key);
    if (!request) return false;
    this.pending.delete(key);
    request.resolve(data);
    return true;
  }

  reject(key: string, error: TError): boolean {
    const request = this.pending.get(key);
    if (!request) return false;
    this.pending.delete(key);
    request.reject(error);
    return true;
  }

  rejectAll(reason: Error): void {
    for (const [, request] of this.pending) {
      request.reject(reason);
    }
    this.pending.clear();
  }

  get size(): number {
    return this.pending.size;
  }

  has(key: string): boolean {
    return this.pending.has(key);
  }
}
