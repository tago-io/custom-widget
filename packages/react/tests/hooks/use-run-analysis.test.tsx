import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { useRunAnalysis } from "../../src/hooks/use-run-analysis.js";
import { TagoIOProvider } from "../../src/provider/tago-io-provider.js";

function wrapper({ children }: { children: ReactNode }) {
  return <TagoIOProvider>{children}</TagoIOProvider>;
}

describe("useRunAnalysis", () => {
  let postMessageSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    postMessageSpy = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
  });

  it("sends run-analysis message without scope", () => {
    const { result } = renderHook(() => useRunAnalysis(), { wrapper });

    act(() => {
      result.current.runAnalysis();
    });

    expect(postMessageSpy).toHaveBeenCalledWith({ method: "run-analysis", scope: undefined }, "*");
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

    const { result } = renderHook(() => useRunAnalysis(), { wrapper });

    act(() => {
      result.current.runAnalysis(scope);
    });

    expect(postMessageSpy).toHaveBeenCalledWith({ method: "run-analysis", scope }, "*");
  });
});
