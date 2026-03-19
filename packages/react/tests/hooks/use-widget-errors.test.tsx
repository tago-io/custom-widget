import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { TagoIOProvider } from "../../src/provider/tago-io-provider.js";
import { useWidgetErrors } from "../../src/hooks/use-widget-errors.js";

function wrapper({ children }: { children: ReactNode }) {
  return <TagoIOProvider>{children}</TagoIOProvider>;
}

describe("useWidgetErrors", () => {
  beforeEach(() => {
    window.parent.postMessage = vi.fn();
  });

  it("returns empty errors initially", () => {
    const { result } = renderHook(() => useWidgetErrors(), { wrapper });
    expect(result.current.errors).toEqual([]);
    expect(result.current.lastError).toBeNull();
  });

  it("captures errors from messages", () => {
    const { result } = renderHook(() => useWidgetErrors(), { wrapper });

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { status: false, message: "Something failed", result: [], key: "k1" },
        })
      );
    });

    expect(result.current.errors).toHaveLength(1);
    expect(result.current.lastError?.message).toBe("Something failed");
  });

  it("accumulates multiple errors", () => {
    const { result } = renderHook(() => useWidgetErrors(), { wrapper });

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { status: false, message: "Error 1", result: [], key: "k1" },
        })
      );
    });

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { status: false, message: "Error 2", result: [], key: "k2" },
        })
      );
    });

    expect(result.current.errors).toHaveLength(2);
    expect(result.current.lastError?.message).toBe("Error 2");
  });

  it("clearErrors resets the errors", () => {
    const { result } = renderHook(() => useWidgetErrors(), { wrapper });

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { status: false, message: "Error", result: [], key: "k1" },
        })
      );
    });

    expect(result.current.errors).toHaveLength(1);

    act(() => {
      result.current.clearErrors();
    });

    expect(result.current.errors).toEqual([]);
    expect(result.current.lastError).toBeNull();
  });
});
