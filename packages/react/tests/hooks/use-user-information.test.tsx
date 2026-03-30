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

const mockUserInfoFull: TUserInformation = {
  token: "tok-456",
  language: "en-US",
  runURL: "https://run.tago.io",
  custom_preferences: {
    "widget-a": "°C",
    "widget-b": "2",
  },
  preferences: {
    timezone: "UTC",
    language: "en-US",
    date_format: "MM/DD/YYYY",
    time_format: "12",
    decimal_separator: ".",
  },
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

  it("returns empty customPreferences and null preferences when not provided", () => {
    const { result } = renderHook(() => useUserInformation(), { wrapper });

    act(() => {
      window.dispatchEvent(new MessageEvent("message", { data: { userInformation: mockUserInfo } }));
    });

    expect(result.current.customPreferences).toEqual({});
    expect(result.current.preferences).toBeNull();
  });

  it("exposes customPreferences and preferences when provided", () => {
    const { result } = renderHook(() => useUserInformation(), { wrapper });

    act(() => {
      window.dispatchEvent(new MessageEvent("message", { data: { userInformation: mockUserInfoFull } }));
    });

    expect(result.current.customPreferences).toEqual({
      "widget-a": "°C",
      "widget-b": "2",
    });
    expect(result.current.preferences).toEqual({
      timezone: "UTC",
      language: "en-US",
      date_format: "MM/DD/YYYY",
      time_format: "12",
      decimal_separator: ".",
    });
  });
});
