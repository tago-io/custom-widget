import { type StoreOptions, WidgetStore } from "@tago-io/custom-widget-core";
import { type ReactNode, useEffect, useRef } from "react";

import { StoreContext, type StoreContextValue } from "./store-context.js";

export interface TagoIOProviderProps extends StoreOptions {
  children: ReactNode;
  /** Optional Dictionary class from @tago-io/sdk for i18n support */
  dictionary?: unknown;
}

export function TagoIOProvider({ children, dictionary, ...options }: TagoIOProviderProps) {
  const storeRef = useRef<WidgetStore>(undefined);
  if (!storeRef.current) {
    storeRef.current = new WidgetStore(options);
  }

  useEffect(() => {
    const store = storeRef.current;
    if (!store) return;
    store.initialize();
    return () => store.destroy();
  }, []);

  const ctxRef = useRef<StoreContextValue>(undefined);
  if (!ctxRef.current) {
    ctxRef.current = {
      store: storeRef.current,
      dictionaryClass: dictionary ?? null,
    };
  }

  return <StoreContext.Provider value={ctxRef.current}>{children}</StoreContext.Provider>;
}
