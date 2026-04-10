import type { TRealtimeData } from "@tago-io/custom-widget-core";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { closeModal, onError, onRealtime, onStart, runAnalysis, sendData } from "./custom-widget";

const mockRandomUUID = vi.fn(() => "staticKey");

Object.defineProperty(globalThis.crypto, "randomUUID", {
  value: mockRandomUUID,
  writable: true,
  configurable: true,
});

const mockOnStartCallback = vi.fn();
const mockOnErrorCallback = vi.fn();
const mockOnRealtimeCallback = vi.fn();

const mockWidget = {
  dashboard: "dashboardId",
  id: "widgetId",
  display: { variables: [{ variable: "some_variable", origin: { id: "widgetDeviceId", bucket: "widgetBucketId" } }] },
};

function simulateMessage(data: Record<string, unknown>) {
  window.dispatchEvent(new MessageEvent("message", { data }));
}

describe("message handling via store", () => {
  beforeAll(() => {
    onStart(mockOnStartCallback);
    onRealtime(mockOnRealtimeCallback);
    onError(mockOnErrorCallback);
  });

  beforeEach(() => {
    mockOnStartCallback.mockClear();
    mockOnErrorCallback.mockClear();
    mockOnRealtimeCallback.mockClear();
  });

  it("calls the start callback when receiving widget configuration", () => {
    simulateMessage({ widget: mockWidget });

    expect(mockOnStartCallback).toHaveBeenCalledWith(mockWidget);
    expect(mockOnRealtimeCallback).not.toHaveBeenCalled();
    expect(mockOnErrorCallback).not.toHaveBeenCalled();
  });

  it("calls the realtime callback when receiving realtime data", () => {
    const mockRealtimeData: TRealtimeData[] = [
      {
        data: { variable: ["some_variable"], origin: "deviceId", bucket: "bucketId" },
        result: [
          {
            id: "dataId",
            variable: "some_variable",
            device: "deviceId",
            bucket: "bucketId",
            time: "timestamp",
            value: "some value",
          },
        ],
      },
    ];

    simulateMessage({ realtime: mockRealtimeData });

    expect(mockOnStartCallback).not.toHaveBeenCalled();
    expect(mockOnRealtimeCallback).toHaveBeenCalled();
    expect(mockOnErrorCallback).not.toHaveBeenCalled();
  });

  it("calls the error callback when receiving a false status", () => {
    simulateMessage({ status: false, message: "Something went wrong", key: "err1" });

    expect(mockOnStartCallback).not.toHaveBeenCalled();
    expect(mockOnRealtimeCallback).not.toHaveBeenCalled();
    expect(mockOnErrorCallback).toHaveBeenCalled();
  });
});

describe("sendData", () => {
  const mockPostMessage = vi.fn();

  beforeAll(() => {
    window.parent.postMessage = mockPostMessage;
    onStart(mockOnStartCallback);
    onError(mockOnErrorCallback);
  });

  beforeEach(() => {
    window.TagoIO.autoFill = true;
    mockOnStartCallback.mockClear();
    mockOnErrorCallback.mockClear();
    mockPostMessage.mockClear();
  });

  it("throws when autoFill is disabled and records lack origin", () => {
    window.TagoIO.autoFill = false;

    expect(() => {
      void sendData({ id: "r1", variable: "temp", value: 42, time: "t1" } as never);
    }).toThrow("origin");
  });

  it("sends data with auto-fill disabled and resolves the promise on response", async () => {
    window.TagoIO.autoFill = false;
    const mockDataToSend = {
      id: "asd",
      variable: "some_variable",
      value: "new value",
      time: "timestamp",
      origin: "o1",
    };

    const result = sendData(mockDataToSend);

    const sentCall = mockPostMessage.mock.calls[0][0];
    const key = sentCall.key;
    expect(sentCall.variables).toStrictEqual([mockDataToSend]);

    simulateMessage({ status: true, key, result: [] });

    await expect(result).resolves.toMatchObject({ status: true, key });
  });

  it("sends data with auto-fill disabled and invokes callback on response", () => {
    window.TagoIO.autoFill = false;
    const mockSendDataCallback = vi.fn();
    const mockDataToSend = {
      id: "asd",
      variable: "some_variable",
      value: "new value",
      time: "timestamp",
      origin: "o1",
    };

    const result = sendData(mockDataToSend, mockSendDataCallback);

    const sentCall = mockPostMessage.mock.calls[0][0];
    const key = sentCall.key;

    simulateMessage({ status: true, key, result: [] });

    expect(result).toBeUndefined();
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(mockSendDataCallback).toHaveBeenCalled();
        resolve();
      }, 10);
    });
  });

  it("sends data with auto-fill enabled, filling bucket and origin from widget variables", async () => {
    simulateMessage({ widget: mockWidget });

    const mockDataToSend = { id: "asd", variable: "some_variable", value: "new value", time: "timestamp" };
    const result = sendData(mockDataToSend);

    const sentCall = mockPostMessage.mock.calls.find(
      (call: unknown[]) => (call[0] as Record<string, unknown>).variables !== undefined
    );
    expect(sentCall).toBeDefined();
    const sentMessage = (sentCall as unknown[])[0] as Record<string, unknown>;
    expect(sentMessage.variables).toStrictEqual([
      { ...mockDataToSend, device: "widgetDeviceId", origin: "widgetDeviceId", bucket: "widgetBucketId" },
    ]);

    simulateMessage({ status: true, key: sentMessage.key, result: [] });

    await expect(result).resolves.toMatchObject({ status: true });
  });
});

describe("closeModal", () => {
  const mockPostMessage = vi.fn();

  beforeAll(() => {
    window.parent.postMessage = mockPostMessage;
  });

  beforeEach(() => {
    mockPostMessage.mockClear();
  });

  it("sends the close modal message", () => {
    closeModal();
    expect(mockPostMessage).toHaveBeenCalledWith({ method: "close-modal" }, "*");
  });
});

describe("runAnalysis", () => {
  const mockPostMessage = vi.fn();

  beforeAll(() => {
    window.parent.postMessage = mockPostMessage;
  });

  beforeEach(() => {
    mockPostMessage.mockClear();
  });

  it("sends run-analysis message without scope", () => {
    runAnalysis();
    expect(mockPostMessage).toHaveBeenCalledWith({ method: "run-analysis", scope: undefined }, "*");
  });

  it("sends run-analysis message with scope", () => {
    const scope = [
      {
        variable: "command",
        value: "restart",
        metadata: {
          ports: [1, 2, 3],
          devices: ["device-abc", "device-def"],
        },
      },
    ];

    runAnalysis(scope);
    expect(mockPostMessage).toHaveBeenCalledWith({ method: "run-analysis", scope }, "*");
  });
});
