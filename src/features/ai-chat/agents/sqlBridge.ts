import { invoke } from "@tauri-apps/api/core";
import type { AgentSqlResult } from "./types";

const FORBIDDEN = [
  "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "REPLACE",
  "ATTACH", "DETACH", "TRUNCATE", "VACUUM", "REINDEX", "PRAGMA",
];

export function validateReadonlySql(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) throw new Error("Consulta SQL vacía.");

  if (trimmed.includes(";")) {
    throw new Error("Solo una consulta por ejecución.");
  }

  const upper = trimmed.toUpperCase();
  for (const token of FORBIDDEN) {
    if (upper.includes(token)) {
      throw new Error(`Operación no permitida: ${token}`);
    }
  }

  if (!upper.startsWith("SELECT") && !upper.startsWith("WITH")) {
    throw new Error("Solo SELECT o WITH están permitidos.");
  }

  if (!upper.includes(" LIMIT ")) {
    return `${trimmed} LIMIT 200`;
  }

  return trimmed;
}

export async function executeReadonlySql(query: string): Promise<AgentSqlResult> {
  const safeQuery = validateReadonlySql(query);
  try {
    return await invoke<AgentSqlResult>("agent_run_readonly_sql", { query: safeQuery });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(message);
  }
}

export function summarizeSqlResult(result: AgentSqlResult, locale: "es" | "en"): string {
  if (result.rowCount === 0) {
    return locale === "en" ? "Query returned 0 rows." : "La consulta no devolvió filas.";
  }

  const preview = result.rows.slice(0, 5).map((row) => {
    const pairs = result.columns.map((col, index) => `${col}=${row[index] ?? ""}`);
    return pairs.join(", ");
  });

  const header =
    locale === "en"
      ? `Columns: ${result.columns.join(", ")} | Rows: ${result.rowCount}${result.truncated ? " (truncated)" : ""}`
      : `Columnas: ${result.columns.join(", ")} | Filas: ${result.rowCount}${result.truncated ? " (truncado)" : ""}`;

  return `${header}\n${preview.join("\n")}`;
}