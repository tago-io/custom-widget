import { render, act } from "@testing-library/react";
import { TagoIOProvider } from "../../src/provider/tago-io-provider.js";

describe("TagoIOProvider", () => {
  let mockPostMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockPostMessage = vi.fn();
    window.parent.postMessage = mockPostMessage;
  });

  it("sends loaded message on mount", () => {
    render(
      <TagoIOProvider>
        <div>child</div>
      </TagoIOProvider>
    );

    expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({ loaded: true }), "*");
  });

  it("sends loaded message only once even with Strict Mode double-mount", () => {
    const { unmount } = render(
      <TagoIOProvider>
        <div>child</div>
      </TagoIOProvider>
    );

    const callCount = mockPostMessage.mock.calls.filter((c: unknown[]) =>
      (c[0] as Record<string, unknown>).loaded
    ).length;
    expect(callCount).toBe(1);
  });

  it("passes readyOptions in the loaded message", () => {
    render(
      <TagoIOProvider readyOptions={{ header: { color: "red" } }}>
        <div>child</div>
      </TagoIOProvider>
    );

    expect(mockPostMessage).toHaveBeenCalledWith(
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
