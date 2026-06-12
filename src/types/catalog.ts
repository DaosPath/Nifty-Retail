/** Catálogo maestro — modelo inspirado en SalusJVJ (categorías, proveedores, almacenes). */

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Warehouse {
  id: string;
  name: string;
  address?: string;
  notes?: string;
  isDefault: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StorageLocation {
  id: string;
  name: string;
  slug: string;
  description?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CatalogTab = "categorias" | "proveedores" | "almacenes" | "ubicaciones" | "fabricantes";

export const DEFAULT_CATEGORIES: Omit<Category, "createdAt" | "updatedAt">[] = [
  { id: "cat_general", name: "General", slug: "general", sortOrder: 0, active: true },
  { id: "cat_abarrotes", name: "Abarrotes", slug: "abarrotes", sortOrder: 1, active: true },
  { id: "cat_bebidas", name: "Bebidas", slug: "bebidas", sortOrder: 2, active: true },
  { id: "cat_lacteos", name: "Lácteos", slug: "lacteos", sortOrder: 3, active: true },
  { id: "cat_limpieza", name: "Limpieza", slug: "limpieza", sortOrder: 4, active: true },
  { id: "cat_snacks", name: "Snacks", slug: "snacks", sortOrder: 5, active: true },
  { id: "cat_cuidado", name: "Cuidado Personal", slug: "cuidado-personal", sortOrder: 6, active: true },
  { id: "cat_analgesicos", name: "Analgésicos", slug: "analgesicos", sortOrder: 7, active: true },
  { id: "cat_vitaminas", name: "Vitaminas", slug: "vitaminas", sortOrder: 8, active: true },
  { id: "cat_antialergicos", name: "Antialergicos", slug: "antialergicos", sortOrder: 9, active: true },
  { id: "cat_respiratorio", name: "Respiratorio", slug: "respiratorio", sortOrder: 10, active: true },
];

export const DEFAULT_WAREHOUSE_SEEDS: Omit<Warehouse, "createdAt" | "updatedAt">[] = [
  { id: "wh_principal", name: "Principal", address: "", isDefault: true, active: true },
  { id: "wh_secundario", name: "Almacén Secundario", active: true, isDefault: false },
];

export const DEFAULT_LOCATIONS: Omit<StorageLocation, "createdAt" | "updatedAt">[] = [
  { id: "loc_a1", name: "Estante A1", slug: "estante-a1", active: true },
  { id: "loc_a2", name: "Estante A2", slug: "estante-a2", active: true },
  { id: "loc_b1", name: "Vitrina B1", slug: "vitrina-b1", active: true },
  { id: "loc_c1", name: "Estante C1", slug: "estante-c1", active: true },
];