import type { WidgetState } from "@tago-io/custom-widget-core";
import { useCallback, useContext, useRef, useSyncExternalStore } from "react";
import { StoreContext } from "../provider/store-context.js";

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error("useStore must be used within a <TagoIOProvider>");
  }
  return ctx;
}

export function useStoreSelector<T>(
  selector: (state: WidgetState) => T,
  equalityFn: (a: T, b: T) => boolean = Object.is
): T {
  const { store } = useStore();

  const selectorRef = useRef(selector);
  const equalityRef = useRef(equalityFn);
  const prevRef = useRef<T>(undefined);
  const initializedRef = useRef(false);

  selectorRef.current = selector;
  equalityRef.current = equalityFn;

  const getSnapshot = useCallback(() => {
    const next = selectorRef.current(store.getSnapshot());
    if (initializedRef.current && equalityRef.current(prevRef.current as T, next)) {
      return prevRef.current as T;
    }
    initializedRef.current = true;
    prevRef.current = next;
    return next;
  }, [store]);

  const getServerSnapshot = useCallback(() => {
    return selectorRef.current(store.getServerSnapshot());
  }, [store]);

  return useSyncExternalStore(store.subscribe, getSnapshot, getServerSnapshot);
}
