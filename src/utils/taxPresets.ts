import type { CurrencyCode } from "./currency";
import type { TaxConfig } from "./tax";

/** Identificador de preset fiscal por país / régimen */
export type TaxPresetId =
  | "pe"
  | "ec"
  | "co"
  | "cl"
  | "mx"
  | "ar"
  | "bo"
  | "uy"
  | "py"
  | "cr"
  | "pa"
  | "gt"
  | "do"
  | "hn"
  | "ni"
  | "ve"
  | "br"
  | "us"
  | "ca"
  | "es";

export type TaxLabelKey =
  | "tax.labels.igv"
  | "tax.labels.iva"
  | "tax.labels.salesTax"
  | "tax.labels.itbms"
  | "tax.labels.itbis"
  | "tax.labels.isv"
  | "tax.labels.icms"
  | "tax.labels.gst"
  | "tax.labels.vat";

export type TaxPresetGroupId = "latam" | "northamerica" | "europe";

export interface TaxPreset {
  id: TaxPresetId;
  flag: string;
  /** Clave i18n: settings.taxPresets.* */
  nameKey: string;
  taxLabelKey: TaxLabelKey;
  salesTaxRate: number;
  taxInclusive: boolean;
  /** Si true, el toggle de precios con impuesto incluido queda bloqueado */
  taxInclusiveLocked: boolean;
  currency: CurrencyCode;
  /** Clave i18n: settings.taxAuthorities.* */
  authorityKey: string;
  /** Clave i18n opcional con nota fiscal */
  noteKey?: string;
  allowsJurisdiction: boolean;
  defaultJurisdiction?: string;
  group: TaxPresetGroupId;
}

