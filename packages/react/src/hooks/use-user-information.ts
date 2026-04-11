import type { TUserInformation, TUserPreferences, WidgetState } from "@tago-io/custom-widget-core";

import { useStoreSelector } from "./use-store-selector.js";

export interface UseUserInformationReturn {
  userInformation: TUserInformation | null;
  token: string | null;
  language: string | null;
  runURL: string | null;
  customPreferences: Record<string, string>;
  preferences: TUserPreferences | null;
}

const EMPTY_CUSTOM_PREFERENCES: Record<string, string> = {};

const selector = (state: WidgetState): UseUserInformationReturn => ({
  userInformation: state.userInformation,
  token: state.userInformation?.token ?? null,
  language: state.userInformation?.language ?? null,
  runURL: state.userInformation?.runURL ?? null,
  customPreferences: state.userInformation?.custom_preferences ?? EMPTY_CUSTOM_PREFERENCES,
  preferences: state.userInformation?.preferences ?? null,
});

function userInfoEqual(a: UseUserInformationReturn, b: UseUserInformationReturn): boolean {
  return a.userInformation === b.userInformation;
}

export function useUserInformation(): UseUserInformationReturn {
  return useStoreSelector(selector, userInfoEqual);
}
