export interface Supplier {
  id: string;
  name: string;
  ruc?: string;
  phone?: string;
  email?: string;
  contact?: string;
  address?: string;
  notes?: string;
  active?: boolean;
}

export type PurchaseDocType = "FACTURA" | "BOLETA" | "GUIA" | "OTRO";
export type PurchasePaymentCondition = "contado" | "credito";
export type PurchasePaymentMethod = "Efectivo" | "Yape" | "Tarjeta" | "Transferencia";

export interface PurchaseLine {
  productCode: string;
  productName: string;
  quantity: number;
  unitCost: number;
  expiryDate: string;
  lotNumber?: string;
}

export interface StockPurchase {
  id: string;
  timestamp: string;
  supplierId: string;
  supplierName: string;
  docType: PurchaseDocType;
  warehouse: string;
  warehouseId?: string;
  series: string;
  correlativo: string;
  documentRef: string;
  paymentCondition: PurchasePaymentCondition;
  paymentMethod?: PurchasePaymentMethod;
  items: PurchaseLine[];
  total: number;
  paidToday: number;
  sessionId?: string;
}

export interface SupplierDebtHistoryEntry {
  id: string;
  date: string;
  amount: number;
  type: "purchase" | "payment";
  notes?: string;
  purchaseId?: string;
}

export interface SupplierDebt {
  id: string;
  supplierId: string;
  supplierName: string;
  totalDebt: number;
  history: SupplierDebtHistoryEntry[];
}

import type { StockMovementType } from "./inventory";

export type KardexMovementType = StockMovementType;

export interface KardexRow {
  id: string;
  timestamp: string;
  type: KardexMovementType;
  reference: string;
  detail: string;
  entrada: number;
  salida: number;
  unitCost?: number;
  balance: number;
  warehouseId?: string;
  warehouseName?: string;
  lotNumber?: string;
}

/** @deprecated Usar entidades Warehouse desde types/catalog.ts */
export const DEFAULT_WAREHOUSES = ["Principal", "Almacén Secundario"];

export const DEFAULT_SUPPLIERS: Supplier[] = [
  { id: "sup_demo", name: "Proveedor Demo", ruc: "20123456789", active: true },
  { id: "sup_distribuidora", name: "DISTRIBUIDORA GENERAL", active: true },
  { id: "sup_local", name: "PROVEEDOR LOCAL", active: true },
];