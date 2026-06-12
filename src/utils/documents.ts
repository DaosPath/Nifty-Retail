import type { Sale } from "../components/ReceiptPrinter";

export interface DocumentSeriesConfig {
  ticketSeries: string;
  boletaSeries: string;
  lastTicketNumber: number;
  lastBoletaNumber: number;
}

export function formatDocumentNumber(series: string, number: number): string {
  const cleanSeries = series.trim().toUpperCase();
  return `${cleanSeries}-${String(number).padStart(8, "0")}`;
}

export function getNextDocumentNumber(
  type: "ticket" | "boleta",
  config: DocumentSeriesConfig
): string {
  if (type === "boleta") {
    return formatDocumentNumber(config.boletaSeries, config.lastBoletaNumber + 1);
  }
  return formatDocumentNumber(config.ticketSeries, config.lastTicketNumber + 1);
}

export function parseDocumentNumber(documentNumber: string): { series: string; number: string } {
  const [series = "", number = ""] = documentNumber.split("-");
  return { series: series.trim(), number: number.trim() };
}

export function formatReceiptDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("es-PE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export function formatSunatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

function resolveCustomerDocType(dni?: string): string {
  if (!dni?.trim()) return "-";
  const clean = dni.trim();
  if (clean.length === 11) return "6";
  if (clean.length === 8) return "1";
  return "1";
}

/** Payload QR según formato de representación impresa SUNAT. */
export function buildSunatQrPayload(
  ruc: string,
  sale: Sale & { sunatHash?: string }
): string {
  const docNumber = sale.documentNumber || "";
  const { series, number } = parseDocumentNumber(docNumber);
  const customerDoc = sale.customerDni?.trim() || "-";
  const customerType = resolveCustomerDocType(sale.customerDni);

  const parts = [
    ruc,
    "03",
    series,
    number,
    (sale.igv || 0).toFixed(2),
    sale.total.toFixed(2),
    formatSunatDate(sale.timestamp),
    customerType,
    customerDoc,
  ];

  if (sale.sunatHash) {
    parts.push(sale.sunatHash);
  }

  return parts.join("|");
}