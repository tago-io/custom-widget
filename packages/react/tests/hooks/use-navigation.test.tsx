import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { TagoIOProvider } from "../../src/provider/tago-io-provider.js";
import { useNavigation } from "../../src/hooks/use-navigation.js";

function wrapper({ children }: { children: ReactNode }) {
  return <TagoIOProvider>{children}</TagoIOProvider>;
}

describe("useNavigation", () => {
  let mockPostMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockPostMessage = vi.fn();
    window.parent.postMessage = mockPostMessage;
  });

  it("openLink sends open-link message", () => {
    const { result } = renderHook(() => useNavigation(), { wrapper });

    act(() => {
      result.current.openLink("https://admin.tago.io/dashboards/info/abc123");
    });

    expect(mockPostMessage).toHaveBeenCalledWith(
      { method: "open-link", url: "https://admin.tago.io/dashboards/info/abc123" },
      "*"
    );
  });

  it("closeModal sends close-modal message", () => {
    const { result } = renderHook(() => useNavigation(), { wrapper });

    act(() => {
      result.current.closeModal();
    });

    expect(mockPostMessage).toHaveBeenCalledWith({ method: "close-modal" }, "*");
  });
});
