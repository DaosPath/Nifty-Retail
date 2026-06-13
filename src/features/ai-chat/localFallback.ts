type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

export interface LocalFallbackContext {
  products: Array<{ code: string; name: string; stock: number; minStock: number }>;
  lots: Array<{ productCode: string; lotNumber: string; stock: number; expiryDate: string }>;
  debts: Array<{ customerName: string; customerDni?: string; totalDebt: number }>;
  sales: Array<{ total: number; paymentMethod: string }>;
  activeSession: {
    startTime: string;
    initialBalance: number;
    salesCash: number;
    salesCard: number;
    salesYape?: number;
    deposits: number;
    withdrawals: number;
    expectedCash: number;
  } | null;
  localeTag: string;
}

function matchesAny(q: string, words: string[]) {
  return words.some((word) => q.includes(word));
}

export function generateLocalAiResponse(query: string, ctx: LocalFallbackContext, t: TranslateFn): string {
  const q = query.toLowerCase();

  if (matchesAny(q, ["deuda", "debe", "fiado", "cliente", "debt", "owe", "credit", "customer", "receivable"])) {
    const activeDebtors = ctx.debts.filter((d) => d.totalDebt > 0);
    if (activeDebtors.length === 0) return t("aiChat.debtsNone");
    const list = activeDebtors
      .map((d) =>
        t("aiChat.debtItem", {
          name: d.customerName,
          dni: d.customerDni || "-",
          amount: d.totalDebt.toFixed(2),
        })
      )
      .join("\n");
    const total = activeDebtors.reduce((acc, curr) => acc + curr.totalDebt, 0);
    return t("aiChat.debtsList", { count: activeDebtors.length, total: total.toFixed(2), list });
  }

  if (matchesAny(q, ["vence", "fecha", "caduca", "vencid", "vencim", "expir", "expire", "spoil", "caduc"])) {
    const now = new Date();
    const limitDate = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);
    const expired = ctx.lots.filter((l) => l.stock > 0 && new Date(l.expiryDate) < now);
    const expiringSoon = ctx.lots.filter(
      (l) => l.stock > 0 && new Date(l.expiryDate) >= now && new Date(l.expiryDate) <= limitDate
    );

    let response = "";
    if (expired.length > 0) {
      const expiredList = expired
        .map((l) => {
          const prod = ctx.products.find((p) => p.code === l.productCode);
          return t("aiChat.expiryExpiredItem", {
            name: prod?.name || t("aiChat.unknownProduct"),
            lot: l.lotNumber,
            date: new Date(l.expiryDate).toLocaleDateString(ctx.localeTag),
            stock: l.stock,
          });
        })
        .join("\n");
      response += t("aiChat.expiryExpiredTitle", { list: expiredList });
    }

    if (expiringSoon.length > 0) {
      const soonList = expiringSoon
        .map((l) => {
          const prod = ctx.products.find((p) => p.code === l.productCode);
          const daysLeft = Math.ceil((new Date(l.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return t("aiChat.expirySoonItem", {
            name: prod?.name || t("aiChat.unknownProduct"),
            lot: l.lotNumber,
            date: new Date(l.expiryDate).toLocaleDateString(ctx.localeTag),
            days: daysLeft,
            stock: l.stock,
          });
        })
        .join("\n");
      response += t("aiChat.expirySoonTitle", { list: soonList });
    }

    return response || t("aiChat.expiryOk");
  }

  if (matchesAny(q, ["caja", "cuadre", "monto", "efectivo", "turno", "cash", "register", "drawer", "shift", "balance"])) {
    if (!ctx.activeSession) return t("aiChat.cashClosed");
    const session = ctx.activeSession;
    const totalInformativos = (session.salesCard || 0) + (session.salesYape || 0);
    return t("aiChat.cashSummary", {
      date: new Date(session.startTime).toLocaleDateString(ctx.localeTag),
      opening: session.initialBalance.toFixed(2),
      cash: session.salesCash.toFixed(2),
      deposits: session.deposits.toFixed(2),
      withdrawals: session.withdrawals.toFixed(2),
      expected: session.expectedCash.toFixed(2),
      card: session.salesCard.toFixed(2),
      yape: (session.salesYape || 0).toFixed(2),
      electronic: totalInformativos.toFixed(2),
    });
  }

  if (matchesAny(q, ["stock", "bajo", "critico", "alerta", "inventario", "low", "critical", "inventory", "replenish"])) {
    const lowStockProds = ctx.products
      .filter((p) => p.stock <= p.minStock)
      .sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name, ctx.localeTag));
    if (lowStockProds.length === 0) return t("aiChat.stockOk");
    const emptyCount = lowStockProds.filter((p) => p.stock <= 0).length;
    const list = lowStockProds
      .map((p) => t("aiChat.stockItem", { name: p.name, code: p.code, stock: p.stock, min: p.minStock }))
      .join("\n");
    const intro =
      emptyCount > 0
        ? t("aiChat.stockCriticalWithEmpty", { count: lowStockProds.length, empty: emptyCount })
        : t("aiChat.stockCritical", { count: lowStockProds.length });
    return `${intro}\n\n${list}`;
  }

  if (matchesAny(q, ["ventas", "venta", "total", "ingresos", "ganad", "sales", "sale", "revenue", "income", "earned"])) {
    const totalSalesSum = ctx.sales.reduce((acc, curr) => acc + curr.total, 0);
    const totalCashSum = ctx.sales.filter((s) => s.paymentMethod === "Efectivo").reduce((acc, curr) => acc + curr.total, 0);
    const totalCardSum = ctx.sales.filter((s) => s.paymentMethod === "Tarjeta").reduce((acc, curr) => acc + curr.total, 0);
    const totalYapeSum = ctx.sales.filter((s) => s.paymentMethod === "Yape").reduce((acc, curr) => acc + curr.total, 0);
    const totalFiadoSum = ctx.sales.filter((s) => s.paymentMethod === "Fiado").reduce((acc, curr) => acc + curr.total, 0);
    return t("aiChat.salesSummary", {
      count: ctx.sales.length,
      total: totalSalesSum.toFixed(2),
      cash: totalCashSum.toFixed(2),
      card: totalCardSum.toFixed(2),
      yape: totalYapeSum.toFixed(2),
      credit: totalFiadoSum.toFixed(2),
    });
  }

  return t("aiChat.fallbackTips");
}