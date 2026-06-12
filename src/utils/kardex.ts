import type { Sale } from "../components/ReceiptPrinter";
import type { StockMovement, StockMovementType } from "../types/inventory";
import { StockMovementTypes } from "../types/inventory";
import type { KardexRow, StockPurchase } from "../types/stock";
import { migrateMovementsFromHistory } from "./inventoryLedger";

interface KardexProduct {
  code: string;
  name: string;
}

const TYPE_LABELS: Record<StockMovementType, string> = {
  COMPRA: "Compra",
  VENTA: "Venta",
  AJUSTE_ENTRADA: "Ajuste entrada",
  AJUSTE_SALIDA: "Ajuste salida",
  TRASLADO_ENTRADA: "Traslado entrada",
  TRASLADO_SALIDA: "Traslado salida",
  DEVOLUCION_CLIENTE: "Devolución cliente",
  DEVOLUCION_PROVEEDOR: "Devolución proveedor",
};

export function movementTypeLabel(type: StockMovementType): string {
  return TYPE_LABELS[type] || type;
}

export function buildKardexFromMovements(
  product: KardexProduct,
  movements: StockMovement[],
  filters?: {
    warehouseId?: string;
    types?: StockMovementType[];
    dateFrom?: string;
    dateTo?: string;
  }
): KardexRow[] {
  let rows = movements.filter((m) => m.productCode === product.code);

  if (filters?.warehouseId) {
    rows = rows.filter((m) => m.warehouseId === filters.warehouseId);
  }
  if (filters?.types?.length) {
    rows = rows.filter((m) => filters.types!.includes(m.type));
  }
  if (filters?.dateFrom) {
    const from = new Date(`${filters.dateFrom}T00:00:00`).getTime();
    rows = rows.filter((m) => new Date(m.timestamp).getTime() >= from);
  }
  if (filters?.dateTo) {
    const to = new Date(`${filters.dateTo}T23:59:59`).getTime();
    rows = rows.filter((m) => new Date(m.timestamp).getTime() <= to);
  }

  rows.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  let balance = 0;
  return rows.map((m) => {
    const entrada = m.quantity > 0 ? Math.abs(m.quantity) : 0;
    const salida = m.quantity < 0 ? Math.abs(m.quantity) : 0;
    balance = m.stockAfter;
    return {
      id: m.id,
      timestamp: m.timestamp,
      type: m.type,
      reference: m.reference || m.referenceId || "—",
      detail: [m.detail, m.warehouseName, m.lotNumber && `Lote ${m.lotNumber}`].filter(Boolean).join(" · "),
      entrada,
      salida,
      unitCost: m.unitCost,
      balance,
      warehouseId: m.warehouseId,
      warehouseName: m.warehouseName,
      lotNumber: m.lotNumber,
    };
  });
}

/** @deprecated Usar buildKardexFromMovements */
export function buildProductKardex(
  product: KardexProduct,
  purchases: StockPurchase[],
  sales: Sale[]
): KardexRow[] {
  const products = [{ code: product.code, name: product.name, stock: 0, minStock: 0, purchasePrice: 0, sellingPrice: 0, category: "" }];
  const movements = migrateMovementsFromHistory(purchases, sales, products);
  return buildKardexFromMovements(product, movements);
}

export function formatKardexDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString("es-PE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export const KARDEX_TYPE_OPTIONS: { value: StockMovementType | "ALL"; label: string }[] = [
  { value: "ALL", label: "Todos" },
  { value: StockMovementTypes.COMPRA, label: "Compras" },
  { value: StockMovementTypes.VENTA, label: "Ventas" },
  { value: StockMovementTypes.AJUSTE_ENTRADA, label: "Ajuste entrada" },
  { value: StockMovementTypes.AJUSTE_SALIDA, label: "Ajuste salida" },
  { value: StockMovementTypes.TRASLADO_ENTRADA, label: "Traslado entrada" },
  { value: StockMovementTypes.TRASLADO_SALIDA, label: "Traslado salida" },
  { value: StockMovementTypes.DEVOLUCION_CLIENTE, label: "Devolución cliente" },
  { value: StockMovementTypes.DEVOLUCION_PROVEEDOR, label: "Devolución proveedor" },
];