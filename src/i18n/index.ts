import { createTranslator } from "./createTranslator";
import { en } from "./translations/en";
import { es } from "./translations/es";
import type { AppLocale } from "./types";

export type { AppLocale } from "./types";
export { I18nProvider } from "./I18nContext";
export { useI18n } from "./useI18n";

export const LOCALE_STORAGE_KEY = "niftypos-locale";
export const DEFAULT_LOCALE = "es" as const;

const dictionaries = { es, en } as const;

export function normalizeLocale(value: unknown): AppLocale {
  return value === "en" ? "en" : "es";
}

export function getTranslator(locale: AppLocale) {
  return createTranslator(dictionaries[locale]);
}