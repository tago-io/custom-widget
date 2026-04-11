import { useCallback } from "react";

import { useStore } from "./use-store-selector.js";

export interface UseNavigationReturn {
  openLink: (url: string) => void;
  closeModal: () => void;
}

export function useNavigation(): UseNavigationReturn {
  const { store } = useStore();

  const openLink = useCallback(
    (url: string) => {
      store.openLink(url);
    },
    [store]
  );

  const closeModal = useCallback(() => {
    store.closeModal();
  }, [store]);

  return { openLink, closeModal };
}
