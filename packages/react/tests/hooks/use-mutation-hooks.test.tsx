import { render, renderHook, act } from "@testing-library/react";
import { Activity, type ReactNode } from "react";
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

function respond(key: unknown, status: boolean) {
  window.dispatchEvent(
    new MessageEvent("message", {
      data: { status, key, result: [], ...(status ? {} : { message: "failed" }) },
    })
  );
}

function respondToLastMessage(status: boolean) {
  const calls = postMessageSpy.mock.calls;
  const lastCall = calls[calls.length - 1];
  const key = (lastCall[0] as Record<string, unknown>).key;
  if (key) {
    respond(key, status);
  }
}

/** Keys of the last `count` requests posted, oldest first. */
function lastRequestKeys(count: number): unknown[] {
  return (postMessageSpy.mock.calls as unknown[][])
    .map((call) => (call[0] as Record<string, unknown>).key)
    .filter((key) => key !== undefined)
    .slice(-count);
}

const storedRecord = {
  id: "rec-1",
  device: "dev-1",
  variable: "temp",
  value: 42,
  time: "2024-01-01T00:00:00Z",
};

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

    it("stores the Error when postMessage cannot copy the request", async () => {
      const { result } = renderHook(() => useSendData(), { wrapper });
      const cloneError = new DOMException("() => {} could not be cloned.", "DataCloneError");
      postMessageSpy.mockImplementationOnce(() => {
        throw cloneError;
      });

      await act(async () => {
        await result.current.sendData({ variable: "temp", value: 42 }).catch(() => {});
      });

      // What postMessage threw, not a dashboard reply: it has a message and no status.
      expect(result.current.error).toBe(cloneError);
      expect(result.current.error).not.toHaveProperty("status");
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
        promise = result.current.editResourceData({ device: "dev-1", name: "Renamed" });
      });

      const sentMessage = postMessageSpy.mock.calls[postMessageSpy.mock.calls.length - 1][0] as Record<string, unknown>;
      expect(sentMessage.method).toBe("edit-resource");
      expect(sentMessage.variables).toEqual([{ device: "dev-1", name: "Renamed" }]);

      await act(async () => {
        respondToLastMessage(true);
        await promise!;
      });

      expect(result.current.isEditing).toBe(false);
    });
  });

  // Each hook as { call, isBusy, error, reset }, so the same cases run against all four.
  describe.each([
    {
      name: "useSendData",
      useMutation: () => {
        const { sendData, isSending, error, reset } = useSendData();
        return { call: () => sendData({ variable: "temp", value: 42 }), isBusy: isSending, error, reset };
      },
    },
    {
      name: "useEditData",
      useMutation: () => {
        const { editData, isEditing, error, reset } = useEditData();
        return { call: () => editData({ variable: "temp", value: 42 }), isBusy: isEditing, error, reset };
      },
    },
    {
      name: "useDeleteData",
      useMutation: () => {
        const { deleteData, isDeleting, error, reset } = useDeleteData();
        return { call: () => deleteData(storedRecord), isBusy: isDeleting, error, reset };
      },
    },
    {
      name: "useEditResourceData",
      useMutation: () => {
        const { editResourceData, isEditing, error, reset } = useEditResourceData();
        return { call: () => editResourceData({ device: "dev-1", name: "Renamed" }), isBusy: isEditing, error, reset };
      },
    },
  ])("$name follows the latest call", ({ useMutation }) => {
    it("stays busy until the second of two overlapping calls settles", async () => {
      const { result } = renderHook(() => useMutation(), { wrapper });

      let first!: Promise<unknown>;
      let second!: Promise<unknown>;
      act(() => {
        first = result.current.call();
        second = result.current.call();
      });
      const [firstKey, secondKey] = lastRequestKeys(2);

      await act(async () => {
        respond(firstKey, true);
        await first;
      });
      expect(result.current.isBusy).toBe(true);

      await act(async () => {
        respond(secondKey, true);
        await second;
      });
      expect(result.current.isBusy).toBe(false);
    });

    it("keeps a stale failure of the first call out of error", async () => {
      const { result } = renderHook(() => useMutation(), { wrapper });

      let firstOutcome!: Promise<unknown>;
      let second!: Promise<unknown>;
      act(() => {
        firstOutcome = result.current.call().catch((error: unknown) => error);
        second = result.current.call();
      });
      const [firstKey, secondKey] = lastRequestKeys(2);

      await act(async () => {
        respond(firstKey, false);
        await firstOutcome;
      });
      // The first call still rejects its own promise.
      await expect(firstOutcome).resolves.toMatchObject({ status: false, message: "failed" });
      expect(result.current.error).toBeNull();
      expect(result.current.isBusy).toBe(true);

      await act(async () => {
        respond(secondKey, true);
        await second;
      });
      expect(result.current.error).toBeNull();
      expect(result.current.isBusy).toBe(false);
    });

    it("reset clears the state and detaches the call in flight", async () => {
      const { result } = renderHook(() => useMutation(), { wrapper });

      let outcome!: Promise<unknown>;
      act(() => {
        outcome = result.current.call().catch((error: unknown) => error);
      });
      const [key] = lastRequestKeys(1);
      expect(result.current.isBusy).toBe(true);

      act(() => {
        result.current.reset();
      });
      expect(result.current.isBusy).toBe(false);

      await act(async () => {
        respond(key, false);
        await outcome;
      });
      await expect(outcome).resolves.toMatchObject({ status: false, message: "failed" });
      expect(result.current.error).toBeNull();
      expect(result.current.isBusy).toBe(false);
    });
  });

  describe("under StrictMode", () => {
    // reactStrictMode renders StrictMode above the wrapper. React replays effects only for a newly mounted
    // tree that starts at or inside StrictMode, so a wrapper that renders StrictMode itself would skip it.
    const strictOptions = { wrapper, reactStrictMode: true };

    it("useSendData clears isSending when the reply arrives", async () => {
      const { result } = renderHook(() => useSendData(), strictOptions);

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

    it("useSendData stores the rejection and clears isSending", async () => {
      const { result } = renderHook(() => useSendData(), strictOptions);

      let promise: Promise<unknown>;
      act(() => {
        promise = result.current.sendData({ variable: "temp", value: 42 }).catch(() => {});
      });

      expect(result.current.isSending).toBe(true);

      await act(async () => {
        respondToLastMessage(false);
        await promise!;
      });

      expect(result.current.isSending).toBe(false);
      expect(result.current.error).toMatchObject({ status: false, message: "failed" });
    });

    it("useEditData clears isEditing when the reply arrives", async () => {
      const { result } = renderHook(() => useEditData(), strictOptions);

      let promise: Promise<unknown>;
      act(() => {
        promise = result.current.editData({ variable: "temp", value: 42 });
      });

      expect(result.current.isEditing).toBe(true);

      await act(async () => {
        respondToLastMessage(true);
        await promise!;
      });

      expect(result.current.isEditing).toBe(false);
    });

    it("useDeleteData clears isDeleting when the reply arrives", async () => {
      const { result } = renderHook(() => useDeleteData(), strictOptions);

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

      expect(result.current.isDeleting).toBe(true);

      await act(async () => {
        respondToLastMessage(true);
        await promise!;
      });

      expect(result.current.isDeleting).toBe(false);
    });

    it("useEditResourceData clears isEditing when the reply arrives", async () => {
      const { result } = renderHook(() => useEditResourceData(), strictOptions);

      let promise: Promise<unknown>;
      act(() => {
        promise = result.current.editResourceData({ device: "dev-1", name: "Renamed" });
      });

      expect(result.current.isEditing).toBe(true);

      await act(async () => {
        respondToLastMessage(true);
        await promise!;
      });

      expect(result.current.isEditing).toBe(false);
    });
  });

  describe("inside an <Activity> hidden while the reply arrives", () => {
    // Hiding an <Activity> runs the effect cleanups of the hidden tree. The reply that lands meanwhile still has to
    // clear the busy flag, and store a failure, so both show once the tree is visible again.
    function renderInActivity<T>(useHook: () => T) {
      const latest: { current?: T } = {};
      function Probe() {
        latest.current = useHook();
        return null;
      }
      const tree = (mode: "visible" | "hidden") => (
        <TagoIOProvider>
          <Activity mode={mode}>
            <Probe />
          </Activity>
        </TagoIOProvider>
      );
      const view = render(tree("visible"));
      return {
        hook: () => latest.current as T,
        replyWhileHidden: async (promise: Promise<unknown>, status: boolean) => {
          view.rerender(tree("hidden"));
          await act(async () => {
            respondToLastMessage(status);
            await promise;
          });
          view.rerender(tree("visible"));
        },
      };
    }

    it("useSendData clears isSending", async () => {
      const { hook, replyWhileHidden } = renderInActivity(() => useSendData());

      let promise: Promise<unknown>;
      act(() => {
        promise = hook().sendData({ variable: "temp", value: 42 });
      });
      expect(hook().isSending).toBe(true);

      await replyWhileHidden(promise!, true);

      expect(hook().isSending).toBe(false);
      expect(hook().error).toBeNull();
    });

    it("useSendData stores the rejection and clears isSending", async () => {
      const { hook, replyWhileHidden } = renderInActivity(() => useSendData());

      let promise: Promise<unknown>;
      act(() => {
        promise = hook()
          .sendData({ variable: "temp", value: 42 })
          .catch(() => {});
      });

      await replyWhileHidden(promise!, false);

      expect(hook().isSending).toBe(false);
      expect(hook().error).toMatchObject({ status: false, message: "failed" });
    });

    it("useEditData clears isEditing", async () => {
      const { hook, replyWhileHidden } = renderInActivity(() => useEditData());

      let promise: Promise<unknown>;
      act(() => {
        promise = hook().editData({ variable: "temp", value: 42 });
      });

      await replyWhileHidden(promise!, true);

      expect(hook().isEditing).toBe(false);
    });

    it("useDeleteData clears isDeleting", async () => {
      const { hook, replyWhileHidden } = renderInActivity(() => useDeleteData());

      let promise: Promise<unknown>;
      act(() => {
        promise = hook().deleteData({
          id: "rec-1",
          device: "dev-1",
          variable: "temp",
          value: 42,
          time: "2024-01-01T00:00:00Z",
        });
      });

      await replyWhileHidden(promise!, true);

      expect(hook().isDeleting).toBe(false);
    });

    it("useEditResourceData clears isEditing", async () => {
      const { hook, replyWhileHidden } = renderInActivity(() => useEditResourceData());

      let promise: Promise<unknown>;
      act(() => {
        promise = hook().editResourceData({ device: "dev-1", name: "Renamed" });
      });

      await replyWhileHidden(promise!, true);

      expect(hook().isEditing).toBe(false);
    });
  });
});
