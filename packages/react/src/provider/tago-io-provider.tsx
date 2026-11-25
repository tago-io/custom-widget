import { type StoreOptions, WidgetStore } from "@tago-io/custom-widget-core";
import { type ReactNode, useEffect, useLayoutEffect, useRef } from "react";

import { StoreContext, type StoreContextValue } from "./store-context.js";

// React runs a child's effects before its parent's, so a request a child makes in an effect when an <Activity> shows
// the tree again, or on the StrictMode replay, would find the bridge still destroyed. Layout effects all run before
// any effect. On the server neither runs, and React 18 warns about useLayoutEffect there.
const useStoreLifecycleEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

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

  useStoreLifecycleEffect(() => {
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
