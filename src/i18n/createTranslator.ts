import type { TranslationTree } from "./types";

export type TranslateVars = Record<string, string | number>;

export function createTranslator(dictionary: TranslationTree) {
  return function t(key: string, vars?: TranslateVars): string {
    const parts = key.split(".");
    let current: string | TranslationTree | undefined = dictionary;

    for (const part of parts) {
      if (!current || typeof current === "string") {
        return key;
      }
      current = current[part];
    }

    if (typeof current !== "string") {
      return key;
    }

    if (!vars) {
      return current;
    }

    return current.replace(/\{\{(\w+)\}\}/g, (_, token: string) =>
      vars[token] !== undefined ? String(vars[token]) : `{{${token}}}`
    );
  };
}