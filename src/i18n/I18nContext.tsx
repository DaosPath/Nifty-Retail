import React, { createContext, useEffect, useMemo } from "react";
import { createTranslator } from "./createTranslator";
import { en } from "./translations/en";
import { es } from "./translations/es";
import type { AppLocale } from "./types";

const dictionaries = { es, en };

export interface I18nContextValue {
  locale: AppLocale;
  localeTag: string;
  t: ReturnType<typeof createTranslator>;
}

export const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  children,
}: {
  locale: AppLocale;
  children: React.ReactNode;
}) {
  const value = useMemo<I18nContextValue>(() => {
    const localeTag = locale === "en" ? "en-US" : "es-PE";
    return {
      locale,
      localeTag,
      t: createTranslator(dictionaries[locale]),
    };
  }, [locale]);

  useEffect(() => {
    document.documentElement.lang = value.localeTag;
  }, [value.localeTag]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}