export const TAX_PRESETS: TaxPreset[] = [
  {
    id: "pe",
    flag: "🇵🇪",
    nameKey: "settings.taxPresets.pe",
    taxLabelKey: "tax.labels.igv",
    salesTaxRate: 18,
    taxInclusive: true,
    taxInclusiveLocked: true,
    currency: "PEN",
    authorityKey: "settings.taxAuthorities.sunat",
    noteKey: "settings.taxPresetNotes.pe",
    allowsJurisdiction: false,
    group: "latam",
  },
  {
    id: "ec",
    flag: "🇪🇨",
    nameKey: "settings.taxPresets.ec",
    taxLabelKey: "tax.labels.iva",
    salesTaxRate: 15,
    taxInclusive: true,
    taxInclusiveLocked: true,
    currency: "USD",
    authorityKey: "settings.taxAuthorities.sri",
    allowsJurisdiction: false,
    group: "latam",
  },
  {
    id: "co",
    flag: "🇨🇴",
    nameKey: "settings.taxPresets.co",
    taxLabelKey: "tax.labels.iva",
    salesTaxRate: 19,
    taxInclusive: true,
    taxInclusiveLocked: true,
    currency: "COP",
    authorityKey: "settings.taxAuthorities.dian",
    noteKey: "settings.taxPresetNotes.co",
    allowsJurisdiction: false,
    group: "latam",
  },
  {
    id: "cl",
    flag: "🇨🇱",
    nameKey: "settings.taxPresets.cl",
    taxLabelKey: "tax.labels.iva",
    salesTaxRate: 19,
    taxInclusive: true,
    taxInclusiveLocked: true,
    currency: "CLP",
    authorityKey: "settings.taxAuthorities.sii",
    allowsJurisdiction: false,
    group: "latam",
  },
  {
    id: "mx",
    flag: "🇲🇽",
    nameKey: "settings.taxPresets.mx",
    taxLabelKey: "tax.labels.iva",
    salesTaxRate: 16,
    taxInclusive: true,
    taxInclusiveLocked: true,
    currency: "MXN",
    authorityKey: "settings.taxAuthorities.sat",
    allowsJurisdiction: false,
    group: "latam",
  },
  {
    id: "ar",
    flag: "🇦🇷",
    nameKey: "settings.taxPresets.ar",
    taxLabelKey: "tax.labels.iva",
    salesTaxRate: 21,
    taxInclusive: true,
    taxInclusiveLocked: true,
    currency: "ARS",
    authorityKey: "settings.taxAuthorities.afip",
    allowsJurisdiction: false,
    group: "latam",
  },
  {
    id: "bo",
    flag: "🇧🇴",
    nameKey: "settings.taxPresets.bo",
    taxLabelKey: "tax.labels.iva",
    salesTaxRate: 13,
    taxInclusive: true,
    taxInclusiveLocked: true,
    currency: "BOB",
    authorityKey: "settings.taxAuthorities.sin",
    allowsJurisdiction: false,
    group: "latam",
  },
  {
    id: "uy",
    flag: "🇺🇾",
    nameKey: "settings.taxPresets.uy",
    taxLabelKey: "tax.labels.iva",
    salesTaxRate: 22,
    taxInclusive: true,
    taxInclusiveLocked: true,
    currency: "UYU",
    authorityKey: "settings.taxAuthorities.dgiUy",
    allowsJurisdiction: false,
    group: "latam",
  },
  {
    id: "py",
    flag: "🇵🇾",
    nameKey: "settings.taxPresets.py",
    taxLabelKey: "tax.labels.iva",
    salesTaxRate: 10,
    taxInclusive: true,
    taxInclusiveLocked: true,
    currency: "PYG",
    authorityKey: "settings.taxAuthorities.set",
    allowsJurisdiction: false,
    group: "latam",
  },
  {
    id: "cr",
    flag: "🇨🇷",
    nameKey: "settings.taxPresets.cr",
    taxLabelKey: "tax.labels.iva",
    salesTaxRate: 13,
    taxInclusive: true,
    taxInclusiveLocked: true,
    currency: "CRC",
    authorityKey: "settings.taxAuthorities.haciendaCr",
    allowsJurisdiction: false,
    group: "latam",
  },
  {
    id: "pa",
    flag: "🇵🇦",
    nameKey: "settings.taxPresets.pa",
    taxLabelKey: "tax.labels.itbms",
    salesTaxRate: 7,
    taxInclusive: true,
    taxInclusiveLocked: true,
    currency: "PAB",
    authorityKey: "settings.taxAuthorities.dgiPa",
    allowsJurisdiction: false,
    group: "latam",
  },
  {
    id: "gt",
    flag: "🇬🇹",
    nameKey: "settings.taxPresets.gt",
    taxLabelKey: "tax.labels.iva",
    salesTaxRate: 12,
    taxInclusive: true,
    taxInclusiveLocked: true,
    currency: "GTQ",
    authorityKey: "settings.taxAuthorities.satGt",
    allowsJurisdiction: false,
    group: "latam",
  },
  {
    id: "do",
    flag: "🇩🇴",
    nameKey: "settings.taxPresets.do",
    taxLabelKey: "tax.labels.itbis",
    salesTaxRate: 18,
    taxInclusive: true,
    taxInclusiveLocked: true,
    currency: "DOP",
    authorityKey: "settings.taxAuthorities.dgii",
    allowsJurisdiction: false,
    group: "latam",
  },
  {
    id: "hn",
    flag: "🇭🇳",
    nameKey: "settings.taxPresets.hn",
    taxLabelKey: "tax.labels.isv",
    salesTaxRate: 15,
    taxInclusive: true,
    taxInclusiveLocked: true,
    currency: "HNL",
    authorityKey: "settings.taxAuthorities.sar",
    allowsJurisdiction: false,
    group: "latam",
  },
  {
    id: "ni",
    flag: "🇳🇮",
    nameKey: "settings.taxPresets.ni",
    taxLabelKey: "tax.labels.iva",
    salesTaxRate: 15,
    taxInclusive: true,
    taxInclusiveLocked: true,
    currency: "NIO",
    authorityKey: "settings.taxAuthorities.dgiNi",
    allowsJurisdiction: false,
    group: "latam",
  },
  {
    id: "ve",
    flag: "🇻🇪",
    nameKey: "settings.taxPresets.ve",
    taxLabelKey: "tax.labels.iva",
    salesTaxRate: 16,
    taxInclusive: true,
    taxInclusiveLocked: true,
    currency: "VES",
    authorityKey: "settings.taxAuthorities.seniat",
    allowsJurisdiction: false,
    group: "latam",
  },
  {
    id: "br",
    flag: "🇧🇷",
    nameKey: "settings.taxPresets.br",
    taxLabelKey: "tax.labels.icms",
    salesTaxRate: 17,
    taxInclusive: false,
    taxInclusiveLocked: false,
    currency: "BRL",
    authorityKey: "settings.taxAuthorities.sefaz",
    noteKey: "settings.taxPresetNotes.br",
    allowsJurisdiction: true,
    defaultJurisdiction: "SP",
    group: "latam",
  },
  {
    id: "us",
    flag: "🇺🇸",
    nameKey: "settings.taxPresets.us",
    taxLabelKey: "tax.labels.salesTax",
    salesTaxRate: 8.25,
    taxInclusive: false,
    taxInclusiveLocked: false,
    currency: "USD",
    authorityKey: "settings.taxAuthorities.stateLocal",
    noteKey: "settings.taxPresetNotes.us",
    allowsJurisdiction: true,
    defaultJurisdiction: "TX",
    group: "northamerica",
  },
  {
    id: "ca",
    flag: "🇨🇦",
    nameKey: "settings.taxPresets.ca",
    taxLabelKey: "tax.labels.gst",
    salesTaxRate: 13,
    taxInclusive: false,
    taxInclusiveLocked: false,
    currency: "CAD",
    authorityKey: "settings.taxAuthorities.cra",
    noteKey: "settings.taxPresetNotes.ca",
    allowsJurisdiction: true,
    defaultJurisdiction: "ON",
    group: "northamerica",
  },
  {
    id: "es",
    flag: "🇪🇸",
    nameKey: "settings.taxPresets.es",
    taxLabelKey: "tax.labels.vat",
    salesTaxRate: 21,
    taxInclusive: true,
    taxInclusiveLocked: true,
    currency: "EUR",
    authorityKey: "settings.taxAuthorities.aeat",
    allowsJurisdiction: false,
    group: "europe",
  },
];

