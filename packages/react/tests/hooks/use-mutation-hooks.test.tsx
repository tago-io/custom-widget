import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { useDeleteData } from "../../src/hooks/use-delete-data.js";
import { useEditData } from "../../src/hooks/use-edit-data.js";
import { useEditResourceData } from "../../src/hooks/use-edit-resource-data.js";
import { useSendData } from "../../src/hooks/use-send-data.js";
import { TagoIOProvider } from "../../src/provider/tago-io-provider.js";

let postMessageSpy: ReturnType<typeof vi.spyOn>;

function wrapper({ children }: { children: ReactNode }) {
  return <TagoIOProvider>{children}</TagoIOProvider>;
}

function respondToLastMessage(status: boolean) {
  const calls = postMessageSpy.mock.calls;
  const lastCall = calls[calls.length - 1];
  const key = (lastCall[0] as Record<string, unknown>).key;
  if (key) {
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { status, key, result: [], ...(status ? {} : { message: "failed" }) },
      })
    );
  }
}

describe("mutation hooks", () => {
  beforeEach(() => {
    postMessageSpy = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
  });

  describe("useSendData", () => {
    it("sends data and resolves on success", async () => {
      const { result } = renderHook(() => useSendData(), { wrapper });

      expect(result.current.isSending).toBe(false);
      expect(result.current.error).toBeNull();

      let promise: Promise<unknown>;
      act(() => {
        promise = result.current.sendData({ variable: "temp", value: 42 });
      });

      expect(result.current.isSending).toBe(true);

      await act(async () => {
        respondToLastMessage(true);
        await promise!;
      });

      expect(result.current.isSending).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("sends data and captures error on failure", async () => {
      const { result } = renderHook(() => useSendData(), { wrapper });

      let promise: Promise<unknown>;
      act(() => {
        promise = result.current.sendData({ variable: "temp", value: 42 }).catch(() => {});
      });

      await act(async () => {
        respondToLastMessage(false);
        await promise!;
      });

      expect(result.current.isSending).toBe(false);
      expect(result.current.error).toBeDefined();
    });

    it("reset clears error state", async () => {
      const { result } = renderHook(() => useSendData(), { wrapper });

      let promise: Promise<unknown>;
      act(() => {
        promise = result.current.sendData({ variable: "temp", value: 42 }).catch(() => {});
      });

      await act(async () => {
        respondToLastMessage(false);
        await promise!;
      });

      expect(result.current.error).toBeDefined();

      act(() => {
        result.current.reset();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.isSending).toBe(false);
    });
  });

  describe("useEditData", () => {
    it("sends edit request", async () => {
      const { result } = renderHook(() => useEditData(), { wrapper });

      let promise: Promise<unknown>;
      act(() => {
        promise = result.current.editData({ variable: "temp", value: 42 });
      });

      const sentMessage = postMessageSpy.mock.calls[postMessageSpy.mock.calls.length - 1][0] as Record<string, unknown>;
      expect(sentMessage.method).toBe("edit");

      await act(async () => {
        respondToLastMessage(true);
        await promise!;
      });

      expect(result.current.isEditing).toBe(false);
    });
  });

  describe("useDeleteData", () => {
    it("sends delete request with id:device payload format", async () => {
      const { result } = renderHook(() => useDeleteData(), { wrapper });

      let promise: Promise<unknown>;
      act(() => {
        promise = result.current.deleteData({
          id: "rec-1",
          device: "dev-1",
          variable: "temp",
          value: 42,
          time: "2024-01-01T00:00:00Z",
        });
      });

      const sentMessage = postMessageSpy.mock.calls[postMessageSpy.mock.calls.length - 1][0] as Record<string, unknown>;
      expect(sentMessage.method).toBe("delete");
      expect(sentMessage.variables).toEqual(["rec-1:dev-1"]);

      await act(async () => {
        respondToLastMessage(true);
        await promise!;
      });

      expect(result.current.isDeleting).toBe(false);
    });
  });

  describe("useEditResourceData", () => {
    it("sends edit-resource request", async () => {
      const { result } = renderHook(() => useEditResourceData(), { wrapper });

      let promise: Promise<unknown>;
      act(() => {
        promise = result.current.editResourceData({ variable: "temp", value: 42 });
      });

      const sentMessage = postMessageSpy.mock.calls[postMessageSpy.mock.calls.length - 1][0] as Record<string, unknown>;
      expect(sentMessage.method).toBe("edit-resource");

      await act(async () => {
        respondToLastMessage(true);
        await promise!;
      });

      expect(result.current.isEditing).toBe(false);
    });
  });
});
