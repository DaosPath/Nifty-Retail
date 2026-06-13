import { dispatchWidgetAction } from "../routeActions";
import { executeReadonlySql, summarizeSqlResult } from "./sqlBridge";
import type { AgentToolContext } from "./types";

type ToolArgs = Record<string, unknown>;

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function productRecord(item: unknown): Record<string, unknown> | null {
  return item && typeof item === "object" ? (item as Record<string, unknown>) : null;
}

export async function executeAgentTool(
  name: string,
  args: ToolArgs,
  ctx: AgentToolContext
): Promise<Record<string, unknown>> {
  switch (name) {
    case "ejecutar_sql": {
      const query = asString(args.query);
      const result = await executeReadonlySql(query);
      return {
        ok: true,
        summary: summarizeSqlResult(result, ctx.locale),
        columns: result.columns,
        rows: result.rows,
        rowCount: result.rowCount,
        truncated: result.truncated,
        sqlExecuted: result.sqlExecuted,
      };
    }

    case "buscar_productos": {
      const term = asString(args.termino).toLowerCase().trim();
      const limit = Math.min(20, Math.max(1, asNumber(args.limite, 10)));
      const matches = (ctx.products as unknown[])
        .map(productRecord)
        .filter((p): p is Record<string, unknown> => !!p)
        .filter((p) => {
          const name = String(p.name ?? "").toLowerCase();
          const code = String(p.code ?? "").toLowerCase();
          const category = String(p.category ?? "").toLowerCase();
          return name.includes(term) || code.includes(term) || category.includes(term);
        })
        .slice(0, limit)
        .map((p) => ({
          code: p.code,
          name: p.name,
          stock: p.stock,
          category: p.category,
          sellingPrice: p.sellingPrice,
        }));

      return { ok: true, count: matches.length, products: matches };
    }

    case "obtener_resumen": {
      const foco = asString(args.foco, "general");
      const products = ctx.products as unknown[];
      const sales = ctx.sales as unknown[];
      const debts = (ctx.debts as unknown[]).map(productRecord).filter(Boolean) as Record<string, unknown>[];

      const lowStock = products
        .map(productRecord)
        .filter((p): p is Record<string, unknown> => !!p)
        .filter((p) => Number(p.stock ?? 0) <= Number(p.minStock ?? 0));

      const totalDebt = debts.reduce((acc, d) => acc + Number(d.totalDebt ?? 0), 0);
      const deudores = debts.filter((d) => Number(d.totalDebt ?? 0) > 0).length;
      const salesTotal = sales
        .map(productRecord)
        .filter((s): s is Record<string, unknown> => !!s)
        .reduce((acc, s) => acc + Number(s.total ?? 0), 0);

      const summary: Record<string, unknown> = {
        foco,
        productos: products.length,
        ventasRegistradas: sales.length,
        stockCritico: lowStock.length,
        deudores,
        deudaTotal: Number(totalDebt.toFixed(2)),
        ventasHistoricasTotal: Number(salesTotal.toFixed(2)),
        cajaAbierta: !!ctx.activeSession,
      };

      if (ctx.activeSession && typeof ctx.activeSession === "object") {
        const session = ctx.activeSession as Record<string, unknown>;
        summary.caja = {
          inicio: session.startTime,
          esperadoEfectivo: session.expectedCash,
          ventasEfectivo: session.salesCash,
        };
      }

      return { ok: true, summary };
    }

    case "navegar": {
      const route = asString(args.ruta, "/pos");
      const motivo = asString(args.motivo);
      dispatchWidgetAction({ action: "navigate", value: route, label: motivo || route });
      return {
        ok: true,
        navigated: route,
        motivo,
        message: ctx.locale === "en" ? `Opened ${route}` : `Se abrió ${route}`,
      };
    }

    case "rellenar_consulta": {
      const text = asString(args.texto);
      dispatchWidgetAction({ action: "fill_input", value: text, label: "suggestion" });
      return {
        ok: true,
        filled: text,
        message: ctx.locale === "en" ? "Suggestion placed in the input." : "Sugerencia colocada en el campo de consulta.",
      };
    }

    default:
      return { ok: false, error: `Herramienta desconocida: ${name}` };
  }
}