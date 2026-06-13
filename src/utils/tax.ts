import type { AppLocale } from "../i18n";
import { formatCurrency, type CurrencyCode } from "./currency";
import {
  currencyForTaxPreset,
  defaultTaxPresetForLocale,
  getTaxConfigFromPreset,
  getTaxPreset,
  isTaxPresetId,
  type TaxPresetId,
} from "./taxPresets";

/** @deprecated Usa TaxPresetId — se mantiene por compatibilidad */
export type TaxRegion = TaxPresetId;

export interface TaxConfig {
  region: TaxPresetId;
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

export const DEFAULT_TAX_PE: TaxConfig = getTaxConfigFromPreset("pe");
export const DEFAULT_TAX_US: TaxConfig = getTaxConfigFromPreset("us");

export function defaultTaxForLocale(locale: AppLocale): TaxConfig {
  return getTaxConfigFromPreset(defaultTaxPresetForLocale(locale));
}

export function normalizeTaxConfig(
  tax: Partial<TaxConfig> | null | undefined,
  locale: AppLocale = "es"
): TaxConfig {
  const fallbackId = defaultTaxPresetForLocale(locale);
  const fallback = getTaxConfigFromPreset(fallbackId);

  if (!tax || typeof tax !== "object") return fallback;

  const region: TaxPresetId = isTaxPresetId(tax.region) ? tax.region : fallbackId;
  const preset = getTaxPreset(region);
  const presetConfig = getTaxConfigFromPreset(region);
  const rate = Number(tax.salesTaxRate);

  return {
    region,
    salesTaxRate: Number.isFinite(rate) && rate >= 0 ? rate : presetConfig.salesTaxRate,
    taxInclusive: preset?.taxInclusiveLocked ? true : Boolean(tax.taxInclusive ?? presetConfig.taxInclusive),
    jurisdiction:
      typeof tax.jurisdiction === "string"
        ? tax.jurisdiction
        : preset?.defaultJurisdiction ?? presetConfig.jurisdiction,
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

export function formatMoney(amount: number, region: TaxPresetId): string {
  const currency: CurrencyCode = currencyForTaxPreset(region);
  return formatCurrency(amount, currency);
}

export function taxLabel(
  taxConfig: TaxConfig,
  t: (key: string, vars?: Record<string, string | number>) => string
): string {
  const preset = getTaxPreset(taxConfig.region);
  const labelKey = preset?.taxLabelKey ?? "tax.labels.iva";
  const base = t(labelKey, { rate: taxConfig.salesTaxRate });
  if (taxConfig.jurisdiction?.trim() && preset?.allowsJurisdiction) {
    return `${base} (${taxConfig.jurisdiction.trim()})`;
  }
  return base;
}

export function isTaxInclusiveLocked(taxConfig: TaxConfig): boolean {
  return Boolean(getTaxPreset(taxConfig.region)?.taxInclusiveLocked);
}

export function allowsTaxJurisdiction(taxConfig: TaxConfig): boolean {
  return Boolean(getTaxPreset(taxConfig.region)?.allowsJurisdiction);
}

export function shouldShowReceiptTaxBreakdown(
  taxConfig: TaxConfig,
  documentType: "ticket" | "boleta"
): boolean {
  if (documentType === "boleta") return true;
  return !taxConfig.taxInclusive;
}