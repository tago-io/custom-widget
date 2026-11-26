import { act, cleanup, render } from "@testing-library/react";
import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { useWidget } from "../../src/hooks/use-widget.js";
import { TagoIOProvider } from "../../src/provider/tago-io-provider.js";

describe("TagoIOProvider", () => {
  let postMessageSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    postMessageSpy = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
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

  it("keeps the hooks updating after a Suspense boundary above it shows its fallback", async () => {
    // A boundary that falls back cleans up the layout effects of the content it hides, but not its effects, so the
    // hooks' subscriptions stay as they were and the store must keep them.
    let pending: Promise<void> | null = null;
    let release = () => {};
    function Gate() {
      if (pending) throw pending;
      return null;
    }
    function WidgetID() {
      const { widget } = useWidget();
      return <span>{widget?.id ?? "none"}</span>;
    }
    function sendWidget(id: string) {
      window.dispatchEvent(
        new MessageEvent("message", { data: { widget: { id, dashboard: "d1", display: { variables: [] } } } })
      );
    }
    const tree = () => (
      <Suspense fallback={<span>fallback</span>}>
        <TagoIOProvider>
          <WidgetID />
          <Gate />
        </TagoIOProvider>
      </Suspense>
    );

    const view = render(tree());
    act(() => sendWidget("w1"));
    expect(view.getByText("w1")).toBeDefined();

    pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    view.rerender(tree());
    expect(view.getByText("fallback")).toBeDefined();
    await act(async () => {
      const shown = pending;
      pending = null;
      release();
      await shown;
    });

    act(() => sendWidget("w2"));
    expect(view.getByText("w2")).toBeDefined();
  });
});
