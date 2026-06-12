import { AI_WIDGET_ACTION_EVENT } from "./constants";

export type NiftyAppTab =
  | "pos"
  | "inventory"
  | "catalog"
  | "stock-entry"
  | "kardex"
  | "alerts"
  | "cash"
  | "sales-history"
  | "reports"
  | "debts"
  | "ai-chat"
  | "settings";

const ROUTE_ALIAS_MAP: Record<string, NiftyAppTab> = {
  "/pos": "pos",
  "/punto-de-venta": "pos",
  "/venta": "pos",
  "/ventas": "pos",
  "/inventory": "inventory",
  "/inventario": "inventory",
  "/productos": "inventory",
  "/stock": "inventory",
  "/catalog": "catalog",
  "/catalogo": "catalog",
  "/stock-entry": "stock-entry",
  "/compras": "stock-entry",
  "/ingreso": "stock-entry",
  "/kardex": "kardex",
  "/alerts": "alerts",
  "/alertas": "alerts",
  "/cash": "cash",
  "/caja": "cash",
  "/sales-history": "sales-history",
  "/historial-ventas": "sales-history",
  "/ventas/historial": "sales-history",
  "/reports": "reports",
  "/reportes": "reports",
  "/debts": "debts",
  "/deudas": "debts",
  "/fiado": "debts",
  "/ai-chat": "ai-chat",
  "/asistente": "ai-chat",
  "/chat": "ai-chat",
  "/settings": "settings",
  "/configuracion": "settings",
};

function normalizeRouteKey(value: string) {
  return value.trim().toLowerCase().replace(/\/+$/, "") || "/";
}

export function resolveAppTab(rawValue: string): NiftyAppTab {
  const trimmed = rawValue.trim();
  if (!trimmed) return "pos";

  const withoutHash = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  const normalizedPath = withoutHash.startsWith("/") ? withoutHash : `/${withoutHash}`;
  const [pathname] = normalizedPath.split("?");
  const normalizedKey = normalizeRouteKey(pathname);

  if (ROUTE_ALIAS_MAP[normalizedKey]) {
    return ROUTE_ALIAS_MAP[normalizedKey];
  }

  if (normalizedKey.startsWith("/inventario") || normalizedKey.startsWith("/inventory")) return "inventory";
  if (normalizedKey.startsWith("/compras") || normalizedKey.startsWith("/stock-entry")) return "stock-entry";
  if (normalizedKey.startsWith("/caja") || normalizedKey.startsWith("/cash")) return "cash";
  if (normalizedKey.startsWith("/ventas") || normalizedKey.startsWith("/sales")) return "sales-history";
  if (normalizedKey.startsWith("/deudas") || normalizedKey.startsWith("/debts")) return "debts";

  return "pos";
}

export type WidgetActionDetail = {
  label: string;
  action: "navigate" | "fill_input";
  value: string;
  tone?: string;
};

export function dispatchWidgetAction(detail: WidgetActionDetail) {
  window.dispatchEvent(new CustomEvent(AI_WIDGET_ACTION_EVENT, { detail }));
}