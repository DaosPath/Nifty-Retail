import { lazy, Suspense, useState, useEffect, useMemo, type ComponentType } from "react";
import {
  DEFAULT_LOCALE,
  getTranslator,
  I18nProvider,
  LOCALE_STORAGE_KEY,
  normalizeLocale,
  type AppLocale,
} from "./i18n";
import { generateSampleCatalog } from "./utils/sampleCatalog";
import { createDefaultStoreConfig, mergeStoreConfig } from "./utils/defaultStoreConfig";
import { MoneyProvider } from "./hooks/useMoney";
import {
  formatCurrency,
  normalizeCurrency,
  type CurrencyCode,
} from "./utils/currency";
import { invoke } from "@tauri-apps/api/core";
import {
  installDbLifecycleGuards,
  parseDbContent,
  queueDbSave,
  recoveryBannerMessage,
  registerDbSaveInvoker,
  serializeDbPayload,
  type LoadDbResponse,
  type SaveDbResponse,
} from "./utils/dbPersistence";
import { POS } from "./components/POS";
import { Inventory } from "./components/Inventory";
import { Alerts } from "./components/Alerts";
import { CashControl } from "./components/CashControl";

import { ReceiptPrinter, type Sale } from "./components/ReceiptPrinter";
import { Debts, type CustomerDebt } from "./components/Debts";
import { ErrorBoundary } from "./components/ErrorBoundary";

import { Settings } from "./components/Settings";
import { SalesHistory } from "./components/SalesHistory";
import { StockEntry } from "./components/StockEntry";
import { Kardex } from "./components/Kardex";
import { CatalogPage } from "./components/CatalogPage";
import { AI_WIDGET_ACTION_EVENT, resolveAppTab, type WidgetActionDetail } from "./features/ai-chat";
import { buildProductByCodeMap, countInventoryAlerts } from "./utils/performanceMaps";

const Reports = lazy(() => import("./components/Reports").then((module) => ({ default: module.Reports })));
const AiChat = lazy(() => import("./components/AiChat").then((module) => ({ default: module.AiChat })));
import {
  migrateSalesSessionIds,
  recalculateSession,
  getSessionSales,
  restoreStockFromItems,
  deductStockFromItems,
  type CashSession as CashSessionType,
} from "./utils/cashSales";
import type { Manufacturer, StockMovement } from "./types/inventory";
import { DEFAULT_MANUFACTURERS, StockMovementTypes } from "./types/inventory";
import {
  applyStockAdjustment,
  deductSaleItems,
  buildWarehouseStockMap,
  migrateMovementsFromHistory,
  registerInbound,
  transferStock,
} from "./utils/inventoryLedger";
import { formatDocumentNumber } from "./utils/documents";
import { emitSunatBoleta } from "./utils/sunat/emitBoleta";
import {
  DEFAULT_SUPPLIERS,
  type PurchaseLine,
  type StockPurchase,
  type Supplier,
  type SupplierDebt,
} from "./types/stock";
import type { Category, StorageLocation, Warehouse } from "./types/catalog";
import type { StoreConfig } from "./types/store";
import {
  assignDefaultWarehouseToLots,
  buildDefaultLocations,
  deleteCategory,
  deleteWarehouse,
  extendLegacySupplier,
  findSupplierDuplicate,
  getDefaultWarehouse,
  mergeCategories,
  migrateCategoriesFromProducts,
  migrateWarehousesFromLegacy,
  normalizeWarehouseDefaults,
  resolveWarehouseId,
  resolveWarehouseName,
  sanitizeCatalogDisplayName,
  stampLocation,
  updateCategory,
  upsertCategory,
  upsertWarehouse,
  buildCatalogSlug,
} from "./utils/catalogHelpers";
import {
  calculateSaleTax,
  normalizeTaxConfig,
  resolveTaxConfig,
} from "./utils/tax";
import { 
  LogoIcon,
  CartIcon, 
  BoxIcon, 
  AlertIcon, 
  KeyIcon, 
  ChartIcon, 
  CashIcon,
  MessageIcon,
  SettingsIcon,
  HistoryIcon,
  PackagePlusIcon,
  LayersIcon,
  UserIcon,
  ScannerIcon,
} from "./components/Icons";
import "./App.css";

type AppTab =
  | "pos"
  | "inventory"
  | "catalog"
  | "stock-entry"
  | "kardex"
  | "alerts"
  | "cash"
  | "sales-history"
  | "reports"
  | "debts"
  | "ai-chat"
  | "settings";

type SidebarIcon = ComponentType<{ size?: number; className?: string }>;

const SIDEBAR_SECTIONS: { sectionKey: string; items: { tab: AppTab; icon: SidebarIcon; labelKey: string }[] }[] = [
  {
    sectionKey: "sidebar.sections.sales",
    items: [{ tab: "pos", icon: CartIcon, labelKey: "nav.pos" }],
  },
  {
    sectionKey: "sidebar.sections.inventory",
    items: [
      { tab: "inventory", icon: BoxIcon, labelKey: "nav.inventory" },
      { tab: "catalog", icon: LayersIcon, labelKey: "nav.catalog" },
      { tab: "stock-entry", icon: PackagePlusIcon, labelKey: "nav.stockEntry" },
      { tab: "kardex", icon: LayersIcon, labelKey: "nav.kardex" },
      { tab: "alerts", icon: AlertIcon, labelKey: "nav.alerts" },
    ],
  },
  {
    sectionKey: "sidebar.sections.finance",
    items: [
      { tab: "cash", icon: KeyIcon, labelKey: "nav.cash" },
      { tab: "sales-history", icon: HistoryIcon, labelKey: "nav.salesHistory" },
      { tab: "debts", icon: CashIcon, labelKey: "nav.debts" },
    ],
  },
  {
    sectionKey: "sidebar.sections.intelligence",
    items: [
      { tab: "ai-chat", icon: MessageIcon, labelKey: "nav.aiChat" },
      { tab: "reports", icon: ChartIcon, labelKey: "nav.reports" },
    ],
  },
  {
    sectionKey: "sidebar.sections.system",
    items: [{ tab: "settings", icon: SettingsIcon, labelKey: "nav.settings" }],
  },
];

const TAB_HEADER_ICONS: Record<AppTab, SidebarIcon> = {
  pos: CartIcon,
  inventory: BoxIcon,
  catalog: LayersIcon,
  "stock-entry": PackagePlusIcon,
  kardex: LayersIcon,
  alerts: AlertIcon,
  cash: KeyIcon,
  "sales-history": HistoryIcon,
  debts: CashIcon,
  "ai-chat": MessageIcon,
  reports: ChartIcon,
  settings: SettingsIcon,
};

