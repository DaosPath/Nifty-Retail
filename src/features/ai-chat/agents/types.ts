import type { NiftyAppTab } from "../routeActions";

export type NiftyAgentId = "workspace" | "inventario" | "ventas" | "reportes";

export interface NiftyAgentDefinition {
  id: NiftyAgentId;
  label: string;
  labelEn: string;
  tagline: string;
  taglineEn: string;
  accent: string;
  emoji: string;
  suggestedRoutes: NiftyAppTab[];
}

export interface AgentSqlResult {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  truncated: boolean;
  sqlExecuted: string;
}

export interface AgentToolContext {
  locale: "es" | "en";
  products: unknown[];
  lots: unknown[];
  debts: unknown[];
  sales: unknown[];
  activeSession: unknown | null;
  cashSessions: unknown[];
  storeConfig: unknown;
  suppliers?: unknown[];
  categories?: unknown[];
  warehouses?: unknown[];
  stockMovements?: unknown[];
}

export interface AgentRunResult {
  text: string;
  toolsUsed: string[];
  agentId: NiftyAgentId;
}