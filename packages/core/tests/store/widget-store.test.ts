import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { WidgetStore } from "../../src/store/widget-store.js";
import type { TRealtimeData, TUserInformation, TWidget, TBlueprintDevicesSyncData } from "../../src/types/index.js";

const mockWidget: TWidget = {
  id: "w1",
  dashboard: "d1",
  display: { variables: [{ variable: "temp", origin: { id: "dev1" } }] },
};

const mockUserInfo: TUserInformation = {
  token: "tok-123",
  language: "en",
  runURL: "https://run.tago.io",
};

const mockRealtime: TRealtimeData[] = [
  {
    data: { variable: ["temp"], origin: "dev1" },
    result: [{ id: "r1", variable: "temp", value: 25, time: "2024-01-01T00:00:00Z" }],
  },
];

const mockBlueprintDevices: TBlueprintDevicesSyncData = {
  selected: { bp1: { name: "Device 1", device: { id: "d1", name: "Dev 1" } } },
  settings: [{ name: "BP1", id: "bp1", conditions: [] }],
};

describe("WidgetStore", () => {
  let store: WidgetStore;
  let mockPostMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockPostMessage = vi.fn();
    window.parent.postMessage = mockPostMessage as typeof window.parent.postMessage;
    store = new WidgetStore();
  });

  afterEach(() => {
    store.destroy();
  });

  describe("initial state", () => {
    it("starts with empty state", () => {
      const state = store.getSnapshot();
      expect(state.widget).toBeNull();
      expect(state.realtimeData).toEqual([]);
      expect(state.userInformation).toBeNull();
      expect(state.blueprintDevices).toBeNull();
      expect(state.errors).toEqual([]);
      expect(state.isReady).toBe(false);
      expect(state.capabilities).toBeNull();
      expect(state.realtimeEventCount).toBe(0);
      expect(state.lastRealtimeAt).toBeNull();
    });

    it("returns a stable server snapshot", () => {
      const s1 = store.getServerSnapshot();
      const s2 = store.getServerSnapshot();
      expect(s1).toBe(s2);
      expect(s1.widget).toBeNull();
    });
  });

  describe("initialize", () => {
    it("sends loaded message on first call", () => {
      store.initialize();
      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({ loaded: true }), "*");
    });

    it("does not send loaded message on second call (Strict Mode safe)", () => {
      store.initialize();
      store.initialize();
      expect(mockPostMessage).toHaveBeenCalledTimes(1);
    });

    it("recreates bridge after destroy and reinitialize (StrictMode)", () => {
      store.initialize();
      expect(mockPostMessage).toHaveBeenCalledTimes(1);

      store.destroy();

      store.initialize();
      expect(mockPostMessage).toHaveBeenCalledTimes(2);

      // Verify new bridge receives messages
      const listener = vi.fn();
      store.subscribe(listener);
      window.dispatchEvent(new MessageEvent("message", { data: { widget: mockWidget } }));
      expect(listener).toHaveBeenCalled();
      expect(store.getSnapshot().widget).toEqual(mockWidget);
    });
  });

  describe("subscription", () => {
    it("notifies listeners on state change", () => {
      const listener = vi.fn();
      store.subscribe(listener);

      window.dispatchEvent(new MessageEvent("message", { data: { widget: mockWidget } }));

      expect(listener).toHaveBeenCalled();
    });

    it("stops notifying after unsubscribe", () => {
      const listener = vi.fn();
      const unsub = store.subscribe(listener);
      unsub();

      window.dispatchEvent(new MessageEvent("message", { data: { widget: mockWidget } }));

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("inbound message handling", () => {
    it("handles widget message", () => {
      window.dispatchEvent(new MessageEvent("message", { data: { widget: mockWidget } }));

      const state = store.getSnapshot();
      expect(state.widget).toEqual(mockWidget);
      expect(state.isReady).toBe(true);
    });

    it("stores the capabilities sent with the widget settings", () => {
      window.dispatchEvent(
        new MessageEvent("message", { data: { widget: mockWidget, capabilities: ["call-endpoint"] } })
      );

      expect(store.getSnapshot().capabilities).toEqual(["call-endpoint"]);
    });

    it("settles capabilities as empty when the host sends none", () => {
      window.dispatchEvent(new MessageEvent("message", { data: { widget: mockWidget } }));

      expect(store.getSnapshot().capabilities).toEqual([]);
    });

    it("handles userInformation message", () => {
      window.dispatchEvent(new MessageEvent("message", { data: { userInformation: mockUserInfo } }));

      expect(store.getSnapshot().userInformation).toEqual(mockUserInfo);
    });

    it("handles blueprintDevices message", () => {
      window.dispatchEvent(new MessageEvent("message", { data: { blueprintDevices: mockBlueprintDevices } }));

      expect(store.getSnapshot().blueprintDevices).toEqual(mockBlueprintDevices);
    });

    it("handles realtime message", () => {
      window.dispatchEvent(new MessageEvent("message", { data: { realtime: mockRealtime } }));

      const state = store.getSnapshot();
      expect(state.realtimeData).toHaveLength(1);
      expect(state.realtimeEventCount).toBe(1);
      expect(state.lastRealtimeAt).toBeGreaterThan(0);
    });

    it("handles error message", () => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { status: false, message: "Something failed", result: [], key: "k1" },
        })
      );

      const state = store.getSnapshot();
      expect(state.errors).toHaveLength(1);
      expect(state.errors[0].message).toBe("Something failed");
    });

    it("emits only once for a combined widget + userInformation message", () => {
      const listener = vi.fn();
      store.subscribe(listener);

      window.dispatchEvent(
        new MessageEvent("message", {
          data: { widget: mockWidget, userInformation: mockUserInfo },
        })
      );

      expect(listener).toHaveBeenCalledTimes(1);
      const state = store.getSnapshot();
      expect(state.widget).toEqual(mockWidget);
      expect(state.userInformation).toEqual(mockUserInfo);
    });
  });

  describe("structural sharing", () => {
    it("preserves widget reference when realtime updates", () => {
      window.dispatchEvent(new MessageEvent("message", { data: { widget: mockWidget } }));
      const widgetRef = store.getSnapshot().widget;

      window.dispatchEvent(new MessageEvent("message", { data: { realtime: mockRealtime } }));
      expect(store.getSnapshot().widget).toBe(widgetRef);
    });

    it("preserves userInformation reference when realtime updates", () => {
      window.dispatchEvent(new MessageEvent("message", { data: { userInformation: mockUserInfo } }));
      const userRef = store.getSnapshot().userInformation;

      window.dispatchEvent(new MessageEvent("message", { data: { realtime: mockRealtime } }));
      expect(store.getSnapshot().userInformation).toBe(userRef);
    });
  });

  describe("clearErrors", () => {
    it("clears the errors array", () => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { status: false, message: "err", result: [], key: "k1" },
        })
      );
      expect(store.getSnapshot().errors).toHaveLength(1);

      store.clearErrors();
      expect(store.getSnapshot().errors).toEqual([]);
    });
  });

  describe("clearRealtimeData", () => {
    it("resets realtime state", () => {
      window.dispatchEvent(new MessageEvent("message", { data: { realtime: mockRealtime } }));
      expect(store.getSnapshot().realtimeEventCount).toBe(1);

      store.clearRealtimeData();
      const state = store.getSnapshot();
      expect(state.realtimeData).toEqual([]);
      expect(state.realtimeEventCount).toBe(0);
      expect(state.lastRealtimeAt).toBeNull();
    });
  });

  describe("mutation methods", () => {
    it("sendData sends variables via bridge", async () => {
      const promise = store.sendData({ variable: "temp", value: 42 });

      const sentMessage = mockPostMessage.mock.calls[0][0];
      expect(sentMessage.variables).toEqual([{ variable: "temp", value: 42 }]);

      window.dispatchEvent(
        new MessageEvent("message", {
          data: { status: true, key: sentMessage.key, result: [] },
        })
      );

      await expect(promise).resolves.toEqual(expect.objectContaining({ status: true }));
    });

    it("editData sends with method edit", () => {
      store.editData({ variable: "temp", value: 42 }).catch(() => {});
      const sentMessage = mockPostMessage.mock.calls[0][0];
      expect(sentMessage.method).toBe("edit");
    });

    it("deleteData sends string payload with method delete", () => {
      store.deleteData("rec-1:dev-1").catch(() => {});
      const sentMessage = mockPostMessage.mock.calls[0][0];
      expect(sentMessage.method).toBe("delete");
      expect(sentMessage.variables).toEqual(["rec-1:dev-1"]);
    });

    it("editResourceData sends a device edit verbatim with method edit-resource", async () => {
      const promise = store.editResourceData({ device: "dev-1", name: "New name", "tags.type": "sensor" });

      const sentMessage = mockPostMessage.mock.calls[0][0];
      expect(sentMessage.method).toBe("edit-resource");
      expect(sentMessage.variables).toEqual([{ device: "dev-1", name: "New name", "tags.type": "sensor" }]);

      window.dispatchEvent(
        new MessageEvent("message", {
          data: { status: true, key: sentMessage.key, result: [] },
        })
      );

      await expect(promise).resolves.toEqual(expect.objectContaining({ status: true }));
    });

    it("editResourceData wraps a single user edit into an array", () => {
      store.editResourceData({ user: "usr-1", phone: "+1 555 0100" }).catch(() => {});
      const sentMessage = mockPostMessage.mock.calls[0][0];
      expect(sentMessage.variables).toEqual([{ user: "usr-1", phone: "+1 555 0100" }]);
    });

    it("editResourceData preserves entity edit arrays and numeric values", () => {
      store.editResourceData([{ id: "ent-1", entity: "entity-abc", status: "closed", value: 42 }]).catch(() => {});
      const sentMessage = mockPostMessage.mock.calls[0][0];
      expect(sentMessage.variables).toEqual([{ id: "ent-1", entity: "entity-abc", status: "closed", value: 42 }]);
    });
  });

  describe("callEndpoint", () => {
    const endpointID = "65f1c0a2b3d4e5f6a7b8c9d0";

    function hostReady(data: Record<string, unknown> = { capabilities: ["call-endpoint"] }) {
      window.dispatchEvent(new MessageEvent("message", { data: { widget: mockWidget, ...data } }));
    }

    function lastSent(): Record<string, unknown> {
      const calls = mockPostMessage.mock.calls;
      return calls[calls.length - 1][0] as Record<string, unknown>;
    }

    function reply(data: Record<string, unknown>) {
      window.dispatchEvent(
        new MessageEvent("message", { data: { key: lastSent().key, method: "call-endpoint", ...data } })
      );
    }

    it("rejects with not_ready before the widget settings arrive, posting nothing", async () => {
      await expect(store.callEndpoint(endpointID)).rejects.toEqual({ code: "not_ready", message: expect.any(String) });
      expect(mockPostMessage).not.toHaveBeenCalled();
    });

    it("rejects with unsupported on a host without the capability, posting nothing", async () => {
      hostReady({});

      await expect(store.callEndpoint(endpointID)).rejects.toEqual({
        code: "unsupported",
        message: expect.any(String),
      });
      expect(mockPostMessage).not.toHaveBeenCalled();
    });

    it("rejects a malformed ID with bad_request before the readiness check, posting nothing", async () => {
      await expect(store.callEndpoint("YOUR_ANALYSIS_ID")).rejects.toEqual({
        code: "bad_request",
        message: expect.any(String),
      });
      expect(mockPostMessage).not.toHaveBeenCalled();
    });

    it("posts the payload under call-endpoint without variables", async () => {
      hostReady();
      const promise = store.callEndpoint(endpointID, {
        method: "POST",
        path: "/setpoint",
        query: { dry_run: true, tag: ["a", "b"] },
        body: { setpoint: 22 },
      });

      expect(mockPostMessage).toHaveBeenLastCalledWith(
        {
          method: "call-endpoint",
          key: expect.any(String),
          payload: {
            endpoint_id: endpointID,
            method: "POST",
            path: "/setpoint",
            query: { dry_run: true, tag: ["a", "b"] },
            body: { setpoint: 22 },
          },
        },
        "*"
      );
      expect(lastSent()).not.toHaveProperty("variables");

      reply({ status: true, result: { status: 200, headers: {}, body: { ok: true } } });
      await promise;
    });

    it.each([200, 404, 422])("resolves with the unwrapped result for HTTP %i", async (status) => {
      hostReady();
      const promise = store.callEndpoint(endpointID);
      const result = { status, headers: { "content-type": "application/json" }, body: { status } };

      reply({ status: true, result });

      await expect(promise).resolves.toEqual(result);
    });

    it("maps a failure reply to { code, message } and keeps it out of state.errors", async () => {
      hostReady();
      const promise = store.callEndpoint(endpointID);

      reply({ status: false, code: "bad_request", message: "Invalid endpoint.call payload" });

      await expect(promise).rejects.toEqual({ code: "bad_request", message: "Invalid endpoint.call payload" });
      expect(store.getSnapshot().errors).toEqual([]);
    });

    it("uses api_error when a failure reply has no code", async () => {
      hostReady();
      const promise = store.callEndpoint(endpointID);

      reply({ status: false, message: "The Endpoint call failed" });

      await expect(promise).rejects.toEqual({ code: "api_error", message: "The Endpoint call failed" });
    });

    it.each([
      { label: "no result", data: {} },
      { label: "a data operation result", data: { result: [] } },
      { label: "a result without headers", data: { result: { status: 200, body: null } } },
    ])("rejects a success reply with $label as api_error", async ({ data }) => {
      hostReady();
      const promise = store.callEndpoint(endpointID);

      reply({ status: true, ...data });

      await expect(promise).rejects.toEqual({ code: "api_error", message: expect.any(String) });
    });

    it("maps a DataCloneError to bad_request", async () => {
      hostReady();
      mockPostMessage.mockImplementationOnce(() => {
        throw new DOMException("() => {} could not be cloned.", "DataCloneError");
      });

      await expect(store.callEndpoint(endpointID, { method: "POST", body: { save: () => {} } })).rejects.toEqual({
        code: "bad_request",
        message: expect.any(String),
      });
    });

    it("rejects with aborted when the store is destroyed mid-call", async () => {
      hostReady();
      const promise = store.callEndpoint(endpointID);

      store.destroy();

      await expect(promise).rejects.toEqual({ code: "aborted", message: expect.any(String) });
    });
  });

  describe("navigation", () => {
    it("openLink sends open-link message", () => {
      store.openLink("https://tago.io");
      expect(mockPostMessage).toHaveBeenCalledWith({ method: "open-link", url: "https://tago.io" }, "*");
    });

    it("closeModal sends close-modal message", () => {
      store.closeModal();
      expect(mockPostMessage).toHaveBeenCalledWith({ method: "close-modal" }, "*");
    });
  });

  describe("resources", () => {
    it("refreshResources sends refresh-resources message", () => {
      store.refreshResources();
      expect(mockPostMessage).toHaveBeenCalledWith({ method: "refresh-resources" }, "*");
    });
  });

  describe("destroy", () => {
    it("stops processing messages after destroy", () => {
      const listener = vi.fn();
      store.subscribe(listener);
      store.destroy();

      window.dispatchEvent(new MessageEvent("message", { data: { widget: mockWidget } }));
      expect(listener).not.toHaveBeenCalled();
    });

    it("rejects pending mutation promises", async () => {
      const promise = store.sendData({ variable: "temp", value: 42 });
      store.destroy();
      await expect(promise).rejects.toThrow("MessageBridge destroyed");
    });
  });

  describe("realtime strategies", () => {
    it("replace strategy swaps data entirely", () => {
      store.destroy();
      store = new WidgetStore({ realtimeStrategy: "replace" });

      const rt1: TRealtimeData[] = [
        { data: { variable: ["temp"] }, result: [{ id: "1", variable: "temp", value: 20, time: "t1" }] },
      ];
      const rt2: TRealtimeData[] = [
        { data: { variable: ["temp"] }, result: [{ id: "2", variable: "temp", value: 30, time: "t2" }] },
      ];

      window.dispatchEvent(new MessageEvent("message", { data: { realtime: rt1 } }));
      expect(store.getSnapshot().realtimeData).toHaveLength(1);

      window.dispatchEvent(new MessageEvent("message", { data: { realtime: rt2 } }));
      const state = store.getSnapshot();
      expect(state.realtimeData).toHaveLength(1);
      expect(state.realtimeData[0].result![0].value).toBe(30);
    });

    it("append strategy concatenates and caps", () => {
      store.destroy();
      store = new WidgetStore({ realtimeStrategy: "append", realtimeMaxRecords: 2 });

      for (let i = 0; i < 3; i++) {
        window.dispatchEvent(
          new MessageEvent("message", {
            data: {
              realtime: [
                { data: { variable: ["v"] }, result: [{ id: `${i}`, variable: "v", value: i, time: `t${i}` }] },
              ],
            },
          })
        );
      }

      expect(store.getSnapshot().realtimeData).toHaveLength(2);
    });
  });
});
