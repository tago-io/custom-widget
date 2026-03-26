import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { useNavigation } from "../../src/hooks/use-navigation.js";
import { TagoIOProvider } from "../../src/provider/tago-io-provider.js";

function wrapper({ children }: { children: ReactNode }) {
  return <TagoIOProvider>{children}</TagoIOProvider>;
}

describe("useNavigation", () => {
  let postMessageSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    postMessageSpy = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
  });

  it("openLink sends open-link message", () => {
    const { result } = renderHook(() => useNavigation(), { wrapper });

    act(() => {
      result.current.openLink("https://admin.tago.io/dashboards/info/abc123");
    });

    expect(postMessageSpy).toHaveBeenCalledWith(
      { method: "open-link", url: "https://admin.tago.io/dashboards/info/abc123" },
      "*"
    );
  });

  it("closeModal sends close-modal message", () => {
    const { result } = renderHook(() => useNavigation(), { wrapper });

    act(() => {
      result.current.closeModal();
    });

    expect(postMessageSpy).toHaveBeenCalledWith({ method: "close-modal" }, "*");
  });
});
