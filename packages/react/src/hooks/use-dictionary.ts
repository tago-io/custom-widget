import type { WidgetState } from "@tago-io/custom-widget-core";
import { useCallback, useEffect, useRef, useState } from "react";
import { useStore, useStoreSelector } from "./use-store-selector.js";

export interface UseDictionaryOptions {
  /** Override the language detected from user information */
  language?: string;
}

export interface UseDictionaryReturn {
  t: (text: string) => Promise<string>;
  tSync: (text: string) => string;
  dictionary: unknown | null;
  isLoading: boolean;
  language: string | null;
  error: Error | null;
}

const languageSelector = (state: WidgetState) => state.userInformation?.language ?? null;

export function useDictionary(options?: UseDictionaryOptions): UseDictionaryReturn {
  const { dictionaryClass } = useStore();
  const detectedLanguage = useStoreSelector(languageSelector);
  const language = options?.language ?? detectedLanguage;

  const [dictionary, setDictionary] = useState<unknown | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!dictionaryClass || !language) {
      setDictionary(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const DictClass = dictionaryClass as new (opts: { language: string }) => unknown;
      const instance = new DictClass({ language });
      if (mountedRef.current) {
        setDictionary(instance);
        setIsLoading(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
      }
    }
  }, [dictionaryClass, language]);

  const t = useCallback(
    async (text: string): Promise<string> => {
      if (!dictionary) return text;
      try {
        const dict = dictionary as { translate: (text: string) => Promise<string> };
        return await dict.translate(text);
      } catch {
        return text;
      }
    },
    [dictionary]
  );

  const tSync = useCallback((text: string): string => {
    return text;
  }, []);

  return {
    t,
    tSync,
    dictionary,
    isLoading,
    language,
    error,
  };
}
