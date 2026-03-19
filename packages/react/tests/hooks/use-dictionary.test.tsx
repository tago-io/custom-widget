import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { TagoIOProvider } from "../../src/provider/tago-io-provider.js";
import { useDictionary } from "../../src/hooks/use-dictionary.js";

function wrapper({ children }: { children: ReactNode }) {
  return <TagoIOProvider>{children}</TagoIOProvider>;
}

class MockDictionary {
  language: string;
  constructor(opts: { language: string }) {
    this.language = opts.language;
  }
  async translate(text: string) {
    return `[${this.language}] ${text}`;
  }
}

function wrapperWithDict({ children }: { children: ReactNode }) {
  return <TagoIOProvider dictionary={MockDictionary}>{children}</TagoIOProvider>;
}

describe("useDictionary", () => {
  beforeEach(() => {
    window.parent.postMessage = vi.fn();
  });

  it("returns pass-through when no dictionary class is provided", () => {
    const { result } = renderHook(() => useDictionary(), { wrapper });

    expect(result.current.dictionary).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.tSync("hello")).toBe("hello");
  });

  it("initializes dictionary when class and language are provided", () => {
    const { result } = renderHook(() => useDictionary({ language: "pt" }), {
      wrapper: wrapperWithDict,
    });

    expect(result.current.dictionary).toBeDefined();
    expect(result.current.language).toBe("pt");
  });

  it("translates text using the dictionary", async () => {
    const { result } = renderHook(() => useDictionary({ language: "pt" }), {
      wrapper: wrapperWithDict,
    });

    const translated = await result.current.t("hello");
    expect(translated).toBe("[pt] hello");
  });

  it("uses language from user information when not explicitly provided", () => {
    const { result } = renderHook(() => useDictionary(), {
      wrapper: wrapperWithDict,
    });

    expect(result.current.dictionary).toBeNull();

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { userInformation: { token: "tok", language: "fr", runURL: null } },
        })
      );
    });

    expect(result.current.dictionary).toBeDefined();
    expect(result.current.language).toBe("fr");
  });

  it("tSync returns input unchanged (pass-through)", () => {
    const { result } = renderHook(() => useDictionary({ language: "en" }), {
      wrapper: wrapperWithDict,
    });

    expect(result.current.tSync("hello")).toBe("hello");
  });
});
