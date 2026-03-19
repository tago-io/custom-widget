import { MessageBridge } from "../../src/bridge/message-bridge.js";

describe("MessageBridge", () => {
  let bridge: MessageBridge;
  let mockPostMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockPostMessage = vi.fn();
    window.parent.postMessage = mockPostMessage;
    bridge = new MessageBridge();
  });

  afterEach(() => {
    bridge.destroy();
  });

  describe("send", () => {
    it("posts a message to parent with wildcard origin", () => {
      bridge.send({ loaded: true });
      expect(mockPostMessage).toHaveBeenCalledWith({ loaded: true }, "*");
    });

    it("does not send after destroy", () => {
      bridge.destroy();
      bridge.send({ loaded: true });
      expect(mockPostMessage).not.toHaveBeenCalled();
    });
  });

  describe("onMessage", () => {
    it("calls handler when a message event is dispatched", () => {
      const handler = vi.fn();
      bridge.onMessage(handler);

      window.dispatchEvent(new MessageEvent("message", { data: { widget: { id: "w1" } } }));

      expect(handler).toHaveBeenCalledWith({ widget: { id: "w1" } });
    });

    it("unsubscribes when the returned function is called", () => {
      const handler = vi.fn();
      const unsub = bridge.onMessage(handler);
      unsub();

      window.dispatchEvent(new MessageEvent("message", { data: { widget: { id: "w1" } } }));

      expect(handler).not.toHaveBeenCalled();
    });

    it("ignores messages with no data", () => {
      const handler = vi.fn();
      bridge.onMessage(handler);

      window.dispatchEvent(new MessageEvent("message", { data: null }));

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("origin validation", () => {
    it("drops messages from disallowed origins", () => {
      bridge.destroy();
      bridge = new MessageBridge({ allowedOrigins: ["https://admin.tago.io"] });
      const handler = vi.fn();
      bridge.onMessage(handler);

      window.dispatchEvent(
        new MessageEvent("message", {
          data: { widget: { id: "w1" } },
          origin: "https://evil.com",
        })
      );

      expect(handler).not.toHaveBeenCalled();
    });

    it("accepts messages from allowed origins", () => {
      bridge.destroy();
      bridge = new MessageBridge({ allowedOrigins: ["https://admin.tago.io"] });
      const handler = vi.fn();
      bridge.onMessage(handler);

      window.dispatchEvent(
        new MessageEvent("message", {
          data: { widget: { id: "w1" } },
          origin: "https://admin.tago.io",
        })
      );

      expect(handler).toHaveBeenCalledWith({ widget: { id: "w1" } });
    });

    it("accepts all origins when allowedOrigins is not set", () => {
      const handler = vi.fn();
      bridge.onMessage(handler);

      window.dispatchEvent(
        new MessageEvent("message", {
          data: { widget: { id: "w1" } },
          origin: "https://anything.com",
        })
      );

      expect(handler).toHaveBeenCalled();
    });
  });

  describe("sendWithResponse", () => {
    it("resolves when a matching success response arrives", async () => {
      const promise = bridge.sendWithResponse({ variables: [] });

      const sentMessage = mockPostMessage.mock.calls[0][0];
      const key = sentMessage.key;
      expect(key).toBeDefined();

      window.dispatchEvent(
        new MessageEvent("message", {
          data: { status: true, key, result: [] },
        })
      );

      await expect(promise).resolves.toEqual({ status: true, key, result: [] });
    });

    it("rejects when a matching error response arrives", async () => {
      const promise = bridge.sendWithResponse({ variables: [] });

      const sentMessage = mockPostMessage.mock.calls[0][0];
      const key = sentMessage.key;

      window.dispatchEvent(
        new MessageEvent("message", {
          data: { status: false, key, message: "error", result: [] },
        })
      );

      await expect(promise).rejects.toEqual({ status: false, key, message: "error", result: [] });
    });
  });

  describe("destroy", () => {
    it("rejects all pending requests", async () => {
      const promise = bridge.sendWithResponse({ variables: [] });
      bridge.destroy();

      await expect(promise).rejects.toThrow("MessageBridge destroyed");
    });

    it("removes the event listener", () => {
      const handler = vi.fn();
      bridge.onMessage(handler);
      bridge.destroy();

      window.dispatchEvent(new MessageEvent("message", { data: { widget: { id: "w1" } } }));

      expect(handler).not.toHaveBeenCalled();
    });

    it("reports 0 pending after destroy", () => {
      bridge.sendWithResponse({ variables: [] }).catch(() => {});
      expect(bridge.pendingCount).toBe(1);
      bridge.destroy();
      expect(bridge.pendingCount).toBe(0);
    });
  });
});