export const TAX_PRESET_MAP = new Map<TaxPresetId, TaxPreset>(
  TAX_PRESETS.map((preset) => [preset.id, preset])
);

export const TAX_PRESET_GROUPS: { id: TaxPresetGroupId; labelKey: string; presetIds: TaxPresetId[] }[] = [
  {
    id: "latam",
    labelKey: "settings.taxGroups.latam",
    presetIds: TAX_PRESETS.filter((p) => p.group === "latam").map((p) => p.id),
  },
  {
    id: "northamerica",
    labelKey: "settings.taxGroups.northamerica",
    presetIds: TAX_PRESETS.filter((p) => p.group === "northamerica").map((p) => p.id),
  },
  {
    id: "europe",
    labelKey: "settings.taxGroups.europe",
    presetIds: TAX_PRESETS.filter((p) => p.group === "europe").map((p) => p.id),
  },
];

const PRESET_IDS = new Set<string>(TAX_PRESETS.map((p) => p.id));

export function isTaxPresetId(value: string | null | undefined): value is TaxPresetId {
  return typeof value === "string" && PRESET_IDS.has(value);
}

export function getTaxPreset(id: string | null | undefined): TaxPreset | undefined {
  if (!isTaxPresetId(id)) return undefined;
  return TAX_PRESET_MAP.get(id);
}

export function getTaxConfigFromPreset(id: TaxPresetId): TaxConfig {
  const preset = TAX_PRESET_MAP.get(id)!;
  return {
    region: preset.id,
    salesTaxRate: preset.salesTaxRate,
    taxInclusive: preset.taxInclusive,
    jurisdiction: preset.defaultJurisdiction,
  };
}

export function defaultTaxPresetForLocale(locale: "es" | "en"): TaxPresetId {
  return locale === "en" ? "us" : "pe";
}

export function currencyForTaxPreset(id: TaxPresetId): CurrencyCode {
  return getTaxPreset(id)?.currency ?? "PEN";
}