export interface Product {
  code: string;
  name: string;
  category: string;
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
  minStock: number;
  expiryDate?: string;
  image?: string;
  manufacturerId?: string;
  manufacturer?: string;
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

export type { StoreConfig } from "./types/store";

const THEME_STORAGE_KEY = "niftypos-theme";

function applyTheme(theme: "dark" | "light") {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.backgroundColor = theme === "light" ? "#eef1f6" : "#0f0f12";
  document.documentElement.style.colorScheme = theme;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

type CashSession = CashSessionType;

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [cashSessions, setCashSessions] = useState<CashSession[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [debts, setDebts] = useState<CustomerDebt[]>([]);
  const [storeConfig, setStoreConfig] = useState<StoreConfig>(() =>
    createDefaultStoreConfig(DEFAULT_LOCALE, "dark")
  );
  
  const [activeTab, setActiveTab] = useState<AppTab>("pos");
  const [suppliers, setSuppliers] = useState<Supplier[]>(DEFAULT_SUPPLIERS.map(extendLegacySupplier));
  const [categories, setCategories] = useState<Category[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [stockPurchases, setStockPurchases] = useState<StockPurchase[]>([]);
  const [supplierDebts, setSupplierDebts] = useState<SupplierDebt[]>([]);
  const [activeSession, setActiveSession] = useState<CashSession | null>(null);
  const [editSessionId, setEditSessionId] = useState<string | null>(null);
  const [lastCheckoutSale, setLastCheckoutSale] = useState<Sale | null>(null);
  const [dbRecoveryMessage, setDbRecoveryMessage] = useState<string | null>(null);
  const [dbLoadError, setDbLoadError] = useState<string | null>(null);

  const triggerReceiptPrint = (sale: Sale) => {
    setLastCheckoutSale(sale);
    const delay = sale.documentType === "boleta" ? 500 : 200;
    setTimeout(() => {
      window.print();
    }, delay);
  };
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" ? "light" : "dark";
  });
  const [locale, setLocale] = useState<AppLocale>(() => {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    return normalizeLocale(stored);
  });
  const t = useMemo(() => getTranslator(locale), [locale]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, [locale]);

  useEffect(() => {
    const onWidgetAction = (event: Event) => {
      const detail = (event as CustomEvent<WidgetActionDetail>).detail;
      if (!detail || detail.action !== "navigate") return;
      setActiveTab(resolveAppTab(detail.value));
    };

    window.addEventListener(AI_WIDGET_ACTION_EVENT, onWidgetAction);
    return () => window.removeEventListener(AI_WIDGET_ACTION_EVENT, onWidgetAction);
  }, []);

  useEffect(() => {
    registerDbSaveInvoker(async (data) => invoke<SaveDbResponse>("save_db", { data }));
    installDbLifecycleGuards();
  }, []);

  // Load database on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const loadResponse = await invoke<LoadDbResponse>("load_db");
        const recoveryMsg = recoveryBannerMessage(loadResponse);
        if (recoveryMsg) setDbRecoveryMessage(recoveryMsg);
        const db = parseDbContent(loadResponse.content);

        const loadedProducts: Product[] = (db.products as Product[]) || [];
        const loadedSales: Sale[] = (db.sales as Sale[]) || [];
        const loadedSessions: CashSession[] = (db.cashSessions as CashSession[]) || [];
        let loadedLots: Lot[] = (db.lots as Lot[]) || [];
        const loadedDebts: CustomerDebt[] = (db.debts as CustomerDebt[]) || [];
        const loadedStoreConfig = mergeStoreConfig(
          (db.storeConfig as Partial<StoreConfig>) || undefined
        );

        // Apply persisted theme (or default dark)
        const loadedTheme = loadedStoreConfig.theme || "dark";
        setTheme(loadedTheme);
        applyTheme(loadedTheme);

        const loadedLocale = normalizeLocale(loadedStoreConfig.language);
        setLocale(loadedLocale);
        loadedStoreConfig.language = loadedLocale;
        loadedStoreConfig.tax = normalizeTaxConfig(loadedStoreConfig.tax, loadedLocale);
        loadedStoreConfig.currency = normalizeCurrency(loadedStoreConfig.currency, loadedLocale);

        // Migration logic for lot batches: If no lots exist but products do, generate default lots
        if (loadedLots.length === 0 && loadedProducts.length > 0) {
          loadedLots = loadedProducts.map((p, idx) => ({
            id: `lot_migration_${p.code}_${Date.now()}_${idx}`,
            productCode: p.code,
            lotNumber: "LOTE-MIG",
            purchasePrice: p.purchasePrice,
            initialQty: p.stock,
            stock: p.stock,
            expiryDate: p.expiryDate || new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
            createdAt: new Date().toISOString()
          }));
        }
        
        const migratedSales = migrateSalesSessionIds(loadedSales, loadedSessions);
        const recalculatedSessions = loadedSessions.map((session) =>
          recalculateSession(session, getSessionSales(migratedSales, session.id, loadedSessions))
        );

        const loadedPurchases: StockPurchase[] = (db.stockPurchases as StockPurchase[]) || [];
        const loadedSuppliers = ((db.suppliers as Supplier[] | undefined)?.length
          ? (db.suppliers as Supplier[])
          : DEFAULT_SUPPLIERS
        ).map(extendLegacySupplier);
        const loadedCategories = migrateCategoriesFromProducts(
          loadedProducts,
          db.categories as Category[] | undefined
        );
        const loadedWarehouses = migrateWarehousesFromLegacy(
          db.warehouses as Warehouse[] | undefined,
          loadedPurchases
        );
        const loadedLocations = (db.locations as StorageLocation[] | undefined)?.length
          ? (db.locations as StorageLocation[])
          : buildDefaultLocations();
        loadedLots = assignDefaultWarehouseToLots(loadedLots, loadedWarehouses);

        const loadedManufacturers: Manufacturer[] = (db.manufacturers as Manufacturer[] | undefined)?.length
          ? (db.manufacturers as Manufacturer[])
          : DEFAULT_MANUFACTURERS.map((m) => ({
              ...m,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }));

        let loadedMovements: StockMovement[] = (db.stockMovements as StockMovement[]) || [];
        if (loadedMovements.length === 0 && (loadedPurchases.length > 0 || migratedSales.length > 0)) {
          loadedMovements = migrateMovementsFromHistory(loadedPurchases, migratedSales, loadedProducts);
        }

        setProducts(loadedProducts);
        setSales(migratedSales);
        setCashSessions(recalculatedSessions);
        setLots(loadedLots);
        setSuppliers(loadedSuppliers);
        setCategories(loadedCategories);
        setWarehouses(loadedWarehouses);
        setLocations(loadedLocations);
        setManufacturers(loadedManufacturers);
        setStockMovements(loadedMovements);
        setStockPurchases(loadedPurchases);
        setSupplierDebts(
          Array.isArray(db.supplierDebts)
            ? (db.supplierDebts as SupplierDebt[]).map((d) => ({
                ...d,
                totalDebt: Number(d.totalDebt) || 0,
                history: Array.isArray(d.history) ? d.history : [],
              }))
            : []
        );
        setDebts(
          Array.isArray(db.debts)
            ? (db.debts as CustomerDebt[]).map((d) => ({
                ...d,
                totalDebt: Number(d.totalDebt) || 0,
                history: Array.isArray(d.history) ? d.history : [],
              }))
            : []
        );
        setStoreConfig(loadedStoreConfig);

        // Find active cash session
        const active = recalculatedSessions.find((s: CashSession) => s.endTime === null) || null;
        setActiveSession(active);

        const salesMigrated = migratedSales.some(
          (s, i) => s.sessionId !== (loadedSales[i]?.sessionId)
        );
        const sessionsRecalced = recalculatedSessions.some(
          (s, i) =>
            s.expectedCash !== loadedSessions[i]?.expectedCash ||
            s.salesCash !== loadedSessions[i]?.salesCash
        );
        const storeConfigChanged =
          loadedStoreConfig.businessName !== (db.storeConfig as Partial<StoreConfig> | undefined)?.businessName ||
          loadedStoreConfig.ruc !== (db.storeConfig as Partial<StoreConfig> | undefined)?.ruc;

        const catalogMigrated =
          !(db.categories as Category[] | undefined)?.length ||
          !(db.warehouses as Warehouse[] | undefined)?.length ||
          !(db.locations as StorageLocation[] | undefined)?.length ||
          !(db.manufacturers as Manufacturer[] | undefined)?.length;
        const ledgerMigrated = !(db.stockMovements as StockMovement[] | undefined)?.length && loadedMovements.length > 0;

        if (salesMigrated || sessionsRecalced || storeConfigChanged || catalogMigrated || ledgerMigrated) {
          await queueDbSave(
            serializeDbPayload({
              products: loadedProducts,
              sales: migratedSales,
              cashSessions: recalculatedSessions,
              lots: loadedLots,
              debts: loadedDebts,
              suppliers: loadedSuppliers,
              categories: loadedCategories,
              warehouses: loadedWarehouses,
              locations: loadedLocations,
              manufacturers: loadedManufacturers,
              stockMovements: loadedMovements,
              stockPurchases: loadedPurchases,
              supplierDebts: (db.supplierDebts as SupplierDebt[]) || [],
              storeConfig: loadedStoreConfig,
            }),
            { immediate: true }
          );
        }
      } catch (err) {
        console.error("Error loading data from Tauri backend:", err);
        setDbLoadError(t("app.dbLoadError"));
      }
    };
    loadData();
  }, []);

  type DbSyncState = {
    products: Product[];
    sales: Sale[];
    cashSessions: CashSession[];
    lots: Lot[];
    debts: CustomerDebt[];
    storeConfig: StoreConfig;
    suppliers: Supplier[];
    stockPurchases: StockPurchase[];
    supplierDebts: SupplierDebt[];
    categories: Category[];
    warehouses: Warehouse[];
    locations: StorageLocation[];
    manufacturers: Manufacturer[];
    stockMovements: StockMovement[];
  };

  type SyncOptions = { immediate?: boolean };

  const buildDbSyncState = (partial: Partial<DbSyncState>): DbSyncState => ({
    products: partial.products ?? products,
    sales: partial.sales ?? sales,
    cashSessions: partial.cashSessions ?? cashSessions,
    lots: partial.lots ?? lots,
    debts: partial.debts ?? debts,
    storeConfig: partial.storeConfig ?? storeConfig,
    suppliers: partial.suppliers ?? suppliers,
    stockPurchases: partial.stockPurchases ?? stockPurchases,
    supplierDebts: partial.supplierDebts ?? supplierDebts,
    categories: partial.categories ?? categories,
    warehouses: partial.warehouses ?? warehouses,
    locations: partial.locations ?? locations,
    manufacturers: partial.manufacturers ?? manufacturers,
    stockMovements: partial.stockMovements ?? stockMovements,
  });

  // Sync state with Tauri SQLite backend (debounced by default)
  const syncWithBackend = async (partial: Partial<DbSyncState>, options?: SyncOptions) => {
    try {
      const snapshot = buildDbSyncState(partial);
      const dataStr = serializeDbPayload({
        products: snapshot.products,
        sales: snapshot.sales,
        cashSessions: snapshot.cashSessions,
        lots: snapshot.lots,
        debts: snapshot.debts,
        suppliers: snapshot.suppliers,
        categories: snapshot.categories,
        warehouses: snapshot.warehouses,
        locations: snapshot.locations,
        manufacturers: snapshot.manufacturers,
        stockMovements: snapshot.stockMovements,
        stockPurchases: snapshot.stockPurchases,
        supplierDebts: snapshot.supplierDebts,
        storeConfig: snapshot.storeConfig,
      });
      await queueDbSave(dataStr, { immediate: options?.immediate });
    } catch (err) {
      console.error("Error saving data to Tauri backend:", err);
      setDbRecoveryMessage(t("app.dbSaveError"));
    }
  };

  // 1. Inventory actions
  const handleAddProduct = (newProd: Product) => {
    const updatedProds = [...products, newProd];
    const updatedLots = [...lots];
    const defaultWhId = getDefaultWarehouse(warehouses)?.id;
    
    // Automatically create a default lot for the new product
    const newLot: Lot = {
      id: `lot_${newProd.code}_${Date.now()}`,
      productCode: newProd.code,
      lotNumber: "LOTE-01",
      purchasePrice: newProd.purchasePrice,
      initialQty: newProd.stock,
      stock: newProd.stock,
      expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      createdAt: new Date().toISOString(),
      warehouseId: defaultWhId,
    };
    updatedLots.push(newLot);
    
    setProducts(updatedProds);
    setLots(updatedLots);
    syncWithBackend({ products: updatedProds, lots: updatedLots });
  };

  const handleEditProduct = (editedProd: Product) => {
    const updatedProds = products.map((p) => (p.code === editedProd.code ? editedProd : p));
    
    // Sync the default lot if it exists and quantity/price changed
    const updatedLots = lots.map((l) => {
      if (l.productCode === editedProd.code && l.lotNumber === "LOTE-01") {
        return {
          ...l,
          purchasePrice: editedProd.purchasePrice,
          stock: editedProd.stock,
        };
      }
      return l;
    });

    setProducts(updatedProds);
    setLots(updatedLots);
    syncWithBackend({ products: updatedProds, lots: updatedLots });
  };

  const handleSaveProductLots = (productCode: string, productLots: Lot[]) => {
    const otherLots = lots.filter((l) => l.productCode !== productCode);
    const updatedLots = [...otherLots, ...productLots];
    setLots(updatedLots);

    const newStock = productLots.reduce((sum, l) => sum + l.stock, 0);
    const updatedProducts = products.map((p) => {
      if (p.code === productCode) {
        const activeLots = productLots.filter((l) => l.stock > 0);
        let earliestExpiry = p.expiryDate;
        if (activeLots.length > 0) {
          earliestExpiry = activeLots.reduce((earliest, curr) => 
            new Date(curr.expiryDate) < new Date(earliest) ? curr.expiryDate : earliest
          , activeLots[0].expiryDate);
        }
        return { ...p, stock: newStock, expiryDate: earliestExpiry };
      }
      return p;
    });
    setProducts(updatedProducts);
    syncWithBackend({ products: updatedProducts, lots: updatedLots });
  };

  const handleDeleteProduct = (code: string) => {
    const updatedProds = products.filter((p) => p.code !== code);
    const updatedLots = lots.filter((l) => l.productCode !== code);
    setProducts(updatedProds);
    setLots(updatedLots);
    syncWithBackend({ products: updatedProds, lots: updatedLots });
  };

  const resolveSalesWarehouse = () => {
    const whId = storeConfig.salesWarehouseId || getDefaultWarehouse(warehouses)?.id;
    const wh = warehouses.find((w) => w.id === whId) || getDefaultWarehouse(warehouses);
    return { id: wh?.id, name: wh?.name || "Principal" };
  };

  const handleQuickAdjustStock = (code: string, newStock: number) => {
    const product = productByCode.get(code);
    if (!product) return;
    const wh = resolveSalesWarehouse();
    try {
      const result = applyStockAdjustment(
        { products, lots, movements: stockMovements },
        {
          productCode: code,
          productName: product.name,
          newStock,
          warehouseId: wh.id,
          warehouseName: wh.name,
          observation: "Ajuste rápido desde alertas",
        }
      );
      setProducts(result.products);
      setLots(result.lots);
      setStockMovements(result.movements);
      syncWithBackend({ products: result.products, lots: result.lots, stockMovements: result.movements });
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleTransferStock = (payload: {
    productCode: string;
    quantity: number;
    fromWarehouseId: string;
    toWarehouseId: string;
    observation?: string;
  }) => {
    const product = products.find((p) => p.code === payload.productCode);
    if (!product) throw new Error("Producto no encontrado.");
    const fromWh = warehouses.find((w) => w.id === payload.fromWarehouseId);
    const toWh = warehouses.find((w) => w.id === payload.toWarehouseId);
    if (!fromWh || !toWh) throw new Error("Almacén inválido.");

    const result = transferStock(
      { products, lots, movements: stockMovements },
      {
        productCode: product.code,
        productName: product.name,
        quantity: payload.quantity,
        fromWarehouseId: fromWh.id,
        fromWarehouseName: fromWh.name,
        toWarehouseId: toWh.id,
        toWarehouseName: toWh.name,
        observation: payload.observation,
      }
    );
    setProducts(result.products);
    setLots(result.lots);
    setStockMovements(result.movements);
    syncWithBackend({ products: result.products, lots: result.lots, stockMovements: result.movements });
  };

  const persistCatalog = (
    nextCategories = categories,
    nextWarehouses = warehouses,
    nextLocations = locations,
    nextSuppliers = suppliers,
    nextProducts = products
  ) => {
    setCategories(nextCategories);
    setWarehouses(nextWarehouses);
    setLocations(nextLocations);
    setSuppliers(nextSuppliers);
    if (nextProducts !== products) setProducts(nextProducts);
    syncWithBackend({
      products: nextProducts,
      suppliers: nextSuppliers,
      categories: nextCategories,
      warehouses: nextWarehouses,
      locations: nextLocations,
    });
  };

  const handleSaveCategory = (input: { id?: string; name: string; description?: string; sortOrder?: number; active?: boolean }) => {
    if (input.id) {
      const updated = updateCategory(categories, input.id, input);
      persistCatalog(updated);
      return;
    }
    const { categories: updated } = upsertCategory(categories, input);
    persistCatalog(updated);
  };

  const handleDeleteCategory = (id: string) => {
    const { categories: nextCats, products: nextProds } = deleteCategory(categories, products, id);
    setProducts(nextProds);
    persistCatalog(nextCats, warehouses, locations, suppliers, nextProds);
  };

  const handleMergeCategories = (targetId: string, sourceIds: string[]) => {
    const { categories: nextCats, products: nextProds } = mergeCategories(categories, products, targetId, sourceIds);
    setProducts(nextProds);
    persistCatalog(nextCats, warehouses, locations, suppliers, nextProds);
  };

  const handleSaveSupplierCatalog = (input: Partial<Supplier> & { name: string }) => {
    const name = sanitizeCatalogDisplayName(input.name).toUpperCase();
    if (!name) throw new Error("Nombre obligatorio.");

    if (input.id) {
      const dup = findSupplierDuplicate(suppliers, name, input.id);
      if (dup) throw new Error(`Ya existe el proveedor "${dup.name}".`);
      const updated = suppliers.map((s) =>
        s.id === input.id ? extendLegacySupplier({ ...s, ...input, name }) : s
      );
      persistCatalog(categories, warehouses, locations, updated);
      return;
    }

    const duplicate = findSupplierDuplicate(suppliers, name);
    if (duplicate) {
      const revived = extendLegacySupplier({ ...duplicate, ...input, name, active: true });
      persistCatalog(categories, warehouses, locations, suppliers.map((s) => (s.id === duplicate.id ? revived : s)));
      return;
    }

    const created = extendLegacySupplier({
      id: `sup_${Date.now()}`,
      ...input,
      name,
    });
    persistCatalog(categories, warehouses, locations, [...suppliers, created]);
  };

  const handleToggleSupplier = (id: string, active: boolean) => {
    const updated = suppliers.map((s) => (s.id === id ? { ...s, active } : s));
    persistCatalog(categories, warehouses, locations, updated);
  };

  const handleSaveWarehouse = (input: { id?: string; name: string; address?: string; notes?: string; isDefault?: boolean }) => {
    if (input.id) {
      let updated = warehouses.map((w) =>
        w.id === input.id
          ? {
              ...w,
              name: sanitizeCatalogDisplayName(input.name),
              address: input.address,
              notes: input.notes,
              isDefault: input.isDefault ?? w.isDefault,
              updatedAt: new Date().toISOString(),
            }
          : w
      );
      if (input.isDefault) {
        updated = updated.map((w) => ({ ...w, isDefault: w.id === input.id }));
      }
      persistCatalog(categories, normalizeWarehouseDefaults(updated), locations);
      return;
    }
    const { warehouses: updated } = upsertWarehouse(warehouses, input);
    persistCatalog(categories, normalizeWarehouseDefaults(updated), locations);
  };

  const handleDeleteWarehouse = (id: string) => {
    const updated = deleteWarehouse(warehouses, lots, id);
    persistCatalog(categories, updated, locations);
  };

  const handleSaveLocation = (input: { id?: string; name: string; description?: string }) => {
    const name = sanitizeCatalogDisplayName(input.name);
    if (!name) throw new Error("Nombre obligatorio.");

    if (input.id) {
      const updated = locations.map((l) =>
        l.id === input.id
          ? {
              ...l,
              name,
              slug: buildCatalogSlug(name),
              description: input.description,
              updatedAt: new Date().toISOString(),
            }
          : l
      );
      persistCatalog(categories, warehouses, updated);
      return;
    }

    const duplicate = locations.find((l) => l.name.toLowerCase() === name.toLowerCase());
    if (duplicate) {
      const revived = stampLocation({
        ...duplicate,
        name,
        slug: buildCatalogSlug(name),
        description: input.description ?? duplicate.description,
        active: true,
      });
      persistCatalog(categories, warehouses, locations.map((l) => (l.id === duplicate.id ? revived : l)));
      return;
    }

    const created = stampLocation({
      id: `loc_${Date.now()}`,
      name,
      slug: buildCatalogSlug(name),
      description: input.description,
      active: true,
    });
    persistCatalog(categories, warehouses, [...locations, created]);
  };

  const handleToggleLocation = (id: string, active: boolean) => {
    const updated = locations.map((l) => (l.id === id ? { ...l, active, updatedAt: new Date().toISOString() } : l));
    persistCatalog(categories, warehouses, updated);
  };

  const handleSaveManufacturer = (input: Partial<Manufacturer> & { name: string }) => {
    const name = sanitizeCatalogDisplayName(input.name);
    if (!name) throw new Error("Nombre obligatorio.");
    const stamp = new Date().toISOString();

    if (input.id) {
      const dup = manufacturers.find((m) => m.name.toLowerCase() === name.toLowerCase() && m.id !== input.id);
      if (dup) throw new Error(`Ya existe el fabricante "${dup.name}".`);
      const updated = manufacturers.map((m) =>
        m.id === input.id ? { ...m, ...input, name, updatedAt: stamp } : m
      );
      setManufacturers(updated);
      syncWithBackend({ manufacturers: updated });
      return;
    }

    const duplicate = manufacturers.find((m) => m.name.toLowerCase() === name.toLowerCase());
    if (duplicate) {
      const revived: Manufacturer = { ...duplicate, ...input, name, active: true, updatedAt: stamp };
      const updated = manufacturers.map((m) => (m.id === duplicate.id ? revived : m));
      setManufacturers(updated);
      syncWithBackend({ manufacturers: updated });
      return;
    }

    const created: Manufacturer = {
      id: `mfg_${Date.now()}`,
      name,
      ruc: input.ruc,
      contact: input.contact,
      phone: input.phone,
      email: input.email,
      notes: input.notes,
      active: input.active ?? true,
      createdAt: stamp,
      updatedAt: stamp,
    };
    const updated = [...manufacturers, created];
    setManufacturers(updated);
    syncWithBackend({ manufacturers: updated });
  };

  const handleToggleManufacturer = (id: string, active: boolean) => {
    const stamp = new Date().toISOString();
    const updated = manufacturers.map((m) => (m.id === id ? { ...m, active, updatedAt: stamp } : m));
    setManufacturers(updated);
    syncWithBackend({ manufacturers: updated });
  };

  const handleConfirmPurchase = async (payload: {
    supplierId: string;
    supplierName: string;
    docType: StockPurchase["docType"];
    warehouse: string;
    warehouseId?: string;
    series: string;
    correlativo: string;
    paymentCondition: StockPurchase["paymentCondition"];
    paymentMethod: NonNullable<StockPurchase["paymentMethod"]>;
    items: PurchaseLine[];
    total: number;
    paidToday: number;
  }): Promise<boolean> => {
    const timestamp = new Date().toISOString();
    const documentRef = `${payload.series}-${payload.correlativo.padStart(6, "0")}`;
    const warehouseId = resolveWarehouseId(warehouses, payload.warehouseId, payload.warehouse);
    const warehouseName = resolveWarehouseName(warehouses, warehouseId, payload.warehouse);

    const purchase: StockPurchase = {
      id: `purchase_${Date.now()}`,
      timestamp,
      supplierId: payload.supplierId,
      supplierName: payload.supplierName,
      docType: payload.docType,
      warehouse: warehouseName,
      warehouseId,
      series: payload.series,
      correlativo: payload.correlativo,
      documentRef,
      paymentCondition: payload.paymentCondition,
      paymentMethod: payload.paymentMethod,
      items: payload.items,
      total: payload.total,
      paidToday: payload.paidToday,
      sessionId: activeSession?.id,
    };

    let ledgerState = { products, lots, movements: stockMovements };
    payload.items.forEach((item, index) => {
      ledgerState = registerInbound(ledgerState, {
        productCode: item.productCode,
        productName: item.productName,
        warehouseId,
        warehouseName,
        quantity: item.quantity,
        movementType: StockMovementTypes.COMPRA,
        unitCost: item.unitCost,
        lotNumber: item.lotNumber || `CMP-${payload.series}-${payload.correlativo.padStart(6, "0")}-${index + 1}`,
        expiryDate: item.expiryDate,
        referenceId: purchase.id,
        referenceTable: "compras",
        reference: documentRef,
        detail: `${payload.supplierName} · ${payload.paymentCondition === "credito" ? "Crédito" : "Contado"}`,
        timestamp,
      });
    });

    const updatedProducts = ledgerState.products.map((product) => {
      const lines = payload.items.filter((item) => item.productCode === product.code);
      if (lines.length === 0) return product;
      const lastCost = lines[lines.length - 1]?.unitCost ?? product.purchasePrice;
      return { ...product, purchasePrice: lastCost };
    });
    const updatedLots = ledgerState.lots;
    const updatedMovements = ledgerState.movements;

    const updatedPurchases = [...stockPurchases, purchase];
    let updatedSessions = [...cashSessions];
    let updatedSupplierDebts = [...supplierDebts];

    if (
      payload.paymentCondition === "contado" &&
      activeSession &&
      payload.paymentMethod === "Efectivo" &&
      payload.paidToday > 0
    ) {
      const updatedSession: CashSession = {
        ...activeSession,
        withdrawals: activeSession.withdrawals + payload.paidToday,
        expectedCash: activeSession.expectedCash - payload.paidToday,
        notes: activeSession.notes
          ? `${activeSession.notes} | COMPRA: ${formatCurrency(payload.paidToday, normalizeCurrency(storeConfig.currency, locale))} (${documentRef})`
          : `COMPRA: ${formatCurrency(payload.paidToday, normalizeCurrency(storeConfig.currency, locale))} (${documentRef})`,
      };
      setActiveSession(updatedSession);
      updatedSessions = cashSessions.map((s) => (s.id === activeSession.id ? updatedSession : s));
    }

    if (payload.paymentCondition === "credito") {
      const historyEntry = {
        id: `sup_debt_${Date.now()}`,
        date: timestamp,
        amount: payload.total,
        type: "purchase" as const,
        notes: `${payload.docType} ${documentRef}`,
        purchaseId: purchase.id,
      };
      const existingIdx = updatedSupplierDebts.findIndex((d) => d.supplierId === payload.supplierId);
      if (existingIdx >= 0) {
        const current = updatedSupplierDebts[existingIdx];
        updatedSupplierDebts[existingIdx] = {
          ...current,
          totalDebt: current.totalDebt + payload.total,
          history: [historyEntry, ...current.history],
        };
      } else {
        updatedSupplierDebts.push({
          id: `supplier_debt_${payload.supplierId}`,
          supplierId: payload.supplierId,
          supplierName: payload.supplierName,
          totalDebt: payload.total,
          history: [historyEntry],
        });
      }
    }

    setProducts(updatedProducts);
    setLots(updatedLots);
    setStockMovements(updatedMovements);
    setStockPurchases(updatedPurchases);
    setSupplierDebts(updatedSupplierDebts);
    setCashSessions(updatedSessions);

    await syncWithBackend(
      {
        products: updatedProducts,
        cashSessions: updatedSessions,
        lots: updatedLots,
        stockPurchases: updatedPurchases,
        supplierDebts: updatedSupplierDebts,
        stockMovements: updatedMovements,
      },
      { immediate: true }
    );

    alert(`Compra registrada: ${documentRef}. Stock actualizado.`);
    return true;
  };

  const handleImport1000Products = () => {
    if (!window.confirm(t("app.import1000Confirm"))) {
      return;
    }

    const { products: generatedProds, lots: generatedLots } = generateSampleCatalog(locale, 1000);

    setProducts(generatedProds);
    setLots(generatedLots);
    syncWithBackend({ products: generatedProds, lots: generatedLots }, { immediate: true });
    alert(locale === "en" ? t("app.import1000SuccessUsa") : t("app.import1000SuccessPeru"));
  };

  // === Theme & Settings handlers ===
  const handleThemeChange = async (newTheme: "dark" | "light") => {
    setTheme(newTheme);

    const updatedStoreConfig: StoreConfig = { ...storeConfig, theme: newTheme };
    setStoreConfig(updatedStoreConfig);

    // Persist to backend immediately
    await syncWithBackend({ storeConfig: updatedStoreConfig }, { immediate: true });
  };

  const handleLanguageChange = async (newLocale: AppLocale) => {
    setLocale(newLocale);

    const updatedStoreConfig: StoreConfig = { ...storeConfig, language: newLocale };
    setStoreConfig(updatedStoreConfig);

    await syncWithBackend({ storeConfig: updatedStoreConfig }, { immediate: true });
  };

  const handleCurrencyChange = async (newCurrency: CurrencyCode) => {
    const updatedStoreConfig: StoreConfig = { ...storeConfig, currency: newCurrency };
    setStoreConfig(updatedStoreConfig);
    await syncWithBackend({ storeConfig: updatedStoreConfig }, { immediate: true });
  };

  // Full backup (all data)
  const handleExportFullBackup = () => {
    const fullBackup = {
      ...JSON.parse(
        serializeDbPayload({
          products,
      lots,
      sales,
      cashSessions,
      debts,
      suppliers,
      categories,
      warehouses,
      locations,
      manufacturers,
      stockMovements,
      stockPurchases,
      supplierDebts,
          storeConfig,
        })
      ),
      version: "1.3",
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(fullBackup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `niftypos-full-backup-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportFullBackup = async (file: File): Promise<boolean> => {
    const text = await file.text();
    try {
      const data = parseDbContent(text);
      const importedProducts = (data.products as Product[] | undefined) ?? products;
      const importedLots = (data.lots as Lot[] | undefined) ?? lots;
      const importedSales = (data.sales as Sale[] | undefined) ?? sales;
      const importedSessions = (data.cashSessions as CashSession[] | undefined) ?? cashSessions;
      const importedDebts = (data.debts as CustomerDebt[] | undefined) ?? debts;
      const importedSuppliers = ((data.suppliers as Supplier[] | undefined) ?? suppliers).map(extendLegacySupplier);
      const importedCategories = (data.categories as Category[] | undefined) ?? categories;
      const importedWarehouses = (data.warehouses as Warehouse[] | undefined) ?? warehouses;
      const importedLocations = (data.locations as StorageLocation[] | undefined) ?? locations;
      const importedManufacturers = (data.manufacturers as Manufacturer[] | undefined) ?? manufacturers;
      const importedMovements = (data.stockMovements as StockMovement[] | undefined) ?? stockMovements;
      const importedPurchases = (data.stockPurchases as StockPurchase[] | undefined) ?? stockPurchases;
      const importedSupplierDebts = (data.supplierDebts as SupplierDebt[] | undefined) ?? supplierDebts;

      if (data.products) setProducts(importedProducts);
      if (data.lots) setLots(importedLots);
      if (data.sales) setSales(importedSales);
      if (data.cashSessions) setCashSessions(importedSessions);
      if (data.debts) setDebts(importedDebts);
      if (data.suppliers) setSuppliers(importedSuppliers);
      if (data.categories) setCategories(importedCategories);
      if (data.warehouses) setWarehouses(importedWarehouses);
      if (data.locations) setLocations(importedLocations);
      if (data.manufacturers) setManufacturers(importedManufacturers);
      if (data.stockMovements) setStockMovements(importedMovements);
      if (data.stockPurchases) setStockPurchases(importedPurchases);
      if (data.supplierDebts) setSupplierDebts(importedSupplierDebts);

      const newConfig = data.storeConfig
        ? { ...storeConfig, ...(data.storeConfig as Partial<StoreConfig>) }
        : storeConfig;
      const importLocale = normalizeLocale(newConfig.language);
      newConfig.tax = normalizeTaxConfig(newConfig.tax, importLocale);
      newConfig.currency = normalizeCurrency(newConfig.currency, importLocale);

      if (data.storeConfig) {
        setStoreConfig(newConfig);
        if (newConfig.theme) setTheme(newConfig.theme);
        if (newConfig.language) setLocale(normalizeLocale(newConfig.language));
      }

      await syncWithBackend(
        {
          products: importedProducts,
          sales: importedSales,
          cashSessions: importedSessions,
          lots: importedLots,
          debts: importedDebts,
          storeConfig: newConfig,
          suppliers: importedSuppliers,
          stockPurchases: importedPurchases,
          supplierDebts: importedSupplierDebts,
          categories: importedCategories,
          warehouses: importedWarehouses,
          locations: importedLocations,
          manufacturers: importedManufacturers,
          stockMovements: importedMovements,
        },
        { immediate: true }
      );
      return true;
    } catch (err) {
      console.error("Import backup failed:", err);
      return false;
    }
  };

  const buildFreshStoreConfig = (keepTheme: "dark" | "light", keepLanguage: AppLocale): StoreConfig =>
    createDefaultStoreConfig(keepLanguage, keepTheme);

  // Advanced data actions
  const handleClearSalesHistory = async (): Promise<boolean> => {
    if (!confirm(t("app.clearSalesConfirm"))) return false;
    setSales([]);
    setCashSessions([]);
    setActiveSession(null);
    await syncWithBackend({ sales: [], cashSessions: [] }, { immediate: true });
    return true;
  };

  const handleClearDebts = async (): Promise<boolean> => {
    if (!confirm(t("app.clearDebtsConfirm"))) return false;
    setDebts([]);
    await syncWithBackend({ debts: [] }, { immediate: true });
    return true;
  };

  const handleClearAllProducts = async (): Promise<boolean> => {
    if (!confirm(t("app.clearProductsConfirm"))) return false;
    setProducts([]);
    setLots([]);
    setStockMovements([]);
    await syncWithBackend(
      { products: [], lots: [], stockMovements: [] },
      { immediate: true }
    );
    return true;
  };

  const handleResetAllData = async (): Promise<boolean> => {
    if (!confirm(t("app.resetAllConfirm"))) return false;

    const freshConfig = buildFreshStoreConfig(theme, locale);
    const freshSuppliers = DEFAULT_SUPPLIERS.map(extendLegacySupplier);
    const freshWarehouses = migrateWarehousesFromLegacy(undefined, []);
    const freshLocations = buildDefaultLocations();
    const freshManufacturers = DEFAULT_MANUFACTURERS.map((m) => ({
      ...m,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    setProducts([]);
    setSales([]);
    setCashSessions([]);
    setLots([]);
    setDebts([]);
    setSuppliers(freshSuppliers);
    setCategories([]);
    setWarehouses(freshWarehouses);
    setLocations(freshLocations);
    setManufacturers(freshManufacturers);
    setStockMovements([]);
    setStockPurchases([]);
    setSupplierDebts([]);
    setActiveSession(null);
    setStoreConfig(freshConfig);

    await syncWithBackend(
      {
        products: [],
        sales: [],
        cashSessions: [],
        lots: [],
        debts: [],
        storeConfig: freshConfig,
        suppliers: freshSuppliers,
        stockPurchases: [],
        supplierDebts: [],
        categories: [],
        warehouses: freshWarehouses,
        locations: freshLocations,
        manufacturers: freshManufacturers,
        stockMovements: [],
      },
      { immediate: true }
    );
    return true;
  };

  // 2. Cash Shift actions
  const handleOpenSession = (initialBalance: number) => {
    const newSession: CashSession = {
      id: `session_${Date.now()}`,
      startTime: new Date().toISOString(),
      endTime: null,
      initialBalance,
      salesCash: 0,
      salesCard: 0,
      salesYape: 0,
      withdrawals: 0,
      deposits: 0,
      expectedCash: initialBalance,
      actualCash: null,
      difference: null,
    };

    const updatedSessions = [...cashSessions, newSession];
    setCashSessions(updatedSessions);
    setActiveSession(newSession);
    syncWithBackend({ cashSessions: updatedSessions });
  };

  const handleCloseSession = (actualCash: number, notes: string) => {
    if (!activeSession) return;

    const closedSession = recalculateSession(
      {
        ...activeSession,
        endTime: new Date().toISOString(),
        actualCash,
        notes,
      },
      getSessionSales(sales, activeSession.id, cashSessions)
    );

    const updatedSessions = cashSessions.map((s) =>
      s.id === activeSession.id ? closedSession : s
    );

    setCashSessions(updatedSessions);
    setActiveSession(null);
    syncWithBackend({ cashSessions: updatedSessions });
  };

  const applySessionRecalc = (
    sessions: CashSession[],
    salesList: Sale[],
    sessionId: string
  ): CashSession[] => {
    return sessions.map((s) => {
      if (s.id !== sessionId) return s;
      return recalculateSession(s, getSessionSales(salesList, sessionId, sessions));
    });
  };

  const handleUpdateSession = (updatedSession: CashSession) => {
    const recalced = recalculateSession(
      updatedSession,
      getSessionSales(sales, updatedSession.id, cashSessions)
    );
    const updatedSessions = cashSessions.map((s) =>
      s.id === recalced.id ? recalced : s
    );

    const newActive =
      activeSession?.id === recalced.id
        ? updatedSessions.find((s) => s.id === recalced.id) || null
        : activeSession;

    setCashSessions(updatedSessions);
    setActiveSession(newActive);
    syncWithBackend({ cashSessions: updatedSessions });
  };

  const handleUpdateSale = (saleId: string, updatedSale: Sale) => {
    const oldSale = sales.find((s) => s.id === saleId);
    if (!oldSale) return;

    let updatedProducts = [...products];
    let updatedLots = [...lots];

    const salesWh = resolveSalesWarehouse();
    let updatedMovements = [...stockMovements];

    const restored = restoreStockFromItems(oldSale.items, updatedProducts, updatedLots, updatedMovements, salesWh.id, salesWh.name);
    updatedProducts = restored.products;
    updatedLots = restored.lots;
    updatedMovements = restored.movements;

    const deducted = deductStockFromItems(updatedSale.items, updatedProducts, updatedLots, updatedMovements, salesWh.id, salesWh.name);
    updatedProducts = deducted.products;
    updatedLots = deducted.lots;
    updatedMovements = deducted.movements;

    const saleWithAllocations = { ...updatedSale, items: deducted.itemsWithAllocations };
    const updatedSales = sales.map((s) => (s.id === saleId ? saleWithAllocations : s));
    let updatedSessions = [...cashSessions];

    const sessionId = updatedSale.sessionId || oldSale.sessionId;
    if (sessionId) {
      updatedSessions = applySessionRecalc(updatedSessions, updatedSales, sessionId);
      if (activeSession?.id === sessionId) {
        const refreshed = updatedSessions.find((s) => s.id === sessionId) || null;
        setActiveSession(refreshed);
      }
    }

    setProducts(updatedProducts);
    setLots(updatedLots);
    setStockMovements(updatedMovements);
    setSales(updatedSales);
    setCashSessions(updatedSessions);
    syncWithBackend({
      products: updatedProducts,
      sales: updatedSales,
      cashSessions: updatedSessions,
      lots: updatedLots,
      stockMovements: updatedMovements,
    });
  };

  const handleDeleteSale = (saleId: string) => {
    const sale = sales.find((s) => s.id === saleId);
    if (!sale) return;

    const salesWh = resolveSalesWarehouse();
    const restored = restoreStockFromItems(sale.items, products, lots, stockMovements, salesWh.id, salesWh.name);
    const updatedSales = sales.filter((s) => s.id !== saleId);
    let updatedSessions = [...cashSessions];

    const sessionId = sale.sessionId;
    if (sessionId) {
      updatedSessions = applySessionRecalc(updatedSessions, updatedSales, sessionId);
      if (activeSession?.id === sessionId) {
        const refreshed = updatedSessions.find((s) => s.id === sessionId) || null;
        setActiveSession(refreshed);
      }
    }

    setProducts(restored.products);
    setLots(restored.lots);
    setStockMovements(restored.movements);
    setSales(updatedSales);
    setCashSessions(updatedSessions);
    syncWithBackend({
      products: restored.products,
      sales: updatedSales,
      cashSessions: updatedSessions,
      lots: restored.lots,
      stockMovements: restored.movements,
    });
  };

  const handleAddTransaction = (
    type: "deposit" | "withdrawal",
    amount: number,
    notes: string
  ) => {
    if (!activeSession) return;

    const isWithdrawal = type === "withdrawal";
    const withdrawalsDiff = isWithdrawal ? amount : 0;
    const depositsDiff = isWithdrawal ? 0 : amount;
    
    const updatedSession: CashSession = {
      ...activeSession,
      withdrawals: activeSession.withdrawals + withdrawalsDiff,
      deposits: activeSession.deposits + depositsDiff,
      expectedCash:
        activeSession.expectedCash + (depositsDiff - withdrawalsDiff),
      notes: activeSession.notes
        ? `${activeSession.notes} | ${type.toUpperCase()}: ${formatCurrency(amount, normalizeCurrency(storeConfig.currency, locale))} (${notes})`
        : `${type.toUpperCase()}: ${formatCurrency(amount, normalizeCurrency(storeConfig.currency, locale))} (${notes})`,
    };

    const updatedSessions = cashSessions.map((s) =>
      s.id === activeSession.id ? updatedSession : s
    );

    setCashSessions(updatedSessions);
    setActiveSession(updatedSession);
    syncWithBackend({ cashSessions: updatedSessions });
  };

  // 3. Customer Debt Actions
  const handleAddDebtCustomer = (name: string, phone: string, dni: string) => {
    const newCustomer: CustomerDebt = {
      id: `debt_cust_${Date.now()}`,
      customerName: name,
      customerPhone: phone,
      customerDni: dni,
      totalDebt: 0,
      history: []
    };
    const updatedDebts = [...debts, newCustomer];
    setDebts(updatedDebts);
    syncWithBackend({ debts: updatedDebts });
  };

  const handleRecordPayment = (customerId: string, amount: number, notes: string) => {
    const updatedDebts = debts.map((d) => {
      if (d.id === customerId) {
        return {
          ...d,
          totalDebt: d.totalDebt - amount,
          history: [
            {
              id: `pay_${Date.now()}`,
              date: new Date().toISOString(),
              amount: -amount,
              type: "payment" as const,
              notes: notes || "Abono a cuenta"
            },
            ...d.history
          ]
        };
      }
      return d;
    });

    setDebts(updatedDebts);

    // Also register this payment as a cash register deposit transaction!
    let updatedSessions = [...cashSessions];
    if (activeSession) {
      const updatedSession: CashSession = {
        ...activeSession,
        deposits: activeSession.deposits + amount,
        expectedCash: activeSession.expectedCash + amount,
        notes: activeSession.notes
          ? `${activeSession.notes} | ABONO CLIENTE: ${formatCurrency(amount, normalizeCurrency(storeConfig.currency, locale))} (${notes})`
          : `ABONO CLIENTE: ${formatCurrency(amount, normalizeCurrency(storeConfig.currency, locale))} (${notes})`,
      };
      setActiveSession(updatedSession);
      updatedSessions = cashSessions.map((s) =>
        s.id === activeSession.id ? updatedSession : s
      );
      setCashSessions(updatedSessions);
    }

    syncWithBackend({ cashSessions: updatedSessions, debts: updatedDebts });
  };

  const handleRecordSupplierPayment = (
    supplierDebtId: string,
    amount: number,
    notes: string,
    purchaseId?: string
  ) => {
    const updatedSupplierDebts = supplierDebts.map((d) => {
      if (d.id !== supplierDebtId) return d;
      return {
        ...d,
        totalDebt: d.totalDebt - amount,
        history: [
          {
            id: `sup_pay_${Date.now()}`,
            date: new Date().toISOString(),
            amount: -amount,
            type: "payment" as const,
            notes: notes || "Pago a proveedor",
            purchaseId,
          },
          ...d.history,
        ],
      };
    });

    setSupplierDebts(updatedSupplierDebts);

    let updatedSessions = [...cashSessions];
    if (activeSession) {
      const updatedSession: CashSession = {
        ...activeSession,
        withdrawals: activeSession.withdrawals + amount,
        expectedCash: activeSession.expectedCash - amount,
        notes: activeSession.notes
          ? `${activeSession.notes} | PAGO PROVEEDOR: ${formatCurrency(amount, normalizeCurrency(storeConfig.currency, locale))} (${notes})`
          : `PAGO PROVEEDOR: ${formatCurrency(amount, normalizeCurrency(storeConfig.currency, locale))} (${notes})`,
      };
      setActiveSession(updatedSession);
      updatedSessions = cashSessions.map((s) => (s.id === activeSession.id ? updatedSession : s));
      setCashSessions(updatedSessions);
    }

    syncWithBackend({ cashSessions: updatedSessions, supplierDebts: updatedSupplierDebts });
  };

  // 3. POS checkout processing
  const handleCheckout = async (
    cartItems: any[],
    subtotal: number,
    discount: number,
    total: number,
    paymentMethod: string,
    cashReceived: number,
    cashChange: number,
    documentType: "ticket" | "boleta" = "ticket",
    selectedCustomerId?: string,
    customerDni?: string,
    customerName?: string
  ): Promise<boolean> => {
    // A. Prepare next document number (persist only after SUNAT succeeds)
    let docNumber = "";
    const updatedStoreConfig = { ...storeConfig };

    if (documentType === "boleta") {
      const nextNum = storeConfig.lastBoletaNumber + 1;
      docNumber = formatDocumentNumber(storeConfig.boletaSeries, nextNum);
      updatedStoreConfig.lastBoletaNumber = nextNum;
    } else {
      const nextNum = storeConfig.lastTicketNumber + 1;
      docNumber = formatDocumentNumber(storeConfig.ticketSeries, nextNum);
      updatedStoreConfig.lastTicketNumber = nextNum;
    }

    const timestamp = new Date().toISOString();
    const taxBreakdown = calculateSaleTax(subtotal, discount, resolveTaxConfig(storeConfig));
    const gravada = taxBreakdown.taxableBase;
    const igv = taxBreakdown.taxAmount;
    const checkoutTotal = taxBreakdown.total || total;

    const checkoutItems = cartItems.map((item) => ({
      code: item.code,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
    }));

    let sunatFields: Pick<
      Sale,
      "sunatQrPayload" | "sunatHash" | "sunatCdrCode" | "sunatStatus" | "sunatPendingSummary"
    > = {};

    if (documentType === "boleta" && storeConfig.sunat?.enabled) {
      const sunatResult = await emitSunatBoleta(storeConfig.sunat, {
        sale: {
          documentNumber: docNumber,
          timestamp,
          items: checkoutItems,
          subtotal,
          discount,
          total: checkoutTotal,
          gravada,
          igv,
          customerDni,
          customerName,
        },
        store: {
          ruc: storeConfig.ruc,
          businessName: storeConfig.businessName,
          address: storeConfig.address,
          boletaSeries: storeConfig.boletaSeries,
        },
      });

      if (!sunatResult.success && !sunatResult.pendingSummary) {
        alert(`No se pudo emitir la boleta en SUNAT:\n\n${sunatResult.message}`);
        return false;
      }

      sunatFields = {
        sunatQrPayload: sunatResult.qrPayload,
        sunatHash: sunatResult.hash,
        sunatCdrCode: sunatResult.cdrCode,
        sunatPendingSummary: sunatResult.pendingSummary,
        sunatStatus: sunatResult.pendingSummary
          ? "pending_summary"
          : sunatResult.success
            ? "accepted"
            : "rejected",
      };

      if (sunatResult.pendingSummary) {
        console.info("SUNAT:", sunatResult.message);
      }
    }

    setStoreConfig(updatedStoreConfig);

    const saleId = `sale_${Date.now()}`;
    const salesWh = resolveSalesWarehouse();

    let deducted;
    try {
      deducted = deductSaleItems(
        { products, lots, movements: stockMovements },
        cartItems.map((item) => ({ code: item.code, name: item.name, price: item.price, quantity: item.quantity })),
        {
          warehouseId: salesWh.id,
          warehouseName: salesWh.name,
          referenceId: saleId,
          reference: docNumber,
          detail: `${paymentMethod} · ${documentType === "boleta" ? "Boleta" : "Ticket"}`,
          timestamp,
        }
      );
    } catch (err) {
      alert((err as Error).message);
      return false;
    }

    const updatedLots = deducted.lots;
    const updatedProducts = deducted.products;
    const updatedMovements = deducted.movements;
    setLots(updatedLots);
    setProducts(updatedProducts);
    setStockMovements(updatedMovements);

    // D. If Fiado/Crédito, update customer debt record
    let updatedDebts = [...debts];
    if (paymentMethod === "Fiado" && selectedCustomerId) {
      updatedDebts = debts.map((d) => {
        if (d.id === selectedCustomerId) {
          return {
            ...d,
            totalDebt: d.totalDebt + checkoutTotal,
            history: [
              {
                id: `debt_sale_${Date.now()}`,
                date: new Date().toISOString(),
                amount: checkoutTotal,
                type: "sale" as const,
                notes: `Compra con ${documentType === "boleta" ? "Boleta" : "Ticket"} N° ${docNumber}`,
                saleId,
              },
              ...d.history
            ]
          };
        }
        return d;
      });
      setDebts(updatedDebts);
    }

    // E. Register the sale
    const newSale: Sale = {
      id: saleId,
      sessionId: activeSession?.id,
      timestamp,
      items: deducted.itemsWithAllocations,
      subtotal,
      discount,
      total: checkoutTotal,
      paymentMethod,
      cashReceived,
      cashChange,
      documentType,
      documentNumber: docNumber,
      customerDni,
      customerName,
      gravada,
      igv,
      ...sunatFields,
    };

    const updatedSales = [...sales, newSale];
    setSales(updatedSales);
    setLastCheckoutSale(newSale);

    // G. Update active session calculations
    let updatedSessions = [...cashSessions];
    if (activeSession) {
      const isCash = paymentMethod === "Efectivo";
      const isYape = paymentMethod === "Yape";
      const isCard = paymentMethod === "Tarjeta";
      const cashSalesDiff = isCash ? checkoutTotal : 0;
      const cardSalesDiff = isCard ? checkoutTotal : 0;
      const yapeSalesDiff = isYape ? checkoutTotal : 0;

      const updatedSession: CashSession = {
        ...activeSession,
        salesCash: activeSession.salesCash + cashSalesDiff,
        salesCard: activeSession.salesCard + cardSalesDiff,
        salesYape: (activeSession.salesYape || 0) + yapeSalesDiff,
        expectedCash: activeSession.expectedCash + cashSalesDiff,
      };

      setActiveSession(updatedSession);
      updatedSessions = cashSessions.map((s) =>
        s.id === activeSession.id ? updatedSession : s
      );
      setCashSessions(updatedSessions);
    }

    // Save database
    await syncWithBackend(
      {
        products: updatedProducts,
        sales: updatedSales,
        cashSessions: updatedSessions,
        lots: updatedLots,
        debts: updatedDebts,
        storeConfig: updatedStoreConfig,
        stockMovements: updatedMovements,
      },
      { immediate: true }
    );

    triggerReceiptPrint(newSale);
    return true;
  };

  const productByCode = useMemo(() => buildProductByCodeMap(products), [products]);

  const salesWarehouseId = useMemo(() => {
    const whId = storeConfig.salesWarehouseId || getDefaultWarehouse(warehouses)?.id;
    return warehouses.find((w) => w.id === whId)?.id || getDefaultWarehouse(warehouses)?.id;
  }, [warehouses, storeConfig.salesWarehouseId]);

  const warehouseStockByProduct = useMemo(
    () => buildWarehouseStockMap(lots, salesWarehouseId),
    [lots, salesWarehouseId]
  );

  const posProducts = useMemo(
    () =>
      products.map((p) => ({
        ...p,
        stock: warehouseStockByProduct.get(p.code) ?? 0,
      })),
    [products, warehouseStockByProduct]
  );

  const alertsCount = useMemo(() => countInventoryAlerts(products, lots), [products, lots]);

  const HeaderTabIcon = TAB_HEADER_ICONS[activeTab];

  const activeHeader = {
    pos: t("headers.pos"),
    inventory: t("headers.inventory"),
    catalog: t("headers.catalog"),
    "stock-entry": t("headers.stockEntry"),
    kardex: t("headers.kardex"),
    alerts: t("headers.alerts"),
    cash: t("headers.cash"),
    "sales-history": t("headers.salesHistory"),
    debts: t("headers.debts"),
    "ai-chat": t("headers.aiChat"),
    reports: t("headers.reports"),
    settings: t("headers.settings"),
  }[activeTab];

  const localeTag = locale === "en" ? "en-US" : "es-PE";

  return (
    <I18nProvider locale={locale}>
    <MoneyProvider currency={storeConfig.currency} localeTag={localeTag}>
    <div className="app-shell">
      {/* Sidebar Layout */}
      <aside className="app-sidebar">
        <div>
          <div className="sidebar-logo">
            <LogoIcon size={36} className="sidebar-logo-mark" />
            <h1>Nifty Retail</h1>
          </div>
          
          <nav className="sidebar-menu" aria-label={t("sidebar.navLabel")}>
            {SIDEBAR_SECTIONS.map((section) => (
              <div key={section.sectionKey} className="sidebar-menu-section">
                <span className="sidebar-menu-section-label">{t(section.sectionKey)}</span>
                <ul className="sidebar-menu-section-list">
                  {section.items.map(({ tab, icon: Icon, labelKey }) => {
                    const isActive = activeTab === tab;
                    return (
                      <li key={tab}>
                        <button
                          type="button"
                          className={`menu-item${isActive ? " active" : ""}`}
                          onClick={() => setActiveTab(tab)}
                          aria-current={isActive ? "page" : undefined}
                        >
                          <span className="menu-item-icon-wrap" aria-hidden="true">
                            <Icon size={18} className="menu-item-icon" />
                          </span>
                          <span className="menu-item-label">{t(labelKey)}</span>
                          {tab === "alerts" && alertsCount > 0 && (
                            <span className="menu-item-badge">{alertsCount}</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {/* Caja active status indicators */}
        <div className="sidebar-caja-status">
          <div className="caja-status-title">{t("sidebar.cashStatus")}</div>
          {activeSession ? (
            <div className="caja-status-badge">
              <span className="caja-status-dot"></span>
              {t("sidebar.cashOpen")}
            </div>
          ) : (
            <div className="caja-status-badge closed">
              <span className="caja-status-dot"></span>
              {t("sidebar.cashClosed")}
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="app-content">
        <header className="app-header">
          <div className="app-header-accent" aria-hidden="true" />
          <div className="header-title">
            <span className="header-title-mark" aria-hidden="true">
              <HeaderTabIcon size={20} className="header-title-mark-icon" />
            </span>
            <div className="header-title-copy">
              <span className="header-title-eyebrow">{t("header.appName")}</span>
              <h2>{activeHeader}</h2>
            </div>
          </div>
          <div className="header-status">
            <div className="header-status-panel">
              <div className="header-status-chip header-status-chip--scanner">
                <span className="pulse-indicator" aria-hidden="true" />
                <ScannerIcon size={14} />
                <span>{t("sidebar.scannerActive")}</span>
              </div>
              <div className="header-status-divider" aria-hidden="true" />
              <div className="header-status-chip header-status-chip--user">
                <UserIcon size={14} />
                <span>{t("sidebar.cashier", { name: t("common.admin") })}</span>
              </div>
              <div className="header-status-divider" aria-hidden="true" />
              <div
                className={`header-status-chip header-status-chip--cash${activeSession ? " is-open" : " is-closed"}`}
              >
                <span className="header-status-chip-dot" aria-hidden="true" />
                <span>{activeSession ? t("sidebar.cashOpen") : t("sidebar.cashClosed")}</span>
              </div>
            </div>
          </div>
        </header>

        {(dbRecoveryMessage || dbLoadError) && (
          <div
            className={`db-recovery-banner${dbLoadError ? " db-recovery-banner--error" : ""}`}
            role="status"
          >
            <span>{dbLoadError || dbRecoveryMessage}</span>
            <button
              type="button"
              className="db-recovery-banner-dismiss"
              onClick={() => {
                setDbRecoveryMessage(null);
                setDbLoadError(null);
              }}
            >
              {t("common.understood")}
            </button>
          </div>
        )}

        <section
          className={`main-view${activeTab === "pos" ? " main-view--pos" : ""}${activeTab === "ai-chat" ? " main-view--ai-chat" : ""}`}
        >
          {activeTab === "pos" && (
            <POS
              products={posProducts}
              categories={categories}
              activeSession={activeSession}
              debts={debts}
              storeConfig={storeConfig}
              onCheckout={handleCheckout}
              onOpenCash={() => setActiveTab("cash")}
            />
          )}

          {activeTab === "inventory" && (
            <Inventory
              products={products}
              lots={lots}
              categories={categories}
              manufacturers={manufacturers}
              warehouses={warehouses}
              onAddProduct={handleAddProduct}
              onEditProduct={handleEditProduct}
              onSaveProductLots={handleSaveProductLots}
              onDeleteProduct={handleDeleteProduct}
              onImport1000Products={handleImport1000Products}
            />
          )}

          {activeTab === "catalog" && (
            <CatalogPage
              categories={categories}
              suppliers={suppliers}
              manufacturers={manufacturers}
              warehouses={warehouses}
              locations={locations}
              onSaveCategory={handleSaveCategory}
              onDeleteCategory={handleDeleteCategory}
              onMergeCategories={handleMergeCategories}
              onSaveSupplier={handleSaveSupplierCatalog}
              onToggleSupplier={handleToggleSupplier}
              onSaveManufacturer={handleSaveManufacturer}
              onToggleManufacturer={handleToggleManufacturer}
              onSaveWarehouse={handleSaveWarehouse}
              onDeleteWarehouse={handleDeleteWarehouse}
              onSaveLocation={handleSaveLocation}
              onToggleLocation={handleToggleLocation}
            />
          )}

          {activeTab === "stock-entry" && (
            <StockEntry
              products={products}
              suppliers={suppliers.filter((s) => s.active !== false)}
              warehouses={warehouses.filter((w) => w.active)}
              activeSession={activeSession}
              onConfirmPurchase={handleConfirmPurchase}
            />
          )}

          {activeTab === "kardex" && (
            <Kardex
              products={products}
              movements={stockMovements}
              warehouses={warehouses}
              onTransferStock={handleTransferStock}
            />
          )}

          {activeTab === "alerts" && (
            <Alerts
              products={products}
              lots={lots}
              onQuickAdjustStock={handleQuickAdjustStock}
            />
          )}

          {activeTab === "cash" && (
            <CashControl
              sessions={cashSessions}
              sales={sales}
              storeConfig={storeConfig}
              activeSession={activeSession}
              onOpenSession={handleOpenSession}
              onCloseSession={handleCloseSession}
              onAddTransaction={handleAddTransaction}
              onUpdateSession={handleUpdateSession}
              onUpdateSale={handleUpdateSale}
              onDeleteSale={handleDeleteSale}
              initialEditSessionId={editSessionId}
              onClearEditSessionId={() => setEditSessionId(null)}
            />
          )}

          {activeTab === "sales-history" && (
            <SalesHistory
              sales={sales}
              sessions={cashSessions}
              storeConfig={storeConfig}
              onUpdateSale={handleUpdateSale}
              onDeleteSale={handleDeleteSale}
              onReprint={triggerReceiptPrint}
              onEditSession={(sessionId) => {
                setEditSessionId(sessionId);
                setActiveTab("cash");
              }}
            />
          )}

          {activeTab === "debts" && (
            <ErrorBoundary title="Error en Deudas">
              <Debts
                debts={debts}
                supplierDebts={supplierDebts}
                stockPurchases={stockPurchases}
                sales={sales}
                storeConfig={storeConfig}
                cashSessions={cashSessions}
                onAddDebtCustomer={handleAddDebtCustomer}
                onRecordPayment={handleRecordPayment}
                onRecordSupplierPayment={handleRecordSupplierPayment}
              />
            </ErrorBoundary>
          )}

          {activeTab === "ai-chat" && (
            <Suspense fallback={null}>
              <AiChat
                products={products}
                lots={lots}
                debts={debts}
                sales={sales}
                activeSession={activeSession}
                cashSessions={cashSessions}
                storeConfig={storeConfig}
                suppliers={suppliers}
                categories={categories}
                warehouses={warehouses}
                stockMovements={stockMovements}
              />
            </Suspense>
          )}

          {activeTab === "reports" && (
            <Suspense fallback={null}>
              <Reports
                sales={sales}
                products={products}
                lots={lots}
                debts={debts}
                supplierDebts={supplierDebts}
                cashSessions={cashSessions}
                activeSession={activeSession}
                onNavigateTab={setActiveTab}
                theme={theme}
              />
            </Suspense>
          )}

          {activeTab === "settings" && (
            <ErrorBoundary title={t("headers.settings")}>
              <Settings
                storeConfig={storeConfig}
                warehouses={warehouses}
                onUpdateStoreConfig={async (updated) => {
                  const normalizedLocale = normalizeLocale(updated.language);
                  const normalized: StoreConfig = {
                    ...updated,
                    tax: normalizeTaxConfig(updated.tax, normalizedLocale),
                    currency: normalizeCurrency(updated.currency, normalizedLocale),
                  };
                  setStoreConfig(normalized);
                  await syncWithBackend({ storeConfig: normalized }, { immediate: true });
                }}
                theme={theme}
                onThemeChange={handleThemeChange}
                language={locale}
                onLanguageChange={handleLanguageChange}
                onCurrencyChange={handleCurrencyChange}
                productsCount={products.length}
                salesCount={sales.length}
                onExportFullBackup={handleExportFullBackup}
                onImportFullBackup={handleImportFullBackup}
                onClearSalesHistory={handleClearSalesHistory}
                onClearDebts={handleClearDebts}
                onClearAllProducts={handleClearAllProducts}
                onResetAllData={handleResetAllData}
              />
            </ErrorBoundary>
          )}
        </section>
      </main>

      {/* Hidden thermal receipt printer overlay triggered by window.print() */}
      <ReceiptPrinter sale={lastCheckoutSale} storeConfig={storeConfig} />
    </div>
    </MoneyProvider>
    </I18nProvider>
  );
}

export default App;
