import type { TWidget, TWidgetVariable } from "@tago-io/custom-widget-core";

import { useStoreSelector } from "./use-store-selector.js";

export interface UseWidgetReturn {
  widget: TWidget | null;
  isLoading: boolean;
  variables: TWidgetVariable[];
  dashboardId: string | null;
  widgetId: string | null;
  label: string | null;
}

const selector = (state: { widget: TWidget | null; isReady: boolean }): UseWidgetReturn => ({
  widget: state.widget,
  isLoading: !state.isReady,
  variables: state.widget?.display?.variables ?? [],
  dashboardId: state.widget?.dashboard ?? null,
  widgetId: state.widget?.id ?? null,
  label: state.widget?.label ?? null,
});

function widgetEqual(a: UseWidgetReturn, b: UseWidgetReturn): boolean {
  return a.widget === b.widget && a.isLoading === b.isLoading;
}

export function useWidget(): UseWidgetReturn {
  return useStoreSelector(selector, widgetEqual);
}
