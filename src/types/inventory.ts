/** Ledger de inventario — modelo inspirado en SalusJVJ (sin reservas web). */

export const StockMovementTypes = {
  COMPRA: "COMPRA",
  VENTA: "VENTA",
  AJUSTE_ENTRADA: "AJUSTE_ENTRADA",
  AJUSTE_SALIDA: "AJUSTE_SALIDA",
  TRASLADO_ENTRADA: "TRASLADO_ENTRADA",
  TRASLADO_SALIDA: "TRASLADO_SALIDA",
  DEVOLUCION_CLIENTE: "DEVOLUCION_CLIENTE",
  DEVOLUCION_PROVEEDOR: "DEVOLUCION_PROVEEDOR",
} as const;

export type StockMovementType = (typeof StockMovementTypes)[keyof typeof StockMovementTypes];

export interface LotAllocation {
  lotId: string;
  lotNumber: string;
  warehouseId: string;
  quantity: number;
  unitCost?: number;
}

export interface StockMovement {
  id: string;
  timestamp: string;
  productCode: string;
  productName: string;
  type: StockMovementType;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  warehouseId?: string;
  warehouseName?: string;
  lotId?: string;
  lotNumber?: string;
  referenceId?: string;
  referenceTable?: string;
  reference?: string;
  detail?: string;
  unitCost?: number;
  channel: "pos";
}

export interface Manufacturer {
  id: string;
  name: string;
  ruc?: string;
  contact?: string;
  phone?: string;
  email?: string;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_MANUFACTURERS: Omit<Manufacturer, "createdAt" | "updatedAt">[] = [
  { id: "mfg_gloria", name: "Gloria", active: true },
  { id: "mfg_alicorp", name: "Alicorp", active: true },
  { id: "mfg_nestle", name: "Nestlé", active: true },
];

export const INBOUND_TYPES: StockMovementType[] = [
  StockMovementTypes.COMPRA,
  StockMovementTypes.AJUSTE_ENTRADA,
  StockMovementTypes.TRASLADO_ENTRADA,
  StockMovementTypes.DEVOLUCION_CLIENTE,
];

export const OUTBOUND_TYPES: StockMovementType[] = [
  StockMovementTypes.VENTA,
  StockMovementTypes.AJUSTE_SALIDA,
  StockMovementTypes.TRASLADO_SALIDA,
  StockMovementTypes.DEVOLUCION_PROVEEDOR,
];

export function isInboundMovement(type: StockMovementType): boolean {
  return INBOUND_TYPES.includes(type);
}