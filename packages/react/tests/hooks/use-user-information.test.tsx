import type { TUserInformation } from "@tago-io/custom-widget-core";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { useUserInformation } from "../../src/hooks/use-user-information.js";
import { TagoIOProvider } from "../../src/provider/tago-io-provider.js";

const mockUserInfo: TUserInformation = {
  token: "tok-123",
  language: "en",
  runURL: "https://run.tago.io",
};

function wrapper({ children }: { children: ReactNode }) {
  return <TagoIOProvider>{children}</TagoIOProvider>;
}

describe("useUserInformation", () => {
  beforeEach(() => {
    window.parent.postMessage = vi.fn();
  });

  it("returns null initially", () => {
    const { result } = renderHook(() => useUserInformation(), { wrapper });
    expect(result.current.userInformation).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.language).toBeNull();
    expect(result.current.runURL).toBeNull();
  });

  it("updates when user information arrives", () => {
    const { result } = renderHook(() => useUserInformation(), { wrapper });

    act(() => {
      window.dispatchEvent(new MessageEvent("message", { data: { userInformation: mockUserInfo } }));
    });

    expect(result.current.userInformation).toEqual(mockUserInfo);
    expect(result.current.token).toBe("tok-123");
    expect(result.current.language).toBe("en");
    expect(result.current.runURL).toBe("https://run.tago.io");
  });
});
