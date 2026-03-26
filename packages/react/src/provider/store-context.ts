import type { WidgetStore } from "@tago-io/custom-widget-core";
import { createContext } from "react";

export interface StoreContextValue {
  store: WidgetStore;
  dictionaryClass: unknown;
}

export const StoreContext = createContext<StoreContextValue | null>(null);
