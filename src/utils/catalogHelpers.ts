import type { Product } from "../App";
import type { Lot } from "../App";
import type { Supplier, StockPurchase } from "../types/stock";
import type { Category, StorageLocation, Warehouse } from "../types/catalog";
import {
  DEFAULT_CATEGORIES,
  DEFAULT_LOCATIONS,
  DEFAULT_WAREHOUSE_SEEDS,
} from "../types/catalog";

const now = () => new Date().toISOString();

export function sanitizeCatalogDisplayName(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeCatalogName(value: unknown): string {
  return sanitizeCatalogDisplayName(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function buildCatalogSlug(value: string): string {
  return sanitizeCatalogDisplayName(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function stampCategory(seed: Omit<Category, "createdAt" | "updatedAt">): Category {
  const ts = now();
  return { ...seed, createdAt: ts, updatedAt: ts };
}

export function stampWarehouse(seed: Omit<Warehouse, "createdAt" | "updatedAt">): Warehouse {
  const ts = now();
  return { ...seed, createdAt: ts, updatedAt: ts };
}

export function stampLocation(seed: Omit<StorageLocation, "createdAt" | "updatedAt">): StorageLocation {
  const ts = now();
  return { ...seed, createdAt: ts, updatedAt: ts };
}

export function buildDefaultCategories(): Category[] {
  return DEFAULT_CATEGORIES.map(stampCategory);
}

export function buildDefaultWarehouses(): Warehouse[] {
  return DEFAULT_WAREHOUSE_SEEDS.map(stampWarehouse);
}

export function buildDefaultLocations(): StorageLocation[] {
  return DEFAULT_LOCATIONS.map(stampLocation);
}

export function findCategoryDuplicate(
  categories: Category[],
  name: string,
  excludeId?: string
): Category | undefined {
  const target = normalizeCatalogName(name);
  return categories.find(
    (c) => c.id !== excludeId && normalizeCatalogName(c.name) === target
  );
}

export function findWarehouseDuplicate(
  warehouses: Warehouse[],
  name: string,
  excludeId?: string
): Warehouse | undefined {
  const target = normalizeCatalogName(name);
  return warehouses.find(
    (w) => w.id !== excludeId && normalizeCatalogName(w.name) === target
  );
}

export function findSupplierDuplicate(
  suppliers: Supplier[],
  name: string,
  excludeId?: string
): Supplier | undefined {
  const target = normalizeCatalogName(name);
  return suppliers.find(
    (s) => s.id !== excludeId && normalizeCatalogName(s.name) === target
  );
}

/** Revive categoría duplicada (lógica SalusJVJ) o crea nueva. */
export function upsertCategory(
  categories: Category[],
  input: { name: string; description?: string; sortOrder?: number }
): { categories: Category[]; category: Category; revived: boolean } {
  const name = sanitizeCatalogDisplayName(input.name);
  if (!name) throw new Error("El nombre de categoría es obligatorio.");

  const duplicate = findCategoryDuplicate(categories, name);
  const ts = now();

  if (duplicate) {
    const revived: Category = {
      ...duplicate,
      name,
      slug: buildCatalogSlug(name),
      description: input.description ?? duplicate.description,
      sortOrder: input.sortOrder ?? duplicate.sortOrder,
      active: true,
      updatedAt: ts,
    };
    return {
      categories: categories.map((c) => (c.id === duplicate.id ? revived : c)),
      category: revived,
      revived: true,
    };
  }

  const created: Category = {
    id: `cat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    slug: buildCatalogSlug(name),
    description: input.description,
    sortOrder: input.sortOrder ?? categories.length,
    active: true,
    createdAt: ts,
    updatedAt: ts,
  };
  return { categories: [...categories, created], category: created, revived: false };
}

export function updateCategory(
  categories: Category[],
  id: string,
  patch: Partial<Pick<Category, "name" | "description" | "sortOrder" | "active">>
): Category[] {
  const current = categories.find((c) => c.id === id);
  if (!current) throw new Error("Categoría no encontrada.");

  if (patch.name) {
    const name = sanitizeCatalogDisplayName(patch.name);
    const dup = findCategoryDuplicate(categories, name, id);
    if (dup) throw new Error(`Ya existe la categoría "${dup.name}".`);
    return categories.map((c) =>
      c.id === id
        ? {
            ...c,
            ...patch,
            name,
            slug: buildCatalogSlug(name),
            updatedAt: now(),
          }
        : c
    );
  }

  return categories.map((c) =>
    c.id === id ? { ...c, ...patch, updatedAt: now() } : c
  );
}

/** Fusiona categorías duplicadas y reasigna productos (SalusJVJ merge). */
export function mergeCategories(
  categories: Category[],
  products: Product[],
  targetId: string,
  sourceIds: string[],
  patch?: Partial<Pick<Category, "name" | "description" | "sortOrder">>
): { categories: Category[]; products: Product[]; target: Category } {
  const target = categories.find((c) => c.id === targetId);
  if (!target) throw new Error("Categoría destino no encontrada.");

  const sources = categories.filter((c) => sourceIds.includes(c.id));
  if (sources.length === 0) throw new Error("Seleccione categorías a fusionar.");

  const targetName = patch?.name ? sanitizeCatalogDisplayName(patch.name) : target.name;
  const mergedTarget: Category = {
    ...target,
    ...patch,
    name: targetName,
    slug: buildCatalogSlug(targetName),
    updatedAt: now(),
  };

  const sourceNames = new Set(sources.map((s) => s.name));
  const updatedProducts = products.map((p) =>
    sourceNames.has(p.category) ? { ...p, category: mergedTarget.name } : p
  );

  const remaining = categories
    .filter((c) => !sourceIds.includes(c.id) || c.id === targetId)
    .map((c) => (c.id === targetId ? mergedTarget : c));

  return { categories: remaining, products: updatedProducts, target: mergedTarget };
}

export function deleteCategory(
  categories: Category[],
  products: Product[],
  id: string
): { categories: Category[]; products: Product[] } {
  const fallback = categories.find((c) => c.active && c.id !== id)?.name || "General";
  return {
    categories: categories.filter((c) => c.id !== id),
    products: products.map((p) => {
      const cat = categories.find((c) => c.id === id);
      return cat && p.category === cat.name ? { ...p, category: fallback } : p;
    }),
  };
}

export function upsertWarehouse(
  warehouses: Warehouse[],
  input: { name: string; address?: string; notes?: string; isDefault?: boolean }
): { warehouses: Warehouse[]; warehouse: Warehouse; revived: boolean } {
  const name = sanitizeCatalogDisplayName(input.name);
  if (!name) throw new Error("El nombre del almacén es obligatorio.");

  const duplicate = findWarehouseDuplicate(warehouses, name);
  const ts = now();

  if (duplicate) {
    const revived: Warehouse = {
      ...duplicate,
      name,
      address: input.address ?? duplicate.address,
      notes: input.notes ?? duplicate.notes,
      active: true,
      updatedAt: ts,
    };
    let next = warehouses.map((w) => (w.id === duplicate.id ? revived : w));
    if (input.isDefault) {
      next = next.map((w) => ({ ...w, isDefault: w.id === revived.id }));
    }
    return { warehouses: next, warehouse: revived, revived: true };
  }

  const created: Warehouse = {
    id: `wh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    address: input.address,
    notes: input.notes,
    isDefault: input.isDefault ?? warehouses.length === 0,
    active: true,
    createdAt: ts,
    updatedAt: ts,
  };

  let next = [...warehouses, created];
  if (created.isDefault) {
    next = next.map((w) => ({ ...w, isDefault: w.id === created.id }));
  }
  return { warehouses: next, warehouse: created, revived: false };
}

export function deleteWarehouse(
  warehouses: Warehouse[],
  lots: Lot[],
  id: string
): Warehouse[] {
  const target = warehouses.find((w) => w.id === id);
  if (!target) throw new Error("Almacén no encontrado.");
  if (target.isDefault && warehouses.filter((w) => w.active).length <= 1) {
    throw new Error("No puede eliminar el único almacén activo.");
  }
  const stockInWh = lots.filter((l) => l.warehouseId === id && l.stock > 0);
  if (stockInWh.length > 0) {
    throw new Error(`Hay ${stockInWh.length} lote(s) con stock en este almacén.`);
  }
  return warehouses.filter((w) => w.id !== id);
}

export function normalizeWarehouseDefaults(warehouses: Warehouse[]): Warehouse[] {
  if (!warehouses.length) return warehouses;

  const active = warehouses.filter((w) => w.active);
  const defaultCandidates = warehouses.filter((w) => w.isDefault);
  const keepId =
    defaultCandidates.find((w) => w.active)?.id ||
    active[0]?.id ||
    warehouses[0]?.id;

  if (!keepId) return warehouses;

  const needsFix =
    defaultCandidates.length !== 1 ||
    !defaultCandidates[0]?.active ||
    defaultCandidates[0]?.id !== keepId;

  if (!needsFix) return warehouses;

  return warehouses.map((w) => ({ ...w, isDefault: w.id === keepId }));
}

export function getDefaultWarehouse(warehouses: Warehouse[]): Warehouse | undefined {
  const normalized = normalizeWarehouseDefaults(warehouses);
  return normalized.find((w) => w.active && w.isDefault) || normalized.find((w) => w.active);
}

const SEED_WAREHOUSE_I18N_KEYS: Record<string, string> = {
  wh_principal: "warehouses.seedMain",
  wh_secundario: "warehouses.seedSecondary",
};

const LEGACY_WAREHOUSE_NAME_KEYS: Record<string, string> = {
  principal: "warehouses.seedMain",
  "almacen secundario": "warehouses.seedSecondary",
};

type WarehouseTranslator = (key: string) => string;

export function localizeWarehouseLegacyName(legacyName: string, t: WarehouseTranslator): string {
  const key = LEGACY_WAREHOUSE_NAME_KEYS[normalizeCatalogName(legacyName)];
  return key ? t(key) : legacyName;
}

export function getLocalizedWarehouseName(
  warehouse: Pick<Warehouse, "id" | "name"> | undefined,
  t: WarehouseTranslator,
  fallbackKey = "inventory.defaultWarehouse"
): string {
  if (!warehouse) return t(fallbackKey);
  const seedKey = SEED_WAREHOUSE_I18N_KEYS[warehouse.id];
  if (seedKey) return t(seedKey);
  const legacyKey = LEGACY_WAREHOUSE_NAME_KEYS[normalizeCatalogName(warehouse.name)];
  if (legacyKey) return t(legacyKey);
  return warehouse.name;
}

export function getLocalizedWarehouseNameById(
  warehouses: Warehouse[],
  warehouseId: string | undefined,
  t: WarehouseTranslator,
  legacyName?: string
): string {
  const wh = warehouseId ? warehouses.find((w) => w.id === warehouseId) : undefined;
  if (wh) return getLocalizedWarehouseName(wh, t);
  if (legacyName) return localizeWarehouseLegacyName(legacyName, t);
  return getLocalizedWarehouseName(getDefaultWarehouse(warehouses), t);
}

export function getWarehouseOptionHint(warehouse: Warehouse, t: WarehouseTranslator): string | undefined {
  if (warehouse.isDefault) return t("warehouses.primaryHint");
  return warehouse.address || t("warehouses.secondaryHint");
}

export function resolveWarehouseName(warehouses: Warehouse[], warehouseId?: string, legacyName?: string): string {
  if (warehouseId) {
    return warehouses.find((w) => w.id === warehouseId)?.name || legacyName || "Principal";
  }
  return legacyName || getDefaultWarehouse(warehouses)?.name || "Principal";
}

export function resolveWarehouseId(
  warehouses: Warehouse[],
  warehouseId?: string,
  legacyName?: string
): string | undefined {
  if (warehouseId) return warehouseId;
  if (legacyName) {
    const match = warehouses.find((w) => normalizeCatalogName(w.name) === normalizeCatalogName(legacyName));
    if (match) return match.id;
  }
  return getDefaultWarehouse(warehouses)?.id;
}

/** Deriva categorías desde productos existentes + semillas del catálogo por defecto. */
export function migrateCategoriesFromProducts(
  products: Product[],
  existing: Category[] | undefined
): Category[] {
  if (existing?.length) return existing;

  const seeded = buildDefaultCategories();
  const known = new Set(seeded.map((c) => normalizeCatalogName(c.name)));

  products.forEach((p) => {
    const name = sanitizeCatalogDisplayName(p.category || "General") || "General";
    if (!known.has(normalizeCatalogName(name))) {
      known.add(normalizeCatalogName(name));
      seeded.push(
        stampCategory({
          id: `cat_mig_${buildCatalogSlug(name)}`,
          name,
          slug: buildCatalogSlug(name),
          sortOrder: seeded.length,
          active: true,
        })
      );
    }
  });

  return seeded.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function migrateWarehousesFromLegacy(
  existing: Warehouse[] | undefined,
  purchases: StockPurchase[]
): Warehouse[] {
  if (existing?.length) return normalizeWarehouseDefaults(existing);

  const seeded = buildDefaultWarehouses();
  const known = new Set(seeded.map((w) => normalizeCatalogName(w.name)));

  purchases.forEach((p) => {
    const name = sanitizeCatalogDisplayName(p.warehouse);
    if (name && !known.has(normalizeCatalogName(name))) {
      known.add(normalizeCatalogName(name));
      seeded.push(
        stampWarehouse({
          id: `wh_mig_${buildCatalogSlug(name)}`,
          name,
          isDefault: false,
          active: true,
        })
      );
    }
  });

  return seeded;
}

export function assignDefaultWarehouseToLots(
  lots: Lot[],
  warehouses: Warehouse[]
): Lot[] {
  const defaultId = getDefaultWarehouse(warehouses)?.id;
  if (!defaultId) return lots;
  return lots.map((l) => (l.warehouseId ? l : { ...l, warehouseId: defaultId }));
}

export function getActiveCategoryNames(categories: Category[]): string[] {
  return categories
    .filter((c) => c.active)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map((c) => c.name);
}

export function extendLegacySupplier(s: Supplier): Supplier {
  return {
    email: "",
    contact: "",
    address: "",
    notes: "",
    ...s,
    active: s.active ?? true,
  };
}