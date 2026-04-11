import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { TagoIOProvider } from "../../src/provider/tago-io-provider.js";

describe("TagoIOProvider", () => {
  let postMessageSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    postMessageSpy = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends loaded message on mount", () => {
    render(
      <TagoIOProvider>
        <div>child</div>
      </TagoIOProvider>
    );

    expect(postMessageSpy).toHaveBeenCalledWith(expect.objectContaining({ loaded: true }), "*");
  });

  it("sends loaded message only once even with Strict Mode double-mount", () => {
    const { unmount: _unmount } = render(
      <TagoIOProvider>
        <div>child</div>
      </TagoIOProvider>
    );

    const callCount = postMessageSpy.mock.calls.filter(
      (c: unknown[]) => (c[0] as Record<string, unknown>).loaded
    ).length;
    expect(callCount).toBe(1);
  });

  it("passes readyOptions in the loaded message", () => {
    render(
      <TagoIOProvider readyOptions={{ header: { color: "red" } }}>
        <div>child</div>
      </TagoIOProvider>
    );

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ loaded: true, header: { color: "red" } }),
      "*"
    );
  });

  it("renders children", () => {
    const { getByText } = render(
      <TagoIOProvider>
        <div>hello world</div>
      </TagoIOProvider>
    );

    expect(getByText("hello world")).toBeDefined();
  });
});
