import { type StoreOptions, WidgetStore } from "@tago-io/custom-widget-core";
import { type ReactNode, useEffect, useLayoutEffect, useRef } from "react";

import { StoreContext, type StoreContextValue } from "./store-context.js";

// On the server neither effect runs, and React 18 warns about useLayoutEffect there.
const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

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

  // React runs a child's effects before its parent's, so when an <Activity> shows the tree again, or on the StrictMode
  // replay, a request a child makes in an effect would find the bridge still destroyed. Layout effects all run before
  // any effect, so the store starts there. It stops in an effect instead: a Suspense boundary that shows its fallback
  // cleans up only layout effects, and stopping then would drop the hooks' subscriptions for good. initialize() does
  // nothing on a store that is still running.
  useClientLayoutEffect(() => {
    storeRef.current?.initialize();
  }, []);

  useEffect(() => {
    const store = storeRef.current;
    return () => store?.destroy();
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
