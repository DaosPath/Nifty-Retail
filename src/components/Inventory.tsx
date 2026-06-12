import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n";
import { useMoney } from "../hooks/useMoney";
import {
  PlusIcon,
  EditIcon,
  DeleteIcon,
  BookIcon,
  BoxIcon,
  SearchIcon,
  AlertIcon,
  ChartIcon,
  LayersIcon,
} from "./Icons";
import { InventoryTableRow } from "./InventoryTableRow";
import { useVirtualList } from "../hooks/useVirtualList";
import { SelectField } from "./SelectField";
import type { Category, Warehouse } from "../types/catalog";
import type { Manufacturer } from "../types/inventory";
import {
  getActiveCategoryNames,
  getLocalizedWarehouseName,
  getLocalizedWarehouseNameById,
  getWarehouseOptionHint,
} from "../utils/catalogHelpers";
import { isoToDisplay, parseDisplayDate } from "../utils/dateInput";

interface Product {
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

interface InventoryProps {
  products: Product[];
  lots: Lot[];
  categories: Category[];
  manufacturers: Manufacturer[];
  warehouses: Warehouse[];
  onAddProduct: (product: Product) => void;
  onEditProduct: (product: Product) => void;
  onSaveProductLots: (productCode: string, lots: Lot[]) => void;
  onDeleteProduct: (code: string) => void;
  onImport1000Products: () => void;
}

export const Inventory: React.FC<InventoryProps> = ({
  products,
  lots,
  categories,
  manufacturers,
  warehouses,
  onAddProduct,
  onEditProduct,
  onSaveProductLots,
  onDeleteProduct,
  onImport1000Products,
}) => {
  const { t, locale } = useI18n();
  const { formatMoney } = useMoney();
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Lots modal states
  const [isLotsModalOpen, setIsLotsModalOpen] = useState(false);
  const [lotsProduct, setLotsProduct] = useState<Product | null>(null);
  const [productLots, setProductLots] = useState<Lot[]>([]);
  const [newLotNumber, setNewLotNumber] = useState("");
  const [newLotExpiry, setNewLotExpiry] = useState("");
  const [newLotCost, setNewLotCost] = useState("");
  const [newLotStock, setNewLotStock] = useState("");
  const [newLotWarehouseId, setNewLotWarehouseId] = useState("");
  const [isAddLotModalOpen, setIsAddLotModalOpen] = useState(false);
  const [isAddLotLaunching, setIsAddLotLaunching] = useState(false);
  const [editingLotId, setEditingLotId] = useState<string | null>(null);
  const [editLotDraft, setEditLotDraft] = useState({
    lotNumber: "",
    expiry: "",
    cost: "",
    stock: "",
    initialQty: "",
    warehouseId: "",
  });

  // Form states
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [stock, setStock] = useState("");
  const [minStock, setMinStock] = useState("");
  const [image, setImage] = useState("");
  const [manufacturerId, setManufacturerId] = useState("");
  const [uploading, setUploading] = useState(false);

  const categoryOptions = useMemo(() => getActiveCategoryNames(categories), [categories]);
  const activeManufacturers = useMemo(
    () => manufacturers.filter((m) => m.active).sort((a, b) => a.name.localeCompare(b.name)),
    [manufacturers]
  );

  const categorySelectOptions = useMemo(
    () => [
      { value: "", label: t("inventory.categoryPlaceholder"), hint: t("inventory.categoryCount", { count: categoryOptions.length }) },
      ...categoryOptions.map((cat) => ({ value: cat, label: cat })),
    ],
    [categoryOptions, t]
  );

  const manufacturerSelectOptions = useMemo(
    () => [
      { value: "", label: t("inventory.noManufacturer"), hint: t("inventory.manufacturerOptional") },
      ...activeManufacturers.map((m) => ({ value: m.id, label: m.name })),
    ],
    [activeManufacturers, t]
  );

  const estimatedMargin = useMemo(() => {
    const cost = parseFloat(purchasePrice);
    const sale = parseFloat(sellingPrice);
    if (!Number.isFinite(cost) || !Number.isFinite(sale) || sale <= 0) return null;
    return ((sale - cost) / sale) * 100;
  }, [purchasePrice, sellingPrice]);
  const defaultWarehouse = useMemo(
    () => warehouses.find((w) => w.isDefault) || warehouses[0],
    [warehouses]
  );

  const warehouseSelectOptions = useMemo(
    () =>
      warehouses.map((w) => ({
        value: w.id,
        label: getLocalizedWarehouseName(w, t),
        hint: w.isDefault ? t("inventory.defaultWarehouse") : getWarehouseOptionHint(w, t),
      })),
    [warehouses, t]
  );

  const warehouseName = (id?: string) => getLocalizedWarehouseNameById(warehouses, id, t);

  const lotExpiryByProduct = useMemo(() => {
    const map = new Map<string, string>();
    for (const lot of lots) {
      if (lot.stock <= 0) continue;
      const current = map.get(lot.productCode);
      if (!current || lot.expiryDate < current) {
        map.set(lot.productCode, lot.expiryDate);
      }
    }
    return map;
  }, [lots]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setImage(base64String);
        setUploading(false);
      };
      reader.onerror = () => {
        alert(t("inventory.imageReadError"));
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      alert(t("inventory.imageError"));
      setUploading(false);
    }
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setCode("");
    setName("");
    setCategory("General");
    setPurchasePrice("");
    setSellingPrice("");
    setStock("");
    setMinStock("5");
    setImage("");
    setManufacturerId("");
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setCode(p.code);
    setName(p.name);
    setCategory(p.category);
    setPurchasePrice(p.purchasePrice.toString());
    setSellingPrice(p.sellingPrice.toString());
    setStock(p.stock.toString());
    setMinStock(String(Number(p.minStock) || 0));
    setImage(p.image || "");
    setManufacturerId(p.manufacturerId || "");
    setIsModalOpen(true);
  };

