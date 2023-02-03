import * as shortid from "shortid";

import { receiveMessage, onStart, onRealtime, onError, sendMessage, sendData, closeModal } from "./custom-widget";

// Mock the `shortid` library, but the `generate` method used in `spyOn` later to specify a key value per test.
vi.mock("shortid", () => ({
  generate: vi.fn(() => "staticKey"),
}));

const mockOnStartCallback = vi.fn();
const mockOnErrorCallback = vi.fn();
const mockOnRealtimeCallback = vi.fn();

const mockWidget = {
  dashboard: "dashboardId",
  id: "widgetId",
  display: { variables: [{ variable: "some_variable", origin: { id: "widgetDeviceId", bucket: "widgetBucketId" } }] },
};

describe("receiveMessage", () => {
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

  it("calls the start function when receiving the widget parameter with the widget configuration as argument", () => {
    receiveMessage({
      data: {
        widget: mockWidget,
      },
    });

    expect(mockOnStartCallback).toHaveBeenCalledWith(mockWidget);
    expect(mockOnRealtimeCallback).not.toHaveBeenCalled();
    expect(mockOnErrorCallback).not.toHaveBeenCalled();
  });

  it("calls the realtime callback when receiving the realtime parameter", () => {
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

    receiveMessage({
      data: {
        realtime: mockRealtimeData,
      },
    });

    expect(mockOnStartCallback).not.toHaveBeenCalled();
    expect(mockOnRealtimeCallback).toHaveBeenCalledWith(mockRealtimeData);
    expect(mockOnErrorCallback).not.toHaveBeenCalled();
  });

  it("calls the error callback when receiving a false status", () => {
    receiveMessage({
      data: {
        status: false,
      },
    });

    expect(mockOnStartCallback).not.toHaveBeenCalled();
    expect(mockOnRealtimeCallback).not.toHaveBeenCalled();
    expect(mockOnErrorCallback).toHaveBeenCalledWith({ status: false });
  });
});

describe("sendMessage", () => {
  const mockPostMessage = vi.fn();
  const originalWindowParent = window.parent;

  beforeAll(() => {
    window.parent.postMessage = mockPostMessage;
  });

  beforeEach(() => {
    mockPostMessage.mockClear();
  });

  afterAll(() => {
    window.parent = originalWindowParent;
  });

  it("sends a message to the parent element", () => {
    const mockMessage = { key: "testKey" };
    sendMessage(mockMessage);
    expect(mockPostMessage).toHaveBeenCalledWith(mockMessage, "*");
  });
});

describe("sendMessage", () => {
  const mockPostMessage = vi.fn();
  const originalWindowParent = window.parent;

  beforeAll(() => {
    window.parent.postMessage = mockPostMessage;
  });

  beforeEach(() => {
    mockPostMessage.mockClear();
  });

  afterAll(() => {
    window.parent = originalWindowParent;
  });

  it("sends a message to the parent element", () => {
    const mockMessage = { key: "testKey" };
    sendMessage(mockMessage);
    expect(mockPostMessage).toHaveBeenCalledWith(mockMessage, "*");
  });
});

describe("sendData", () => {
  const mockPostMessage = vi.fn();
  const originalWindowParent = window.parent;
  global.console.info = vi.fn();

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

  afterAll(() => {
    window.TagoIO.autoFill = true;
    window.parent = originalWindowParent;
  });

  it("sends data to the API with auto-fill disabled, without a callback for sendData", () => {
    window.TagoIO.autoFill = false;
    const key = "keyNoAutoFill";
    vi.spyOn(shortid, "generate").mockImplementation(() => key);
    // TODO Fix type for sending data to not require time Partial and definitely not require ID
    const mockDataToSend = { id: "asd", variable: "some_variable", value: "new value", time: "timestamp" };
    const mockMessage = { key: key, variables: [mockDataToSend] };
    const mockReceivedMessage = { data: { status: true, key: key } };
    const result = sendData(mockDataToSend);
    receiveMessage(mockReceivedMessage);
    expect(mockPostMessage).toHaveBeenCalledWith(mockMessage, "*");
    expect(result).resolves.toStrictEqual(mockReceivedMessage.data);
  });

  it("sends data to the API with auto-fill disabled, with a callback for sendData", () => {
    window.TagoIO.autoFill = false;
    const key = "keyNoAutoFillCallback";
    const mockSendDataCallback = vi.fn();
    vi.spyOn(shortid, "generate").mockImplementation(() => key);
    // TODO Fix type for sending data to not require time Partial and definitely not require ID
    const mockDataToSend = { id: "asd", variable: "some_variable", value: "new value", time: "timestamp" };
    const mockMessage = { key: key, variables: [mockDataToSend] };
    const mockReceivedMessage = { data: { status: true, key: key } };
    const result = sendData(mockDataToSend, mockSendDataCallback);
    receiveMessage(mockReceivedMessage);
    expect(mockPostMessage).toHaveBeenCalledWith(mockMessage, "*");
    expect(result).toBeUndefined();
    expect(mockSendDataCallback).toHaveBeenCalledWith(mockReceivedMessage.data);
  });

  it("sends data to the API with auto-fill enabled, without a callback for sendData", () => {
    const key = "keyAutoFill";
    vi.spyOn(shortid, "generate").mockImplementation(() => key);
    // TODO Fix type for sending data to not require time Partial and definitely not require ID
    const mockDataToSend = { id: "asd", variable: "some_variable", value: "new value", time: "timestamp" };
    const mockMessageAutoFilled = {
      key: key,
      variables: [{ ...mockDataToSend, device: "widgetDeviceId", origin: "widgetDeviceId", bucket: "widgetBucketId" }],
    };
    const mockReceivedMessage = { data: { status: true, key: key } };
    const result = sendData(mockDataToSend);
    receiveMessage(mockReceivedMessage);
    expect(mockPostMessage).toHaveBeenCalledWith(mockMessageAutoFilled, "*");
    expect(result).resolves.toStrictEqual(mockReceivedMessage.data);
  });

  it("sends data to the API with auto-fill enabled, with a callback for sendData", () => {
    const key = "keyAutoFillCallback";
    const mockSendDataCallback = vi.fn();
    vi.spyOn(shortid, "generate").mockImplementation(() => key);
    // TODO Fix type for sending data to not require time Partial and definitely not require ID
    const mockDataToSend = { id: "asd", variable: "some_variable", value: "new value", time: "timestamp" };
    const mockMessageAutoFilled = {
      key: key,
      variables: [{ ...mockDataToSend, device: "widgetDeviceId", origin: "widgetDeviceId", bucket: "widgetBucketId" }],
    };
    const mockReceivedMessage = { data: { status: true, key: key } };
    const result = sendData(mockDataToSend, mockSendDataCallback);
    receiveMessage(mockReceivedMessage);
    expect(mockPostMessage).toHaveBeenCalledWith(mockMessageAutoFilled, "*");
    expect(result).toBeUndefined();
    expect(mockSendDataCallback).toHaveBeenCalledWith(mockReceivedMessage.data);
  });
});

describe("closeModal", () => {
  const mockPostMessage = vi.fn();
  const originalWindowParent = window.parent;

  beforeAll(() => {
    window.parent.postMessage = mockPostMessage;
  });

  beforeEach(() => {
    mockPostMessage.mockClear();
  });

  afterAll(() => {
    window.parent = originalWindowParent;
  });

  it("sends the close modal message", () => {
    closeModal();
    expect(mockPostMessage).toHaveBeenCalledWith({ method: "close-modal" }, "*");
  });
});
