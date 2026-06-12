import type { AppLocale } from "../i18n";
import type { StoreConfig } from "../types/store";
import { defaultCurrencyForLocale } from "./currency";
import { defaultTaxForLocale, normalizeTaxConfig } from "./tax";

/** Nombre genérico cuando la tienda no tiene razón social configurada. */
export const FALLBACK_BUSINESS_NAME = "Nifty Retail";

export function defaultStoreIdentity(
  locale: AppLocale
): Pick<StoreConfig, "businessName" | "ruc" | "address"> {
  if (locale === "en") {
    return {
      businessName: "My Store",
      ruc: "",
      address: "123 Example St, City, USA",
    };
  }
  return {
    businessName: "Mi Tienda",
    ruc: "",
    address: "Av. Ejemplo 123, Distrito, Lima",
  };
}

export function createDefaultStoreConfig(
  locale: AppLocale = "es",
  theme: "dark" | "light" = "dark"
): StoreConfig {
  const identity = defaultStoreIdentity(locale);
  return {
    ...identity,
    ticketSeries: "T001",
    boletaSeries: "B001",
    lastTicketNumber: 0,
    lastBoletaNumber: 0,
    theme,
    language: locale,
    currency: defaultCurrencyForLocale(locale),
    printer: {
      paperWidth: "76mm",
      autoPrintAfterSale: false,
      footerMessage:
        locale === "en" ? "Thank you for your purchase!" : "¡Gracias por su compra!",
    },
    sunat: {
      enabled: false,
      environment: "beta",
      solUsuario: "",
      solClave: "",
      certPath: "",
      certPassword: "",
    },
    tax: defaultTaxForLocale(locale),
  };
}

/** Combina configuración guardada con valores por defecto seguros (sin datos personales). */
export function mergeStoreConfig(partial?: Partial<StoreConfig>): StoreConfig {
  const locale: AppLocale = partial?.language === "en" ? "en" : "es";
  const theme: "dark" | "light" = partial?.theme === "light" ? "light" : "dark";
  const base = createDefaultStoreConfig(locale, theme);
  if (!partial) return base;

  const identity = defaultStoreIdentity(locale);
  return {
    ...base,
    ...partial,
    businessName: partial.businessName?.trim() || identity.businessName,
    ruc: partial.ruc?.trim() ?? identity.ruc,
    address: partial.address?.trim() || identity.address,
    printer: { ...base.printer!, ...partial.printer },
    sunat: { ...base.sunat!, ...partial.sunat },
    tax: partial.tax
      ? normalizeTaxConfig(partial.tax, locale)
      : base.tax,
    currency: partial.currency || base.currency,
    language: locale,
    theme,
  };
}