  const resetLotEdit = () => {
    setEditingLotId(null);
    setEditLotDraft({
      lotNumber: "",
      expiry: "",
      cost: "",
      stock: "",
      initialQty: "",
      warehouseId: "",
    });
  };

  const resetAddLotModal = () => {
    setIsAddLotModalOpen(false);
  };

  const prepareNewLotDefaults = (product: Product, lotCount: number) => {
    setNewLotNumber(`L-0${lotCount + 1}`);
    setNewLotExpiry("");
    setNewLotCost(product.purchasePrice.toString());
    setNewLotStock("10");
    setNewLotWarehouseId(defaultWarehouse?.id || "");
  };

  const openAddLotModal = () => {
    if (!lotsProduct || isAddLotLaunching) return;
    resetLotEdit();
    prepareNewLotDefaults(lotsProduct, productLots.length);
    setIsAddLotLaunching(true);
    setIsAddLotModalOpen(true);
    window.setTimeout(() => setIsAddLotLaunching(false), 420);
  };

  const openLotsModal = (p: Product) => {
    setLotsProduct(p);
    const activeLots = lots.filter((l) => l.productCode === p.code);
    setProductLots(activeLots);
    resetLotEdit();
    resetAddLotModal();
    setIsLotsModalOpen(true);
  };

  const startEditLot = (lot: Lot) => {
    setEditingLotId(lot.id);
    setEditLotDraft({
      lotNumber: lot.lotNumber,
      expiry: isoToDisplay(lot.expiryDate),
      cost: lot.purchasePrice.toString(),
      stock: lot.stock.toString(),
      initialQty: lot.initialQty.toString(),
      warehouseId: lot.warehouseId || defaultWarehouse?.id || "",
    });
  };

