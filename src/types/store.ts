import type { AppLocale } from "../i18n";
import type { SunatConfig } from "./sunat";
import type { TaxConfig } from "../utils/tax";
import type { CurrencyCode } from "../utils/currency";

export interface StoreConfig {
  businessName: string;
  ruc: string;
  address: string;
  ticketSeries: string;
  boletaSeries: string;
  lastTicketNumber: number;
  lastBoletaNumber: number;
  theme?: "dark" | "light";
  language?: AppLocale;
  currency?: CurrencyCode;
  printer?: {
    paperWidth: "58mm" | "76mm" | "80mm";
    autoPrintAfterSale: boolean;
    footerMessage: string;
  };
  sunat?: SunatConfig;
  salesWarehouseId?: string;
  tax?: TaxConfig;
}