import type { AppLocale } from "../i18n";

export type CurrencyCode =
  | "PEN"
  | "USD"
  | "CAD"
  | "EUR"
  | "MXN"
  | "COP"
  | "ARS"
  | "CLP"
  | "BRL"
  | "BOB"
  | "GTQ"
  | "UYU"
  | "PYG"
  | "CRC"
  | "PAB"
  | "DOP"
  | "HNL"
  | "NIO"
  | "VES";

export interface CurrencyMeta {
  code: CurrencyCode;
  symbol: string;
  localeTag: string;
  decimals: number;
}

export const CURRENCY_CATALOG: CurrencyMeta[] = [
  { code: "PEN", symbol: "S/", localeTag: "es-PE", decimals: 2 },
  { code: "USD", symbol: "$", localeTag: "en-US", decimals: 2 },
  { code: "CAD", symbol: "$", localeTag: "en-CA", decimals: 2 },
  { code: "EUR", symbol: "€", localeTag: "es-ES", decimals: 2 },
  { code: "MXN", symbol: "$", localeTag: "es-MX", decimals: 2 },
  { code: "COP", symbol: "$", localeTag: "es-CO", decimals: 2 },
  { code: "ARS", symbol: "$", localeTag: "es-AR", decimals: 2 },
  { code: "CLP", symbol: "$", localeTag: "es-CL", decimals: 0 },
  { code: "BRL", symbol: "R$", localeTag: "pt-BR", decimals: 2 },
  { code: "BOB", symbol: "Bs", localeTag: "es-BO", decimals: 2 },
  { code: "GTQ", symbol: "Q", localeTag: "es-GT", decimals: 2 },
  { code: "UYU", symbol: "$", localeTag: "es-UY", decimals: 2 },
  { code: "PYG", symbol: "₲", localeTag: "es-PY", decimals: 0 },
  { code: "CRC", symbol: "₡", localeTag: "es-CR", decimals: 2 },
  { code: "PAB", symbol: "B/.", localeTag: "es-PA", decimals: 2 },
  { code: "DOP", symbol: "$", localeTag: "es-DO", decimals: 2 },
  { code: "HNL", symbol: "L", localeTag: "es-HN", decimals: 2 },
  { code: "NIO", symbol: "C$", localeTag: "es-NI", decimals: 2 },
  { code: "VES", symbol: "Bs.", localeTag: "es-VE", decimals: 2 },
];

const CURRENCY_SET = new Set<string>(CURRENCY_CATALOG.map((c) => c.code));

export function defaultCurrencyForLocale(locale: AppLocale): CurrencyCode {
  return locale === "en" ? "USD" : "PEN";
}

export function normalizeCurrency(
  currency: string | null | undefined,
  locale: AppLocale = "es"
): CurrencyCode {
  const code = typeof currency === "string" ? currency.toUpperCase() : "";
  if (CURRENCY_SET.has(code)) return code as CurrencyCode;
  return defaultCurrencyForLocale(locale);
}

export function getCurrencyMeta(code: CurrencyCode): CurrencyMeta {
  return CURRENCY_CATALOG.find((c) => c.code === code) ?? CURRENCY_CATALOG[0];
}

export function getCurrencySymbol(code: CurrencyCode): string {
  return getCurrencyMeta(code).symbol;
}

export function formatCurrency(
  amount: number,
  code: CurrencyCode,
  localeTag?: string
): string {
  const meta = getCurrencyMeta(code);
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  try {
    return new Intl.NumberFormat(localeTag || meta.localeTag, {
      style: "currency",
      currency: code,
      minimumFractionDigits: meta.decimals,
      maximumFractionDigits: meta.decimals,
    }).format(safeAmount);
  } catch {
    const formatted = safeAmount.toLocaleString(localeTag || meta.localeTag, {
      minimumFractionDigits: meta.decimals,
      maximumFractionDigits: meta.decimals,
    });
    if (code === "PEN") return `S/ ${formatted}`;
    if (meta.symbol.length > 1 && !meta.symbol.endsWith(".")) {
      return `${meta.symbol} ${formatted}`;
    }
    return `${meta.symbol}${formatted}`;
  }
}