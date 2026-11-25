import type { TRealtimeData } from "@tago-io/custom-widget-core";
import { act, render } from "@testing-library/react";
import { memo } from "react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { useWidgetData } from "../../src/hooks/use-widget-data.js";
import { TagoIOProvider } from "../../src/provider/tago-io-provider.js";

/**
 * These tests are about record object identity, which is what decides whether a memoized row
 * repaints. They cover the pair of failures a partial record comparison produces: too loose and
 * an edit never reaches the DOM, too strict and every tick repaints everything.
 *
 * They read core through its built entry, so run them after building core, or through the root
 * `pnpm test`, which turbo orders behind the build.
 */

const payload = (label: string): TRealtimeData[] => [
  {
    data: { variable: ["dock_state"], origin: "dev1" },
    result: [
      {
        id: "r1",
        variable: "dock_state",
        value: "dock-42",
        time: "2024-01-01T00:00:00Z",
        metadata: { label, color: label === "free" ? "green" : "red" },
      },
    ],
  } as unknown as TRealtimeData,
];

/** jsdom delivers `data` as-is, so clone here to mimic the structured clone postMessage does. */
function tick(label: string) {
  window.dispatchEvent(new MessageEvent("message", { data: structuredClone({ realtime: payload(label) }) }));
}

let rowRenders = 0;

const Row = memo(function Row({ label }: { label: string }) {
  rowRenders += 1;
  return <span data-testid="label">{label}</span>;
});

function Widget() {
  const { records } = useWidgetData();
  const label = String(records[0]?.metadata?.label ?? "none");
  return <Row label={label} />;
}

describe("realtime record identity", () => {
  beforeEach(() => {
    window.parent.postMessage = vi.fn();
    rowRenders = 0;
  });

  it("repaints a memoized row when only metadata changed", () => {
    const view = render(
      <TagoIOProvider>
        <Widget />
      </TagoIOProvider>
    );

    try {
      act(() => tick("free"));
      expect(view.getByTestId("label").textContent).toBe("free");

      act(() => tick("occupied"));

      // Before the record comparison covered metadata, the store handed back the same record
      // object, so the row kept painting "free" while the parent re-rendered on every tick.
      expect(view.getByTestId("label").textContent).toBe("occupied");
    } finally {
      view.unmount();
    }
  });

  it("renders the row once across ten identical ticks", () => {
    const view = render(
      <TagoIOProvider>
        <Widget />
      </TagoIOProvider>
    );

    try {
      act(() => tick("free"));
      const afterFirst = rowRenders;

      for (let index = 0; index < 10; index += 1) {
        act(() => tick("free"));
      }

      // Structural sharing is the guarantee under test: the enclosing component re-renders on
      // every tick, and the memoized row must not, or a value-blind comparison would be trading
      // one bug for a repaint storm.
      expect(rowRenders).toBe(afterFirst);
    } finally {
      view.unmount();
    }
  });
});
