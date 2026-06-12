import type { AppLocale } from "../i18n";
import { formatCurrency } from "./currency";

export type TaxRegion = "pe" | "us";

export interface TaxConfig {
  region: TaxRegion;
  salesTaxRate: number;
  taxInclusive: boolean;
  jurisdiction?: string;
}

export interface SaleTaxBreakdown {
  subtotal: number;
  discount: number;
  total: number;
  taxableBase: number;
  taxAmount: number;
}

export const DEFAULT_TAX_PE: TaxConfig = {
  region: "pe",
  salesTaxRate: 18,
  taxInclusive: true,
};

export const DEFAULT_TAX_US: TaxConfig = {
  region: "us",
  salesTaxRate: 8.25,
  taxInclusive: false,
  jurisdiction: "",
};

export function defaultTaxForLocale(locale: AppLocale): TaxConfig {
  return locale === "en" ? { ...DEFAULT_TAX_US } : { ...DEFAULT_TAX_PE };
}

export function normalizeTaxConfig(
  tax: Partial<TaxConfig> | null | undefined,
  locale: AppLocale = "es"
): TaxConfig {
  const base = defaultTaxForLocale(locale);
  if (!tax || typeof tax !== "object") return base;

  const region: TaxRegion = tax.region === "us" ? "us" : "pe";
  const preset = region === "us" ? DEFAULT_TAX_US : DEFAULT_TAX_PE;
  const rate = Number(tax.salesTaxRate);

  return {
    region,
    salesTaxRate: Number.isFinite(rate) && rate >= 0 ? rate : preset.salesTaxRate,
    taxInclusive: region === "pe" ? true : Boolean(tax.taxInclusive),
    jurisdiction: typeof tax.jurisdiction === "string" ? tax.jurisdiction : preset.jurisdiction,
  };
}

export function resolveTaxConfig(config?: {
  tax?: Partial<TaxConfig> | null;
  language?: AppLocale | string;
}): TaxConfig {
  const locale: AppLocale = config?.language === "en" ? "en" : "es";
  if (config?.tax) return normalizeTaxConfig(config.tax, locale);
  return defaultTaxForLocale(locale);
}

export function calculateSaleTax(
  subtotal: number,
  discount: number,
  taxConfig: TaxConfig
): SaleTaxBreakdown {
  const net = parseFloat(Math.max(0, subtotal - discount).toFixed(2));
  const rate = taxConfig.salesTaxRate / 100;

  if (taxConfig.taxInclusive) {
    const taxableBase = parseFloat((net / (1 + rate)).toFixed(2));
    const taxAmount = parseFloat((net - taxableBase).toFixed(2));
    return { subtotal, discount, total: net, taxableBase, taxAmount };
  }

  const taxAmount = parseFloat((net * rate).toFixed(2));
  const total = parseFloat((net + taxAmount).toFixed(2));
  return { subtotal, discount, total, taxableBase: net, taxAmount };
}

export function formatMoney(amount: number, region: TaxRegion): string {
  return formatCurrency(amount, region === "us" ? "USD" : "PEN");
}

export function taxLabel(taxConfig: TaxConfig, t: (key: string, vars?: Record<string, string | number>) => string): string {
  if (taxConfig.region === "pe") {
    return t("tax.igv", { rate: taxConfig.salesTaxRate });
  }
  const base = t("tax.salesTax", { rate: taxConfig.salesTaxRate });
  if (taxConfig.jurisdiction?.trim()) {
    return `${base} (${taxConfig.jurisdiction.trim()})`;
  }
  return base;
}