import { runGeminiAgent } from "../ai-chat/agents/geminiRunner";
import { executeReadonlySql } from "../ai-chat/agents/sqlBridge";
import type { AgentSqlResult, AgentToolContext } from "../ai-chat/agents/types";

export type ReportsPeriod = "hoy" | "7d" | "30d";

export interface ReportsSqlSnapshot {
  revenue: number;
  transactions: number;
  prevRevenue: number;
  lowStockCount: number;
  outOfStockCount: number;
  expiringCount: number;
  customerDebtTotal: number;
  customersWithDebt: number;
  supplierDebtTotal: number;
  inventoryValue: number;
  topLowStock: string[];
}

export interface ReportsAiSummaryResult {
  text: string;
  mode: "gemini" | "sql" | "memory";
  sqlQueries: number;
}

function cellNumber(result: AgentSqlResult, row = 0, col = 0): number {
  const val = result.rows[row]?.[col];
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string") {
    const parsed = Number(val);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function cellString(result: AgentSqlResult, row = 0, col = 0): string {
  const val = result.rows[row]?.[col];
  return val == null ? "" : String(val);
}

function salesPeriodFilter(period: ReportsPeriod): string {
  switch (period) {
    case "hoy":
      return `date(json_extract(value, '$.timestamp')) >= date('now', 'localtime')`;
    case "7d":
      return `date(json_extract(value, '$.timestamp')) >= date('now', 'localtime', '-7 days')`;
    case "30d":
      return `date(json_extract(value, '$.timestamp')) >= date('now', 'localtime', '-30 days')`;
  }
}

function salesPrevPeriodFilter(period: ReportsPeriod): string {
  switch (period) {
    case "hoy":
      return `date(json_extract(value, '$.timestamp')) = date('now', 'localtime', '-1 day')`;
    case "7d":
      return `date(json_extract(value, '$.timestamp')) >= date('now', 'localtime', '-14 days') AND date(json_extract(value, '$.timestamp')) < date('now', 'localtime', '-7 days')`;
    case "30d":
      return `date(json_extract(value, '$.timestamp')) >= date('now', 'localtime', '-60 days') AND date(json_extract(value, '$.timestamp')) < date('now', 'localtime', '-30 days')`;
  }
}

function salesAggregateSql(filter: string): string {
  return `SELECT COUNT(*) AS transactions, COALESCE(SUM(CAST(json_extract(value, '$.total') AS REAL)), 0) AS revenue
FROM collections, json_each(collections.payload)
WHERE collections.name = 'sales' AND ${filter}
LIMIT 1`;
}

const SQL_LOW_STOCK = `SELECT COUNT(*) AS low_stock
FROM products
WHERE CAST(json_extract(payload, '$.stock') AS INTEGER) <= CAST(json_extract(payload, '$.minStock') AS INTEGER)
LIMIT 1`;

const SQL_OUT_OF_STOCK = `SELECT COUNT(*) AS out_of_stock
FROM products
WHERE CAST(json_extract(payload, '$.stock') AS INTEGER) <= 0
LIMIT 1`;

const SQL_EXPIRING_LOTS = `SELECT COUNT(*) AS expiring
FROM collections, json_each(collections.payload)
WHERE collections.name = 'lots'
  AND CAST(json_extract(value, '$.stock') AS INTEGER) > 0
  AND date(json_extract(value, '$.expiryDate')) BETWEEN date('now', 'localtime') AND date('now', 'localtime', '+45 days')
LIMIT 1`;

const SQL_CUSTOMER_DEBT = `SELECT
  COALESCE(SUM(CAST(json_extract(value, '$.totalDebt') AS REAL)), 0) AS ar_total,
  SUM(CASE WHEN CAST(json_extract(value, '$.totalDebt') AS REAL) > 0 THEN 1 ELSE 0 END) AS debtors
FROM collections, json_each(collections.payload)
WHERE collections.name = 'debts'
LIMIT 1`;

const SQL_SUPPLIER_DEBT = `SELECT COALESCE(SUM(CAST(json_extract(value, '$.totalDebt') AS REAL)), 0) AS ap_total
FROM collections, json_each(collections.payload)
WHERE collections.name = 'supplierDebts'
LIMIT 1`;

const SQL_INVENTORY_VALUE = `SELECT COALESCE(SUM(
  CAST(json_extract(payload, '$.stock') AS REAL) * CAST(json_extract(payload, '$.purchasePrice') AS REAL)
), 0) AS inventory_value
FROM products
LIMIT 1`;

const SQL_TOP_LOW_STOCK = `SELECT json_extract(payload, '$.name') AS name
FROM products
WHERE CAST(json_extract(payload, '$.stock') AS INTEGER) <= CAST(json_extract(payload, '$.minStock') AS INTEGER)
ORDER BY CAST(json_extract(payload, '$.stock') AS INTEGER) ASC, json_extract(payload, '$.name') ASC
LIMIT 3`;

export async function fetchReportsSqlSnapshot(period: ReportsPeriod): Promise<ReportsSqlSnapshot> {
  const [
    salesNow,
    salesPrev,
    lowStock,
    outStock,
    expiring,
    customerDebt,
    supplierDebt,
    inventory,
    topLow,
  ] = await Promise.all([
    executeReadonlySql(salesAggregateSql(salesPeriodFilter(period))),
    executeReadonlySql(salesAggregateSql(salesPrevPeriodFilter(period))),
    executeReadonlySql(SQL_LOW_STOCK),
    executeReadonlySql(SQL_OUT_OF_STOCK),
    executeReadonlySql(SQL_EXPIRING_LOTS),
    executeReadonlySql(SQL_CUSTOMER_DEBT),
    executeReadonlySql(SQL_SUPPLIER_DEBT),
    executeReadonlySql(SQL_INVENTORY_VALUE),
    executeReadonlySql(SQL_TOP_LOW_STOCK),
  ]);

  return {
    revenue: cellNumber(salesNow, 0, 1),
    transactions: cellNumber(salesNow, 0, 0),
    prevRevenue: cellNumber(salesPrev, 0, 1),
    lowStockCount: cellNumber(lowStock),
    outOfStockCount: cellNumber(outStock),
    expiringCount: cellNumber(expiring),
    customerDebtTotal: cellNumber(customerDebt, 0, 0),
    customersWithDebt: cellNumber(customerDebt, 0, 1),
    supplierDebtTotal: cellNumber(supplierDebt),
    inventoryValue: cellNumber(inventory),
    topLowStock: topLow.rows.map((_, index) => cellString(topLow, index, 0)).filter(Boolean),
  };
}

function trimExecutiveSummary(text: string, max = 320): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

export function buildSqlExecutiveSummary(
  snapshot: ReportsSqlSnapshot,
  periodText: string,
  locale: "es" | "en",
  formatMoney: (value: number) => string
): string {
  const revenueChange =
    snapshot.prevRevenue > 0
      ? ((snapshot.revenue - snapshot.prevRevenue) / snapshot.prevRevenue) * 100
      : 0;
  const changeLabel = `${revenueChange >= 0 ? "+" : ""}${revenueChange.toFixed(1)}%`;
  const topHint =
    snapshot.topLowStock.length > 0
      ? locale === "en"
        ? ` Top gaps: ${snapshot.topLowStock.slice(0, 2).join(", ")}.`
        : ` Priorizar: ${snapshot.topLowStock.slice(0, 2).join(", ")}.`
      : "";

  if (snapshot.revenue === 0) {
    return locale === "en"
      ? `Zero sales in ${periodText} (SQLite). ${snapshot.lowStockCount} low-stock SKUs (${snapshot.outOfStockCount} empty), ${snapshot.expiringCount} lots expiring in 45d. AR ${formatMoney(snapshot.customerDebtTotal)}, AP ${formatMoney(snapshot.supplierDebtTotal)}. Inventory ${formatMoney(snapshot.inventoryValue)}.${topHint}`
      : `Sin ventas en ${periodText} (SQLite). ${snapshot.lowStockCount} SKUs bajos (${snapshot.outOfStockCount} agotados), ${snapshot.expiringCount} lotes por vencer en 45d. CxC ${formatMoney(snapshot.customerDebtTotal)}, CxP ${formatMoney(snapshot.supplierDebtTotal)}. Inventario ${formatMoney(snapshot.inventoryValue)}.${topHint}`;
  }

  return locale === "en"
    ? `Sales ${formatMoney(snapshot.revenue)} in ${periodText} (${changeLabel}, ${snapshot.transactions} tickets, SQLite). ${snapshot.lowStockCount} low-stock, ${snapshot.expiringCount} lots expiring. AR ${formatMoney(snapshot.customerDebtTotal)} (${snapshot.customersWithDebt} debtors) vs AP ${formatMoney(snapshot.supplierDebtTotal)}.${topHint}`
    : `Ventas ${formatMoney(snapshot.revenue)} en ${periodText} (${changeLabel}, ${snapshot.transactions} tickets, SQLite). ${snapshot.lowStockCount} bajos, ${snapshot.expiringCount} lotes por vencer. CxC ${formatMoney(snapshot.customerDebtTotal)} (${snapshot.customersWithDebt} deudores) vs CxP ${formatMoney(snapshot.supplierDebtTotal)}.${topHint}`;
}

export async function generateReportsAiSummary(options: {
  geminiKey: string;
  period: ReportsPeriod;
  periodLabel: string;
  locale: "es" | "en";
  formatMoney: (value: number) => string;
  toolContext: AgentToolContext;
  memoryFallback: () => string;
}): Promise<ReportsAiSummaryResult> {
  const { geminiKey, period, periodLabel, locale, formatMoney, toolContext, memoryFallback } = options;

  if (geminiKey) {
    try {
      const userMessage =
        locale === "en"
          ? `Executive dashboard summary for period "${periodLabel}". Max 300 characters, no bullets. Use ejecutar_sql on the local SQLite database to fetch real sales (${period}), low stock, expiring lots, AR/AP and inventory value. Never invent numbers.`
          : `Resumen ejecutivo del panel para el período "${periodLabel}". Máximo 300 caracteres, sin viñetas. Usa ejecutar_sql sobre la base SQLite local para obtener ventas reales (${period}), stock bajo, lotes por vencer, CxC/CxP e inventario. No inventes cifras.`;

      const result = await runGeminiAgent({
        apiKey: geminiKey,
        agentId: "reportes",
        userMessage,
        toolContext,
      });

      const sqlQueries = result.toolsUsed.filter((tool) => tool === "ejecutar_sql").length;

      return {
        text: trimExecutiveSummary(result.text),
        mode: "gemini",
        sqlQueries: sqlQueries > 0 ? sqlQueries : 1,
      };
    } catch {
      // Fall through to direct SQL snapshot.
    }
  }

  try {
    const snapshot = await fetchReportsSqlSnapshot(period);
    return {
      text: trimExecutiveSummary(buildSqlExecutiveSummary(snapshot, periodLabel, locale, formatMoney)),
      mode: "sql",
      sqlQueries: 9,
    };
  } catch {
    return {
      text: memoryFallback(),
      mode: "memory",
      sqlQueries: 0,
    };
  }
}