  const handleSaveLotEdit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!lotsProduct || !editingLotId) return;

    const parsedExpiry = parseDisplayDate(editLotDraft.expiry);
    if (!editLotDraft.lotNumber.trim() || !parsedExpiry || !editLotDraft.cost || editLotDraft.stock === "" || editLotDraft.initialQty === "") {
      alert(t("inventory.lotRequiredFields"));
      return;
    }

    const stock = parseInt(editLotDraft.stock, 10) || 0;
    const initialQty = parseInt(editLotDraft.initialQty, 10) || 0;
    if (stock > initialQty) {
      alert(t("inventory.lotStockExceedsInitial"));
      return;
    }

    const trimmedCode = editLotDraft.lotNumber.trim();
    const duplicate = productLots.some((l) => l.id !== editingLotId && l.lotNumber === trimmedCode);
    if (duplicate) {
      alert(t("inventory.lotDuplicateCode"));
      return;
    }

    const updated = productLots.map((l) =>
      l.id === editingLotId
        ? {
            ...l,
            lotNumber: trimmedCode,
            expiryDate: parsedExpiry,
            purchasePrice: parseFloat(editLotDraft.cost) || 0,
            stock,
            initialQty,
            warehouseId: editLotDraft.warehouseId || defaultWarehouse?.id,
          }
        : l
    );

    setProductLots(updated);
    onSaveProductLots(lotsProduct.code, updated);
    resetLotEdit();
  };

  const handleAddLotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lotsProduct) return;
    const parsedExpiry = parseDisplayDate(newLotExpiry);
    if (!newLotNumber.trim() || !parsedExpiry || !newLotCost || !newLotStock) {
      alert(t("inventory.lotRequiredFields"));
      return;
    }

    const newLot: Lot = {
      id: `lot_${lotsProduct.code}_${Date.now()}`,
      productCode: lotsProduct.code,
      lotNumber: newLotNumber.trim(),
      purchasePrice: parseFloat(newLotCost) || 0,
      initialQty: parseInt(newLotStock) || 0,
      stock: parseInt(newLotStock) || 0,
      expiryDate: parsedExpiry,
      createdAt: new Date().toISOString(),
      warehouseId: newLotWarehouseId || defaultWarehouse?.id,
    };

    const trimmedCode = newLotNumber.trim();
    const duplicate = productLots.some((l) => l.lotNumber === trimmedCode);
    if (duplicate) {
      alert(t("inventory.lotDuplicateCode"));
      return;
    }

    const updated = [...productLots, newLot];
    setProductLots(updated);
    onSaveProductLots(lotsProduct.code, updated);
    resetAddLotModal();
  };

  const handleDeleteLot = (lotId: string) => {
    if (!lotsProduct) return;
    if (window.confirm(t("inventory.lotDeleteConfirm"))) {
      const updated = productLots.filter((l) => l.id !== lotId);
      setProductLots(updated);
      onSaveProductLots(lotsProduct.code, updated);
      if (editingLotId === lotId) resetLotEdit();
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (!code.trim() || !name.trim() || !purchasePrice || !sellingPrice || !stock || !minStock) {
      alert(t("inventory.requiredFields"));
      return;
    }

    // Check code uniqueness for new product
    if (!editingProduct && products.some((p) => p.code === code.trim())) {
      alert(t("inventory.duplicateCode"));
      return;
    }

    const selectedMfg = activeManufacturers.find((m) => m.id === manufacturerId);
    const newProduct: Product = {
      code: code.trim(),
      name: name.trim(),
      category: category.trim() || "General",
      purchasePrice: parseFloat(purchasePrice) || 0,
      sellingPrice: parseFloat(sellingPrice) || 0,
      stock: parseInt(stock) || 0,
      minStock: parseInt(minStock) || 0,
      image: image ? image : undefined,
      manufacturerId: manufacturerId || undefined,
      manufacturer: selectedMfg?.name,
    };

    if (editingProduct) {
      onEditProduct(newProduct);
    } else {
      onAddProduct(newProduct);
    }

    setIsModalOpen(false);
  };

  const handleDelete = (code: string) => {
    if (window.confirm(t("inventory.deleteConfirm"))) {
      onDeleteProduct(code);
    }
  };

  const deferredSearchTerm = useDeferredValue(searchTerm);
  const normalizedSearch = deferredSearchTerm.trim().toLowerCase();

  const filteredProducts = useMemo(() => {
    if (!normalizedSearch) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(normalizedSearch) ||
        p.code.includes(deferredSearchTerm) ||
        p.category.toLowerCase().includes(normalizedSearch)
    );
  }, [products, normalizedSearch, deferredSearchTerm]);

  const manufacturerNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of manufacturers) map.set(m.id, m.name);
    return map;
  }, [manufacturers]);

  const inventoryTableRef = useRef<HTMLDivElement>(null);
  const inventoryMeasureRowRef = useRef<HTMLTableRowElement>(null);
  const [inventoryRowHeight, setInventoryRowHeight] = useState(64);

  useEffect(() => {
    const row = inventoryMeasureRowRef.current;
    if (!row) return;

    const measure = () => {
      const height = Math.ceil(row.getBoundingClientRect().height);
      if (height > 0) {
        setInventoryRowHeight((prev) => (prev === height ? prev : height));
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, [filteredProducts.length, deferredSearchTerm]);

  const virtualInventory = useVirtualList(inventoryTableRef, {
    itemCount: filteredProducts.length,
    itemHeight: inventoryRowHeight,
    overscan: 10,
  });

  const inventoryNowMs = useMemo(() => Date.now(), [filteredProducts, deferredSearchTerm]);

  const inventoryStats = useMemo(() => {
    const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;
    const totalValue = products.reduce((sum, p) => sum + p.stock * p.purchasePrice, 0);
    const categoryCount = new Set(products.map((p) => p.category)).size;
    const lowStockShare =
      products.length > 0 ? Math.round((lowStockCount / products.length) * 1000) / 10 : 0;
    return { total: products.length, lowStockCount, totalValue, categoryCount, lowStockShare };
  }, [products]);

  const visibleInventoryProducts = useMemo(
    () => filteredProducts.slice(virtualInventory.start, virtualInventory.end),
    [filteredProducts, virtualInventory.end, virtualInventory.start]
  );

  const enrichInventoryProduct = useCallback(
    (product: Product): Product => ({
      ...product,
      minStock: Number(product.minStock) || 0,
      manufacturer:
        product.manufacturer?.trim() ||
        manufacturerNameById.get(product.manufacturerId || "") ||
        undefined,
    }),
    [manufacturerNameById]
  );

  const rowActionsRef = useRef({
    openEditModal,
    openLotsModal,
    handleDelete,
  });
  rowActionsRef.current = { openEditModal, openLotsModal, handleDelete };

  const handleRowEdit = useCallback((product: Product) => {
    rowActionsRef.current.openEditModal(product);
  }, []);

  const handleRowLots = useCallback((product: Product) => {
    rowActionsRef.current.openLotsModal(product);
  }, []);

  const handleRowDelete = useCallback((code: string) => {
    rowActionsRef.current.handleDelete(code);
  }, []);

  const inventoryLabels = useMemo(
    () => ({
      noLots: t("inventory.noLots"),
      edit: t("inventory.edit"),
      lots: t("inventory.lots"),
      delete: t("inventory.delete"),
    }),
    [t]
  );

  return (
    <>
      <div className="inventory-page">
        <header className="inventory-page-hero card-glass">
          <div className="inventory-page-hero-glow" aria-hidden="true" />
          <div className="inventory-page-hero-main">
            <div className="inventory-page-hero-icon" aria-hidden="true">
              <BoxIcon size={26} />
            </div>
            <div className="inventory-page-hero-body">
              <p className="inventory-page-kicker">{t("inventory.pageKicker")}</p>
              <h2>{t("headers.inventory")}</h2>
              <p>{t("inventory.pageSubtitle")}</p>
            </div>
          </div>
          <div className="inventory-page-stats" role="list" aria-label={t("inventory.statsAria")}>
            <div className="inventory-page-stat inventory-page-stat--total" role="listitem">
              <div className="inventory-page-stat-head">
                <span className="inventory-page-stat-icon">
                  <BoxIcon size={13} />
                </span>
                <span className="inventory-page-stat-label">{t("inventory.statTotalProducts")}</span>
              </div>
              <strong className="inventory-page-stat-value">{inventoryStats.total}</strong>
            </div>
            <div
              className={`inventory-page-stat inventory-page-stat--low${inventoryStats.lowStockCount > 0 ? " is-alert" : ""}`}
              role="listitem"
            >
              <div className="inventory-page-stat-head">
                <span className="inventory-page-stat-icon">
                  <AlertIcon size={13} />
                </span>
                <span className="inventory-page-stat-label">{t("inventory.statLowStock")}</span>
              </div>
              <strong className="inventory-page-stat-value">{inventoryStats.lowStockCount}</strong>
              {inventoryStats.lowStockCount > 0 && (
                <span className="inventory-page-stat-meta">
                  {t("inventory.statLowStockShare", { pct: inventoryStats.lowStockShare })}
                </span>
              )}
            </div>
            <div className="inventory-page-stat inventory-page-stat--value" role="listitem">
              <div className="inventory-page-stat-head">
                <span className="inventory-page-stat-icon">
                  <ChartIcon size={13} />
                </span>
                <span className="inventory-page-stat-label">{t("inventory.statTotalValue")}</span>
              </div>
              <strong className="inventory-page-stat-value inventory-page-stat-value--money">
                {formatMoney(inventoryStats.totalValue)}
              </strong>
            </div>
            <div className="inventory-page-stat inventory-page-stat--cat" role="listitem">
              <div className="inventory-page-stat-head">
                <span className="inventory-page-stat-icon">
                  <LayersIcon size={13} />
                </span>
                <span className="inventory-page-stat-label">{t("inventory.statCategories")}</span>
              </div>
              <strong className="inventory-page-stat-value">{inventoryStats.categoryCount}</strong>
            </div>
          </div>
        </header>

        <div className="inventory-panel card-glass">
          <div className="inventory-toolbar">
            <label className="inventory-search-wrap">
              <SearchIcon size={16} />
              <input
                type="text"
                className="inventory-search-input"
                placeholder={t("inventory.searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </label>
            <div className="inventory-toolbar-actions">
              <button type="button" className="btn btn-secondary inventory-import-btn" onClick={onImport1000Products}>
                <BookIcon size={14} />
                {locale === "en" ? t("inventory.loadCatalog1000Usa") : t("inventory.loadCatalog1000")}
              </button>
              <button type="button" className="btn btn-primary inventory-add-btn" onClick={openAddModal}>
                <PlusIcon size={16} />
                {t("inventory.registerProduct")}
              </button>
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="inventory-empty-state">
              <div className="inventory-empty-icon">
                <BoxIcon size={24} />
              </div>
              <p className="inventory-empty-title">{t("inventory.noProducts")}</p>
              <button type="button" className="btn btn-primary" onClick={openAddModal}>
                <PlusIcon size={15} /> {t("inventory.registerProduct")}
              </button>
            </div>
          ) : (
            <>
              <div
                ref={inventoryTableRef}
                className="inventory-table-wrap"
              >
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th className="inventory-col-code">{t("inventory.colCode")}</th>
                      <th>{t("inventory.colImage")}</th>
                      <th>{t("inventory.colName")}</th>
                      <th>{t("inventory.colCategory")}</th>
                      <th>{t("inventory.colManufacturer")}</th>
                      <th className="inventory-col-money">{t("inventory.colCost")}</th>
                      <th className="inventory-col-money">{t("inventory.colPrice")}</th>
                      <th className="inventory-col-num">{t("inventory.colStock")}</th>
                      <th className="inventory-col-num">{t("inventory.colMinStock")}</th>
                      <th>{t("inventory.colExpiry")}</th>
                      <th className="inventory-col-actions">{t("inventory.colActions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {virtualInventory.padding.top > 0 && (
                      <tr className="inventory-virtual-spacer" aria-hidden="true">
                        <td colSpan={11} style={{ height: virtualInventory.padding.top, padding: 0, border: 0 }} />
                      </tr>
                    )}
                    {visibleInventoryProducts.map((p, index) => (
                      <InventoryTableRow
                        key={p.code}
                        ref={index === 0 ? inventoryMeasureRowRef : undefined}
                        product={enrichInventoryProduct(p)}
                        nextLotExpiry={lotExpiryByProduct.get(p.code) ?? null}
                        nowMs={inventoryNowMs}
                        noLotsLabel={inventoryLabels.noLots}
                        editLabel={inventoryLabels.edit}
                        lotsLabel={inventoryLabels.lots}
                        deleteLabel={inventoryLabels.delete}
                        formatMoney={formatMoney}
                        onEdit={handleRowEdit}
                        onLots={handleRowLots}
                        onDelete={handleRowDelete}
                      />
                    ))}
                    {virtualInventory.padding.bottom > 0 && (
                      <tr className="inventory-virtual-spacer" aria-hidden="true">
                        <td colSpan={11} style={{ height: virtualInventory.padding.bottom, padding: 0, border: 0 }} />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <footer className="inventory-table-footer">
                {t("inventory.showingCount", { count: filteredProducts.length, total: products.length })}
              </footer>
            </>
          )}
        </div>
      </div>

    {isModalOpen && (
        <div className="modal-overlay product-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="product-modal" onClick={(e) => e.stopPropagation()}>
            <header className="product-modal-header">
              <div className="product-modal-header-main">
                <div className="product-modal-icon">
                  <BoxIcon size={20} />
                </div>
                <div>
                  <p className="product-modal-kicker">
                    {editingProduct ? t("inventory.editProduct") : t("inventory.newProduct")}
                  </p>
                  <h3>{editingProduct ? t("inventory.editProduct") : t("inventory.newProduct")}</h3>
                  <p className="product-modal-subtitle">
                    {editingProduct ? t("inventory.editSubtitle") : t("inventory.newSubtitle")}
                  </p>
                </div>
              </div>
              <button type="button" className="modal-close product-modal-close" onClick={() => setIsModalOpen(false)}>
                ×
              </button>
            </header>

            <form className="product-modal-body" onSubmit={handleSave}>
              <section className="product-modal-section">
                <h4 className="product-modal-section-title">{t("inventory.sectionIdentity")}</h4>
                <div className="product-modal-grid">
                  <div className="form-group">
                    <label>{t("inventory.barcode")}</label>
                    <input
                      type="text"
                      className="form-control product-modal-input"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      disabled={!!editingProduct}
                      placeholder={t("inventory.barcodePlaceholder")}
                      required
                    />
                  </div>
                  <div className="form-group product-modal-field--wide">
                    <label>{t("inventory.productName")}</label>
                    <input
                      type="text"
                      className="form-control product-modal-input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t("inventory.productNamePlaceholder")}
                      required
                    />
                  </div>
                </div>
              </section>

              <section className="product-modal-section">
                <h4 className="product-modal-section-title">{t("inventory.sectionImage")}</h4>
                <p className="product-modal-section-hint">{t("inventory.imageHint")}</p>
                <div className="product-image-zone">
                  {image ? (
                    <div className="product-image-preview">
                      <img src={image} alt={name || "Preview"} />
                      <button type="button" className="product-image-remove" onClick={() => setImage("")} aria-label={t("inventory.delete")}>
                        ×
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="file"
                        accept="image/*"
                        id="product-image-file"
                        className="product-image-file-input"
                        onChange={handleImageUpload}
                      />
                      <label htmlFor="product-image-file" className="product-image-upload-btn">
                        <span className="product-image-upload-icon">📁</span>
                        <span>{uploading ? t("inventory.processingImage") : t("inventory.selectImage")}</span>
                      </label>
                    </>
                  )}
                </div>
              </section>

              <section className="product-modal-section">
                <h4 className="product-modal-section-title">{t("inventory.sectionClassification")}</h4>
                <div className="product-modal-select-grid">
                  <SelectField
                    label={t("inventory.category")}
                    value={category}
                    options={categorySelectOptions}
                    onChange={setCategory}
                    placeholder={t("inventory.categoryPlaceholder")}
                    accent="amber"
                  />
                  <SelectField
                    label={t("inventory.manufacturer")}
                    value={manufacturerId}
                    options={manufacturerSelectOptions}
                    onChange={setManufacturerId}
                    placeholder={t("inventory.noManufacturer")}
                    accent="cyan"
                  />
                </div>
                <p className="product-modal-lot-hint">{t("inventory.lotHint")}</p>
              </section>

              <section className="product-modal-section">
                <div className="product-modal-section-head">
                  <h4 className="product-modal-section-title">{t("inventory.sectionPricing")}</h4>
                  {estimatedMargin !== null && (
                    <span className={`product-margin-pill${estimatedMargin < 0 ? " is-negative" : estimatedMargin < 15 ? " is-low" : ""}`}>
                      {t("inventory.margin")}: {estimatedMargin.toFixed(1)}%
                    </span>
                  )}
                </div>
                <div className="product-modal-grid">
                  <div className="form-group">
                    <label>{t("inventory.purchasePrice")}</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control product-modal-input product-modal-input--money"
                      value={purchasePrice}
                      onChange={(e) => setPurchasePrice(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>{t("inventory.sellingPrice")}</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control product-modal-input product-modal-input--money"
                      value={sellingPrice}
                      onChange={(e) => setSellingPrice(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </section>

              <section className="product-modal-section">
                <h4 className="product-modal-section-title">{t("inventory.sectionStock")}</h4>
                <div className="product-modal-grid">
                  <div className="form-group">
                    <label>{t("inventory.initialStock")}</label>
                    <input
                      type="number"
                      className="form-control product-modal-input"
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>{t("inventory.minStock")}</label>
                    <input
                      type="number"
                      className="form-control product-modal-input"
                      value={minStock}
                      onChange={(e) => setMinStock(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </section>

              <footer className="product-modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  {t("inventory.cancel")}
                </button>
                <button type="submit" className="btn btn-primary product-modal-save">
                  {t("inventory.save")}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {isLotsModalOpen && lotsProduct && (() => {
        const totalLotStock = productLots.reduce((sum, l) => sum + l.stock, 0);
        const totalLotValue = productLots.reduce((sum, l) => sum + l.stock * l.purchasePrice, 0);
        const stockMismatch = totalLotStock !== lotsProduct.stock;

        return (
          <>
          <div
            className={`modal-overlay lots-modal-overlay${isAddLotModalOpen ? " is-add-lot-open" : ""}`}
            onClick={() => {
              if (editingLotId) {
                resetLotEdit();
                return;
              }
              if (isAddLotModalOpen) {
                resetAddLotModal();
                return;
              }
              setIsLotsModalOpen(false);
            }}
          >
            <div className="lots-modal" onClick={(e) => e.stopPropagation()}>
              <header className="lots-modal-header">
                <div className="lots-modal-header-main">
                  <div className="lots-modal-icon">
                    <BookIcon size={20} />
                  </div>
                  <div>
                    <p className="lots-modal-kicker">{t("inventory.lotsTitle")}</p>
                    <h3 className="lots-modal-title">{lotsProduct.name}</h3>
                    <p className="lots-modal-subtitle">
                      {t("inventory.lotsSubtitle", { code: lotsProduct.code, category: lotsProduct.category })}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="modal-close lots-modal-close"
                  onClick={() => {
                    resetLotEdit();
                    resetAddLotModal();
                    setIsLotsModalOpen(false);
                  }}
                >
                  ×
                </button>
              </header>

              <div className="lots-modal-body">
                <div className="lots-modal-stats">
                  <div className="lots-stat-card lots-stat-card--cyan">
                    <span>{t("inventory.lotsStatCount")}</span>
                    <strong>{productLots.length}</strong>
                  </div>
                  <div className="lots-stat-card lots-stat-card--amber">
                    <span>{t("inventory.lotsStatLotStock")}</span>
                    <strong>{totalLotStock}</strong>
                  </div>
                  <div className={`lots-stat-card lots-stat-card--magenta${stockMismatch ? " is-alert" : ""}`}>
                    <span>{t("inventory.lotsStatProductStock")}</span>
                    <strong>{lotsProduct.stock}</strong>
                  </div>
                  <div className="lots-stat-card lots-stat-card--green">
                    <span>{t("inventory.lotsStatTotalValue")}</span>
                    <strong>{formatMoney(totalLotValue)}</strong>
                  </div>
                </div>

                {stockMismatch && (
                  <div className="lots-sync-warning" role="alert">
                    {t("inventory.lotsStockMismatch", { product: lotsProduct.stock, lots: totalLotStock })}
                  </div>
                )}

                <section className="lots-modal-section lots-list-section">
                  <div className="lots-section-head">
                    <h4 className="lots-section-title">{t("inventory.lotsSectionRegistered")}</h4>
                    {productLots.length > 0 && (
                      <span className="lots-count-badge">{productLots.length}</span>
                    )}
                  </div>

                  {productLots.length === 0 ? (
                    <div className="lots-empty-state">
                      <div className="lots-empty-icon">
                        <BookIcon size={22} />
                      </div>
                      <p className="lots-empty-title">{t("inventory.lotEmptyTitle")}</p>
                      <p className="lots-empty-hint">{t("inventory.lotEmptyHint")}</p>
                    </div>
                  ) : (
                    <div className="lots-card-grid">
                      {productLots.map((l) => {
                        const expiryDate = new Date(l.expiryDate);
                        const isExpired = expiryDate < new Date();
                        const daysLeft = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        const expiryClass = isExpired
                          ? "lots-pill lots-pill-danger"
                          : daysLeft <= 45
                            ? "lots-pill lots-pill-warning"
                            : "lots-pill lots-pill-ok";
                        const stockRatio = l.initialQty > 0 ? Math.min(100, (l.stock / l.initialQty) * 100) : 0;
                        const stockBarClass =
                          l.stock === 0 ? "is-empty" : stockRatio <= 25 ? "is-low" : "is-ok";

                        return (
                          <article key={l.id} className="lots-card">
                            <div className="lots-card-top">
                              <span className="lots-card-code">{l.lotNumber}</span>
                              <div className="lots-card-actions">
                                <button
                                  type="button"
                                  className="lots-edit-btn-icon"
                                  title={t("inventory.lotEdit")}
                                  onClick={() => startEditLot(l)}
                                >
                                  <EditIcon size={14} />
                                </button>
                                <button
                                  type="button"
                                  className="lots-delete-btn"
                                  title={t("inventory.lotDeleteTitle")}
                                  onClick={() => handleDeleteLot(l.id)}
                                >
                                  <DeleteIcon size={14} />
                                </button>
                              </div>
                            </div>
                            <div className="lots-card-meta">
                              <span className="lots-warehouse-badge">{warehouseName(l.warehouseId)}</span>
                              <span className={expiryClass}>
                                {isoToDisplay(l.expiryDate)}
                                {isExpired
                                  ? ` · ${t("inventory.lotExpiryExpired")}`
                                  : daysLeft <= 45
                                    ? ` · ${t("inventory.lotExpiryDays", { days: daysLeft })}`
                                    : ""}
                              </span>
                            </div>
                            <div className="lots-card-metrics">
                              <div>
                                <span>{t("inventory.lotUnitCost")}</span>
                                <strong>{formatMoney(l.purchasePrice)}</strong>
                              </div>
                              <div>
                                <span>{t("inventory.lotQuantity")}</span>
                                <strong>
                                  {l.stock} / {l.initialQty}
                                </strong>
                              </div>
                            </div>
                            <div className="lots-stock-bar">
                              <div className={`lots-stock-bar-fill ${stockBarClass}`} style={{ width: `${stockRatio}%` }} />
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>

              <footer className="lots-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    resetLotEdit();
                    resetAddLotModal();
                    setIsLotsModalOpen(false);
                  }}
                >
                  {t("inventory.lotsClose")}
                </button>
                <button
                  type="button"
                  className={`btn btn-primary lots-footer-add-btn${isAddLotLaunching ? " is-launching" : ""}`}
                  onClick={openAddLotModal}
                >
                  <PlusIcon size={15} /> {t("inventory.lotAdd")}
                </button>
              </footer>
            </div>
          </div>

          {isAddLotModalOpen && (
            <div className="modal-overlay lot-add-modal-overlay" onClick={resetAddLotModal}>
              <div className="lot-add-modal" onClick={(e) => e.stopPropagation()}>
                <header className="lot-add-modal-header">
                  <div className="lot-add-modal-header-main">
                    <div className="lot-add-modal-icon">
                      <PlusIcon size={18} />
                    </div>
                    <div>
                      <p className="lot-add-modal-kicker">{t("inventory.lotAddTitle")}</p>
                      <h3>{t("inventory.lotAdd")}</h3>
                      <p className="lot-add-modal-subtitle">
                        {t("inventory.lotAddSubtitle", {
                          product: lotsProduct.name,
                          code: lotsProduct.code,
                        })}
                      </p>
                    </div>
                  </div>
                  <button type="button" className="modal-close lot-add-modal-close" onClick={resetAddLotModal}>
                    ×
                  </button>
                </header>

                <form className="lot-add-modal-body" onSubmit={handleAddLotSubmit}>
                  <section className="lot-add-modal-section">
                    <div className="lot-add-modal-grid">
                      <div className="form-group">
                        <label>{t("inventory.lotCode")}</label>
                        <input
                          type="text"
                          className="form-control product-modal-input"
                          placeholder={t("inventory.lotCodePlaceholder")}
                          value={newLotNumber}
                          onChange={(e) => setNewLotNumber(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>{t("inventory.lotExpiry")}</label>
                        <input
                          type="text"
                          className="form-control product-modal-input"
                          placeholder={t("inventory.lotExpiryPlaceholder")}
                          inputMode="numeric"
                          value={newLotExpiry}
                          onChange={(e) => setNewLotExpiry(e.target.value)}
                          onBlur={() => {
                            const parsed = parseDisplayDate(newLotExpiry);
                            if (parsed) setNewLotExpiry(isoToDisplay(parsed));
                          }}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>{t("inventory.lotUnitCost")}</label>
                        <input
                          type="number"
                          step="0.01"
                          className="form-control product-modal-input product-modal-input--money"
                          value={newLotCost}
                          onChange={(e) => setNewLotCost(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>{t("inventory.lotQuantity")}</label>
                        <input
                          type="number"
                          className="form-control product-modal-input"
                          value={newLotStock}
                          onChange={(e) => setNewLotStock(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group lot-add-modal-field--wide">
                        <SelectField
                          label={t("inventory.lotWarehouse")}
                          value={newLotWarehouseId}
                          options={warehouseSelectOptions}
                          onChange={setNewLotWarehouseId}
                          accent="cyan"
                          placeholder={t("inventory.lotWarehouse")}
                        />
                      </div>
                    </div>
                  </section>

                  <footer className="lot-add-modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={resetAddLotModal}>
                      {t("inventory.lotCancelEdit")}
                    </button>
                    <button type="submit" className="btn btn-primary lot-add-modal-save">
                      <PlusIcon size={15} /> {t("inventory.lotAdd")}
                    </button>
                  </footer>
                </form>
              </div>
            </div>
          )}

          {editingLotId && (
            <div className="modal-overlay lot-edit-modal-overlay" onClick={resetLotEdit}>
              <div className="lot-edit-modal" onClick={(e) => e.stopPropagation()}>
                <header className="lot-edit-modal-header">
                  <div className="lot-edit-modal-header-main">
                    <div className="lot-edit-modal-icon">
                      <EditIcon size={18} />
                    </div>
                    <div>
                      <p className="lot-edit-modal-kicker">{t("inventory.lotEditTitle")}</p>
                      <h3>{editLotDraft.lotNumber || t("inventory.lotEdit")}</h3>
                      <p className="lot-edit-modal-subtitle">
                        {t("inventory.lotEditSubtitle", {
                          product: lotsProduct.name,
                          lot: editLotDraft.lotNumber,
                        })}
                      </p>
                    </div>
                  </div>
                  <button type="button" className="modal-close lot-edit-modal-close" onClick={resetLotEdit}>
                    ×
                  </button>
                </header>

                <form className="lot-edit-modal-body" onSubmit={handleSaveLotEdit}>
                  <section className="lot-edit-modal-section">
                    <div className="lot-edit-modal-grid">
                      <div className="form-group">
                        <label>{t("inventory.lotCode")}</label>
                        <input
                          type="text"
                          className="form-control product-modal-input"
                          placeholder={t("inventory.lotCodePlaceholder")}
                          value={editLotDraft.lotNumber}
                          onChange={(e) => setEditLotDraft((d) => ({ ...d, lotNumber: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>{t("inventory.lotExpiry")}</label>
                        <input
                          type="text"
                          className="form-control product-modal-input"
                          placeholder={t("inventory.lotExpiryPlaceholder")}
                          inputMode="numeric"
                          value={editLotDraft.expiry}
                          onChange={(e) => setEditLotDraft((d) => ({ ...d, expiry: e.target.value }))}
                          onBlur={() => {
                            const parsed = parseDisplayDate(editLotDraft.expiry);
                            if (parsed) setEditLotDraft((d) => ({ ...d, expiry: isoToDisplay(parsed) }));
                          }}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>{t("inventory.lotUnitCost")}</label>
                        <input
                          type="number"
                          step="0.01"
                          className="form-control product-modal-input product-modal-input--money"
                          value={editLotDraft.cost}
                          onChange={(e) => setEditLotDraft((d) => ({ ...d, cost: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>{t("inventory.lotCurrentStock")}</label>
                        <input
                          type="number"
                          className="form-control product-modal-input"
                          value={editLotDraft.stock}
                          onChange={(e) => setEditLotDraft((d) => ({ ...d, stock: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>{t("inventory.lotInitialQty")}</label>
                        <input
                          type="number"
                          className="form-control product-modal-input"
                          value={editLotDraft.initialQty}
                          onChange={(e) => setEditLotDraft((d) => ({ ...d, initialQty: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="form-group lot-edit-modal-field--wide">
                        <SelectField
                          label={t("inventory.lotWarehouse")}
                          value={editLotDraft.warehouseId}
                          options={warehouseSelectOptions}
                          onChange={(value) => setEditLotDraft((d) => ({ ...d, warehouseId: value }))}
                          accent="cyan"
                          placeholder={t("inventory.lotWarehouse")}
                        />
                      </div>
                    </div>
                  </section>

                  <footer className="lot-edit-modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={resetLotEdit}>
                      {t("inventory.lotCancelEdit")}
                    </button>
                    <button type="submit" className="btn btn-primary lot-edit-modal-save">
                      {t("inventory.lotSaveEdit")}
                    </button>
                  </footer>
                </form>
              </div>
            </div>
          )}
          </>
        );
      })()}
    </>
  );
};
