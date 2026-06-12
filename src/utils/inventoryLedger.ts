import type { Product, Lot } from "../App";
import type { SaleItem } from "../components/ReceiptPrinter";
import type { StockPurchase } from "../types/stock";
import {
  StockMovementTypes,
  type LotAllocation,
  type StockMovement,
  type StockMovementType,
} from "../types/inventory";

export interface LedgerContext {
  products: Product[];
  lots: Lot[];
  movements: StockMovement[];
}

export interface LedgerResult extends LedgerContext {
  allocations?: LotAllocation[];
}

const now = () => new Date().toISOString();

function movementId(prefix: string): string {
  return `mov_${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function syncProductStockFromLots(products: Product[], lots: Lot[]): Product[] {
  return products.map((p) => {
    const prodLots = lots.filter((l) => l.productCode === p.code);
    if (prodLots.length === 0) return p;
    const newStock = prodLots.reduce((sum, l) => sum + l.stock, 0);
    const activeLots = prodLots.filter((l) => l.stock > 0);
    const earliestExpiry =
      activeLots.length > 0
        ? activeLots.reduce(
            (earliest, curr) =>
              new Date(curr.expiryDate) < new Date(earliest) ? curr.expiryDate : earliest,
            activeLots[0].expiryDate
          )
        : p.expiryDate;
    return { ...p, stock: newStock, expiryDate: earliestExpiry };
  });
}

export function getProductStock(products: Product[], productCode: string): number {
  return products.find((p) => p.code === productCode)?.stock ?? 0;
}

export function buildWarehouseStockMap(lots: Lot[], warehouseId?: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const lot of lots) {
    if (lot.stock <= 0) continue;
    if (warehouseId && lot.warehouseId !== warehouseId) continue;
    map.set(lot.productCode, (map.get(lot.productCode) ?? 0) + lot.stock);
  }
  return map;
}

export function getWarehouseStock(lots: Lot[], productCode: string, warehouseId?: string): number {
  let total = 0;
  for (const lot of lots) {
    if (lot.productCode !== productCode || lot.stock <= 0) continue;
    if (warehouseId && lot.warehouseId !== warehouseId) continue;
    total += lot.stock;
  }
  return total;
}

export function getFefoLots(lots: Lot[], productCode: string, warehouseId?: string): Lot[] {
  return lots
    .filter(
      (l) =>
        l.productCode === productCode &&
        l.stock > 0 &&
        (!warehouseId || l.warehouseId === warehouseId)
    )
    .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
}

function appendMovement(
  movements: StockMovement[],
  entry: Omit<StockMovement, "id" | "timestamp" | "channel"> & { timestamp?: string }
): StockMovement[] {
  const row: StockMovement = {
    id: movementId(entry.type.toLowerCase()),
    timestamp: entry.timestamp ?? now(),
    channel: "pos",
    ...entry,
  };
  return [...movements, row];
}

function findOrCreateLot(
  lots: Lot[],
  params: {
    productCode: string;
    warehouseId?: string;
    lotNumber: string;
    expiryDate: string;
    unitCost: number;
    quantity: number;
  }
): { lots: Lot[]; lot: Lot; created: boolean } {
  const existing = lots.find(
    (l) =>
      l.productCode === params.productCode &&
      l.lotNumber === params.lotNumber &&
      l.expiryDate === params.expiryDate &&
      l.warehouseId === params.warehouseId
  );

  if (existing) {
    const updated = lots.map((l) =>
      l.id === existing.id ? { ...l, stock: l.stock + params.quantity } : l
    );
    const lot = updated.find((l) => l.id === existing.id)!;
    return { lots: updated, lot, created: false };
  }

  const lot: Lot = {
    id: `lot_${params.productCode}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    productCode: params.productCode,
    lotNumber: params.lotNumber,
    purchasePrice: params.unitCost,
    initialQty: params.quantity,
    stock: params.quantity,
    expiryDate: params.expiryDate,
    createdAt: now(),
    warehouseId: params.warehouseId,
  };
  return { lots: [...lots, lot], lot, created: true };
}

