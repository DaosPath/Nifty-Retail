export type AppLocale = "es" | "en";

export type TranslationTree = {
  [key: string]: string | TranslationTree;
};