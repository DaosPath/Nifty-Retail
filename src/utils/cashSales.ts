import type { Sale, SaleItem } from "../components/ReceiptPrinter";
import type { StockMovement } from "../types/inventory";
import { calculateSaleTax, resolveTaxConfig, type TaxConfig } from "./tax";
import {
  deductSaleItems,
  restoreSaleItems,
  syncProductStockFromLots as syncFromLedger,
} from "./inventoryLedger";

export interface CashSession {
  id: string;
  startTime: string;
  endTime: string | null;
  initialBalance: number;
  salesCash: number;
  salesCard: number;
  salesYape?: number;
  withdrawals: number;
  deposits: number;
  expectedCash: number;
  actualCash: number | null;
  difference: number | null;
  notes?: string;
}

export interface Product {
  code: string;
  name: string;
  stock: number;
  minStock: number;
  purchasePrice: number;
  sellingPrice: number;
  category: string;
  expiryDate?: string;
}

export interface Lot {
  id: string;
  productCode: string;
  lotNumber: string;
  purchasePrice: number;
  initialQty: number;
  stock: number;
  expiryDate: string;
  createdAt: string;
  warehouseId?: string;
}

export function resolveSaleSessionId(sale: Sale, sessions: CashSession[]): string | null {
  if (sale.sessionId) return sale.sessionId;
  const saleTime = new Date(sale.timestamp).getTime();
  const match = sessions.find((s) => {
    const start = new Date(s.startTime).getTime();
    const end = s.endTime ? new Date(s.endTime).getTime() : Date.now() + 1;
    return saleTime >= start && saleTime <= end;
  });
  return match?.id ?? null;
}

export function migrateSalesSessionIds(sales: Sale[], sessions: CashSession[]): Sale[] {
  return sales.map((sale) => {
    if (sale.sessionId) return sale;
    const sessionId = resolveSaleSessionId(sale, sessions);
    return sessionId ? { ...sale, sessionId } : sale;
  });
}

export function getSessionSales(sales: Sale[], sessionId: string, sessions: CashSession[]): Sale[] {
  return sales
    .filter((s) => resolveSaleSessionId(s, sessions) === sessionId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function computeSessionPaymentTotals(sessionSales: Sale[]) {
  let salesCash = 0;
  let salesCard = 0;
  let salesYape = 0;
  for (const sale of sessionSales) {
    if (sale.paymentMethod === "Efectivo") salesCash += sale.total;
    else if (sale.paymentMethod === "Tarjeta") salesCard += sale.total;
    else if (sale.paymentMethod === "Yape") salesYape += sale.total;
  }
  return { salesCash, salesCard, salesYape };
}

export function recalculateSession(session: CashSession, sessionSales: Sale[]): CashSession {
  const { salesCash, salesCard, salesYape } = computeSessionPaymentTotals(sessionSales);
  const expectedCash = session.initialBalance + salesCash + session.deposits - session.withdrawals;
  const difference =
    session.actualCash !== null ? parseFloat((session.actualCash - expectedCash).toFixed(2)) : null;
  return {
    ...session,
    salesCash,
    salesCard,
    salesYape,
    expectedCash: parseFloat(expectedCash.toFixed(2)),
    difference,
  };
}

export function recalculateSaleTotals(
  items: SaleItem[],
  discount: number,
  taxConfig?: TaxConfig
) {
  const subtotal = parseFloat(
    items.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)
  );
  const breakdown = calculateSaleTax(subtotal, discount, resolveTaxConfig({ tax: taxConfig }));
  return {
    subtotal: breakdown.subtotal,
    total: breakdown.total,
    gravada: breakdown.taxableBase,
    igv: breakdown.taxAmount,
  };
}

export function restoreStockFromItems(
  items: SaleItem[],
  products: Product[],
  lots: Lot[],
  movements: StockMovement[] = [],
  warehouseId?: string,
  warehouseName?: string
): { products: Product[]; lots: Lot[]; movements: StockMovement[] } {
  const result = restoreSaleItems(
    { products, lots, movements },
    items,
    {
      warehouseId,
      warehouseName,
      referenceId: `restore_${Date.now()}`,
      reference: "RESTORE",
      detail: "Restauración de stock",
    }
  );
  return result;
}

export function deductStockFromItems(
  items: SaleItem[],
  products: Product[],
  lots: Lot[],
  movements: StockMovement[] = [],
  warehouseId?: string,
  warehouseName?: string
): { products: Product[]; lots: Lot[]; movements: StockMovement[]; itemsWithAllocations: SaleItem[] } {
  const result = deductSaleItems(
    { products, lots, movements },
    items,
    {
      warehouseId,
      warehouseName,
      referenceId: `deduct_${Date.now()}`,
      reference: "DEDUCT",
      detail: "Salida de stock",
    }
  );
  return result;
}

export function syncProductStockFromLots(products: Product[], lots: Lot[]): Product[] {
  return syncFromLedger(products, lots);
}

export function formatDateTime(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleString("es-PE", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}