export function registerInbound(ctx: LedgerContext, params: {
  productCode: string;
  productName: string;
  warehouseId?: string;
  warehouseName?: string;
  quantity: number;
  movementType: StockMovementType;
  unitCost?: number;
  lotNumber?: string;
  expiryDate?: string;
  lotId?: string;
  referenceId?: string;
  referenceTable?: string;
  reference?: string;
  detail?: string;
  timestamp?: string;
}): LedgerResult {
  const qty = Math.abs(params.quantity);
  if (qty <= 0) throw new Error("Cantidad inválida para entrada de stock.");

  let lots = [...ctx.lots];
  const stockBefore = getProductStock(ctx.products, params.productCode);
  const isPurchase = params.movementType === StockMovementTypes.COMPRA;
  if (isPurchase && !params.expiryDate) {
    throw new Error("La fecha de vencimiento es obligatoria para registrar una compra.");
  }

  const expiry =
    params.expiryDate ||
    new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const unitCost = params.unitCost ?? ctx.products.find((p) => p.code === params.productCode)?.purchasePrice ?? 0;

  let targetLot: Lot;

  if (params.lotId) {
    const idx = lots.findIndex((l) => l.id === params.lotId);
    if (idx < 0) throw new Error("Lote no encontrado.");
    lots[idx] = { ...lots[idx], stock: lots[idx].stock + qty };
    targetLot = lots[idx];
  } else if (isPurchase) {
    const lotNumber = params.lotNumber || `CMP-${Date.now().toString().slice(-8)}`;
    const lot: Lot = {
      id: `lot_${params.productCode}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      productCode: params.productCode,
      lotNumber,
      purchasePrice: unitCost,
      initialQty: qty,
      stock: qty,
      expiryDate: expiry,
      createdAt: now(),
      warehouseId: params.warehouseId,
    };
    lots = [...lots, lot];
    targetLot = lot;
  } else {
    const lotNumber = params.lotNumber || `IN-${Date.now().toString().slice(-6)}`;
    const created = findOrCreateLot(lots, {
      productCode: params.productCode,
      warehouseId: params.warehouseId,
      lotNumber,
      expiryDate: expiry,
      unitCost,
      quantity: qty,
    });
    lots = created.lots;
    targetLot = created.lot;
  }

  const stockAfter = stockBefore + qty;
  let movements = appendMovement(ctx.movements, {
    productCode: params.productCode,
    productName: params.productName,
    type: params.movementType,
    quantity: qty,
    stockBefore,
    stockAfter,
    warehouseId: params.warehouseId,
    warehouseName: params.warehouseName,
    lotId: targetLot.id,
    lotNumber: targetLot.lotNumber,
    referenceId: params.referenceId,
    referenceTable: params.referenceTable,
    reference: params.reference,
    detail: params.detail,
    unitCost,
    timestamp: params.timestamp,
  });

  const products = syncProductStockFromLots(ctx.products, lots);
  return { products, lots, movements };
}

export function consumeOutbound(ctx: LedgerContext, params: {
  productCode: string;
  productName: string;
  warehouseId?: string;
  warehouseName?: string;
  quantity: number;
  movementType: StockMovementType;
  referenceId?: string;
  referenceTable?: string;
  reference?: string;
  detail?: string;
  unitCost?: number;
  timestamp?: string;
  allowNegative?: boolean;
}): LedgerResult {
  const qtyNeeded = Math.abs(params.quantity);
  if (qtyNeeded <= 0) throw new Error("Cantidad inválida para salida de stock.");

  const stockBefore = getProductStock(ctx.products, params.productCode);
  const candidates = getFefoLots(ctx.lots, params.productCode, params.warehouseId);

  let remaining = qtyNeeded;
  const allocations: LotAllocation[] = [];
  let lots = [...ctx.lots];
  let movements = [...ctx.movements];
  let runningStock = stockBefore;

  for (const candidate of candidates) {
    if (remaining <= 0) break;
    const lotRef = lots.find((l) => l.id === candidate.id);
    if (!lotRef || lotRef.stock <= 0) continue;

    const take = Math.min(lotRef.stock, remaining);
    const before = runningStock;
    runningStock -= take;

    lots = lots.map((l) => (l.id === lotRef.id ? { ...l, stock: l.stock - take } : l));
    remaining -= take;

    allocations.push({
      lotId: lotRef.id,
      lotNumber: lotRef.lotNumber,
      warehouseId: lotRef.warehouseId || params.warehouseId || "",
      quantity: take,
      unitCost: lotRef.purchasePrice,
    });

    movements = appendMovement(movements, {
      productCode: params.productCode,
      productName: params.productName,
      type: params.movementType,
      quantity: -take,
      stockBefore: before,
      stockAfter: runningStock,
      warehouseId: lotRef.warehouseId || params.warehouseId,
      warehouseName: params.warehouseName,
      lotId: lotRef.id,
      lotNumber: lotRef.lotNumber,
      referenceId: params.referenceId,
      referenceTable: params.referenceTable,
      reference: params.reference,
      detail: params.detail,
      unitCost: params.unitCost ?? lotRef.purchasePrice,
      timestamp: params.timestamp,
    });
  }

  if (remaining > 0 && !params.allowNegative) {
    const whLabel = params.warehouseName || "el almacén seleccionado";
    throw new Error(
      `Stock insuficiente de "${params.productName}" en ${whLabel}. Faltan ${remaining} unidad(es).`
    );
  }

  if (remaining > 0 && params.allowNegative) {
    const fallback = lots.filter((l) => l.productCode === params.productCode);
    if (fallback.length > 0) {
      lots = lots.map((l) =>
        l.id === fallback[0].id ? { ...l, stock: l.stock - remaining } : l
      );
      allocations.push({
        lotId: fallback[0].id,
        lotNumber: fallback[0].lotNumber,
        warehouseId: fallback[0].warehouseId || "",
        quantity: remaining,
      });
    }
  }

  const products = syncProductStockFromLots(ctx.products, lots);

  return { products, lots, movements, allocations };
}

export function applyStockAdjustment(
  ctx: LedgerContext,
  params: {
    productCode: string;
    productName: string;
    newStock: number;
    warehouseId?: string;
    warehouseName?: string;
    observation?: string;
  }
): LedgerResult {
  const current = getProductStock(ctx.products, params.productCode);
  const delta = params.newStock - current;
  if (delta === 0) return ctx;

  if (delta > 0) {
    return registerInbound(ctx, {
      productCode: params.productCode,
      productName: params.productName,
      warehouseId: params.warehouseId,
      warehouseName: params.warehouseName,
      quantity: delta,
      movementType: StockMovementTypes.AJUSTE_ENTRADA,
      referenceTable: "ajustes",
      reference: "AJUSTE-MANUAL",
      detail: params.observation || "Ajuste manual de inventario",
      unitCost: ctx.products.find((p) => p.code === params.productCode)?.purchasePrice,
    });
  }

  return consumeOutbound(ctx, {
    productCode: params.productCode,
    productName: params.productName,
    warehouseId: params.warehouseId,
    warehouseName: params.warehouseName,
    quantity: Math.abs(delta),
    movementType: StockMovementTypes.AJUSTE_SALIDA,
    referenceTable: "ajustes",
    reference: "AJUSTE-MANUAL",
    detail: params.observation || "Ajuste manual de inventario",
  });
}

export function restoreSaleItems(
  ctx: LedgerContext,
  items: SaleItem[],
  params: {
    warehouseId?: string;
    warehouseName?: string;
    referenceId: string;
    reference?: string;
    detail?: string;
    timestamp?: string;
  }
): LedgerResult {
  let state: LedgerContext = { ...ctx };

  for (const item of items) {
    const product = state.products.find((p) => p.code === item.code);
    if (!product) continue;

    if (item.lotAllocations?.length) {
      for (const alloc of item.lotAllocations) {
        state = registerInbound(state, {
          productCode: item.code,
          productName: item.name,
          warehouseId: alloc.warehouseId || params.warehouseId,
          warehouseName: params.warehouseName,
          quantity: alloc.quantity,
          movementType: StockMovementTypes.DEVOLUCION_CLIENTE,
          lotId: alloc.lotId,
          unitCost: alloc.unitCost,
          referenceId: params.referenceId,
          referenceTable: "ventas",
          reference: params.reference,
          detail: params.detail || "Devolución por anulación/edición de venta",
          timestamp: params.timestamp,
        });
      }
    } else {
      state = registerInbound(state, {
        productCode: item.code,
        productName: item.name,
        warehouseId: params.warehouseId,
        warehouseName: params.warehouseName,
        quantity: item.quantity,
        movementType: StockMovementTypes.DEVOLUCION_CLIENTE,
        referenceId: params.referenceId,
        referenceTable: "ventas",
        reference: params.reference,
        detail: params.detail || "Devolución por anulación/edición de venta",
        timestamp: params.timestamp,
      });
    }
  }

  return state;
}

export function deductSaleItems(
  ctx: LedgerContext,
  items: Array<SaleItem & { lotAllocations?: LotAllocation[] }>,
  params: {
    warehouseId?: string;
    warehouseName?: string;
    referenceId: string;
    reference?: string;
    detail?: string;
    timestamp?: string;
  }
): LedgerResult & { itemsWithAllocations: SaleItem[] } {
  let state: LedgerContext = { ...ctx };
  const itemsWithAllocations: SaleItem[] = [];

  for (const item of items) {
    const result = consumeOutbound(state, {
      productCode: item.code,
      productName: item.name,
      warehouseId: params.warehouseId,
      warehouseName: params.warehouseName,
      quantity: item.quantity,
      movementType: StockMovementTypes.VENTA,
      referenceId: params.referenceId,
      referenceTable: "ventas",
      reference: params.reference,
      detail: params.detail,
      unitCost: item.price,
      timestamp: params.timestamp,
    });
    state = result;
    itemsWithAllocations.push({
      ...item,
      lotAllocations: result.allocations,
    });
  }

  return { ...state, itemsWithAllocations };
}

export function transferStock(
  ctx: LedgerContext,
  params: {
    productCode: string;
    productName: string;
    quantity: number;
    fromWarehouseId: string;
    fromWarehouseName: string;
    toWarehouseId: string;
    toWarehouseName: string;
    observation?: string;
  }
): LedgerResult {
  const outbound = consumeOutbound(ctx, {
    productCode: params.productCode,
    productName: params.productName,
    warehouseId: params.fromWarehouseId,
    warehouseName: params.fromWarehouseName,
    quantity: params.quantity,
    movementType: StockMovementTypes.TRASLADO_SALIDA,
    referenceTable: "traslados",
    reference: `${params.fromWarehouseName} → ${params.toWarehouseName}`,
    detail: params.observation || "Traslado entre almacenes",
  });

  if (!outbound.allocations?.length) {
    throw new Error("No se pudo asignar stock para el traslado.");
  }

  let state: LedgerContext = outbound;
  for (const alloc of outbound.allocations) {
    const lot = state.lots.find((l) => l.id === alloc.lotId);
    state = registerInbound(state, {
      productCode: params.productCode,
      productName: params.productName,
      warehouseId: params.toWarehouseId,
      warehouseName: params.toWarehouseName,
      quantity: alloc.quantity,
      movementType: StockMovementTypes.TRASLADO_ENTRADA,
      lotNumber: lot?.lotNumber,
      expiryDate: lot?.expiryDate,
      unitCost: lot?.purchasePrice,
      referenceTable: "traslados",
      reference: `${params.fromWarehouseName} → ${params.toWarehouseName}`,
      detail: params.observation || "Traslado entre almacenes",
    });
  }

  return state;
}

/** Reconstruye movimientos desde historial si la BD no tiene ledger (migración). */
export function migrateMovementsFromHistory(
  purchases: StockPurchase[],
  sales: import("../components/ReceiptPrinter").Sale[],
  products: Product[]
): StockMovement[] {
  const movements: StockMovement[] = [];
  const stockMap = new Map<string, number>();

  const events: Array<{
    timestamp: string;
    productCode: string;
    productName: string;
    type: StockMovementType;
    qty: number;
    reference?: string;
    detail?: string;
    unitCost?: number;
    warehouseId?: string;
    warehouseName?: string;
  }> = [];

  for (const purchase of purchases) {
    for (const item of purchase.items) {
      events.push({
        timestamp: purchase.timestamp,
        productCode: item.productCode,
        productName: item.productName,
        type: StockMovementTypes.COMPRA,
        qty: item.quantity,
        reference: purchase.documentRef,
        detail: `${purchase.supplierName} · ${purchase.paymentCondition}`,
        unitCost: item.unitCost,
        warehouseId: purchase.warehouseId,
        warehouseName: purchase.warehouse,
      });
    }
  }

  for (const sale of sales) {
    sale.items.forEach((item) => {
      events.push({
        timestamp: sale.timestamp,
        productCode: item.code,
        productName: item.name,
        type: StockMovementTypes.VENTA,
        qty: -item.quantity,
        reference: sale.documentNumber || sale.id,
        detail: `${sale.paymentMethod} · ${sale.documentType === "boleta" ? "Boleta" : "Ticket"}`,
        unitCost: item.price,
      });
    });
  }

  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  for (const ev of events) {
    const before = stockMap.get(ev.productCode) ?? 0;
    const after = before + ev.qty;
    stockMap.set(ev.productCode, after);
    const name = ev.productName || products.find((p) => p.code === ev.productCode)?.name || ev.productCode;

    movements.push({
      id: movementId("mig"),
      timestamp: ev.timestamp,
      productCode: ev.productCode,
      productName: name,
      type: ev.type,
      quantity: ev.qty,
      stockBefore: before,
      stockAfter: after,
      warehouseId: ev.warehouseId,
      warehouseName: ev.warehouseName,
      reference: ev.reference,
      detail: ev.detail,
      unitCost: ev.unitCost,
      channel: "pos",
    });
  }

  return movements;
}