import type { NiftyAgentDefinition } from "./types";

export const NIFTY_AGENTS: NiftyAgentDefinition[] = [
  {
    id: "workspace",
    label: "Copiloto",
    labelEn: "Copilot",
    tagline: "Orquesta consultas y te guía por la app",
    taglineEn: "Orchestrates queries and guides you through the app",
    accent: "#00b5e2",
    emoji: "✦",
    suggestedRoutes: ["pos", "inventory", "reports", "settings"],
  },
  {
    id: "inventario",
    label: "Inventario",
    labelEn: "Inventory",
    tagline: "Stock, lotes, kardex y alertas",
    taglineEn: "Stock, lots, kardex and alerts",
    accent: "#22c55e",
    emoji: "📦",
    suggestedRoutes: ["inventory", "kardex", "alerts", "stock-entry"],
  },
  {
    id: "ventas",
    label: "Ventas & Caja",
    labelEn: "Sales & Cash",
    tagline: "POS, caja, fiados y cobranzas",
    taglineEn: "POS, cash drawer, credit sales",
    accent: "#c2117a",
    emoji: "💳",
    suggestedRoutes: ["pos", "cash", "debts", "sales-history"],
  },
  {
    id: "reportes",
    label: "Analista",
    labelEn: "Analyst",
    tagline: "KPIs, tendencias y tablas exportables",
    taglineEn: "KPIs, trends and exportable tables",
    accent: "#a855f7",
    emoji: "📊",
    suggestedRoutes: ["reports", "sales-history", "inventory"],
  },
];

export function getAgentDefinition(id: string): NiftyAgentDefinition {
  return NIFTY_AGENTS.find((agent) => agent.id === id) ?? NIFTY_AGENTS[0];
}