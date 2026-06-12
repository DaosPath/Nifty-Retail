import type { CalloutTone } from "./types/widget";

export function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function normalizeTone(value: unknown): CalloutTone | undefined {
  const tone = String(value || "")
    .trim()
    .toLowerCase();
  if (!tone) return undefined;
  if (tone === "success" || tone === "ok") return "success";
  if (tone === "warning" || tone === "warn") return "warning";
  if (tone === "danger" || tone === "error" || tone === "critical") return "danger";
  return "neutral";
}

export const formatCellValue = (value: unknown): string => {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "number") {
    if (Number.isInteger(value)) return value.toLocaleString("es-PE");
    return value.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return String(value);
};