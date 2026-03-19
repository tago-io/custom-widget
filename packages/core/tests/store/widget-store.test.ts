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
    window.parent.postMessage = mockPostMessage;
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

    it("deleteData sends with method delete", () => {
      store.deleteData({ variable: "temp", value: 42 }).catch(() => {});
      const sentMessage = mockPostMessage.mock.calls[0][0];
      expect(sentMessage.method).toBe("delete");
    });

    it("editResourceData sends with method edit-resource", () => {
      store.editResourceData({ variable: "temp", value: 42 }).catch(() => {});
      const sentMessage = mockPostMessage.mock.calls[0][0];
      expect(sentMessage.method).toBe("edit-resource");
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
