import React, { useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n";
import { getDefaultWarehouse, getLocalizedWarehouseName } from "../utils/catalogHelpers";
import type { Category, CatalogTab, StorageLocation, Warehouse } from "../types/catalog";
import type { Manufacturer } from "../types/inventory";
import type { Supplier } from "../types/stock";
import { PlusIcon, EditIcon } from "./Icons";

interface CatalogManagerProps {
  categories: Category[];
  suppliers: Supplier[];
  manufacturers: Manufacturer[];
  warehouses: Warehouse[];
  locations: StorageLocation[];
  onSaveCategory: (input: { id?: string; name: string; description?: string; sortOrder?: number; active?: boolean }) => void;
  onDeleteCategory: (id: string) => void;
  onMergeCategories: (targetId: string, sourceIds: string[]) => void;
  onSaveSupplier: (input: Partial<Supplier> & { name: string }) => void;
  onToggleSupplier: (id: string, active: boolean) => void;
  onSaveManufacturer: (input: Partial<Manufacturer> & { name: string }) => void;
  onToggleManufacturer: (id: string, active: boolean) => void;
  onSaveWarehouse: (input: { id?: string; name: string; address?: string; notes?: string; isDefault?: boolean }) => void;
  onDeleteWarehouse: (id: string) => void;
  onSaveLocation: (input: { id?: string; name: string; description?: string }) => void;
  onToggleLocation: (id: string, active: boolean) => void;
}

const TAB_IDS: CatalogTab[] = ["categorias", "proveedores", "fabricantes", "almacenes", "ubicaciones"];

const TAB_LABELS: Record<CatalogTab, { new: string; edit: string; entity: string }> = {
  categorias: { new: "Nueva categoría", edit: "Editar categoría", entity: "categoría" },
  proveedores: { new: "Nuevo proveedor", edit: "Editar proveedor", entity: "proveedor" },
  fabricantes: { new: "Nuevo fabricante", edit: "Editar fabricante", entity: "fabricante" },
  almacenes: { new: "Nuevo almacén", edit: "Editar almacén", entity: "almacén" },
  ubicaciones: { new: "Nueva ubicación", edit: "Editar ubicación", entity: "ubicación" },
};

const emptySupplier = (): Partial<Supplier> => ({
  name: "",
  ruc: "",
  phone: "",
  email: "",
  contact: "",
  address: "",
  notes: "",
  active: true,
});

const emptyManufacturer = (): Partial<Manufacturer> => ({
  name: "",
  ruc: "",
  phone: "",
  email: "",
  contact: "",
  notes: "",
  active: true,
});

export const CatalogManager: React.FC<CatalogManagerProps> = ({
  categories,
  suppliers,
  manufacturers,
  warehouses,
  locations,
  onSaveCategory,
  onDeleteCategory,
  onMergeCategories,
  onSaveSupplier,
  onToggleSupplier,
  onSaveManufacturer,
  onToggleManufacturer,
  onSaveWarehouse,
  onDeleteWarehouse,
  onSaveLocation,
  onToggleLocation,
}) => {
  const { t } = useI18n();
  const tabs = useMemo(
    () =>
      TAB_IDS.map((id) => ({
        id,
        label:
          id === "categorias"
            ? t("catalog.tabCategories")
            : id === "proveedores"
              ? t("catalog.tabSuppliers")
              : id === "fabricantes"
                ? t("catalog.tabManufacturers")
                : id === "almacenes"
                  ? t("catalog.tabWarehouses")
                  : t("catalog.tabLocations"),
        hint:
          id === "categorias"
            ? t("catalog.tabCategoriesHint")
            : id === "proveedores"
              ? t("catalog.tabSuppliersHint")
              : id === "fabricantes"
                ? t("catalog.tabManufacturersHint")
                : id === "almacenes"
                  ? t("catalog.tabWarehousesHint")
                  : t("catalog.tabLocationsHint"),
      })),
    [t]
  );
  const [tab, setTab] = useState<CatalogTab>("categorias");
  const [status, setStatus] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");
  const [mergeSourceId, setMergeSourceId] = useState("");
  const [mergeTargetId, setMergeTargetId] = useState("");

  const [supplierForm, setSupplierForm] = useState<Partial<Supplier>>(emptySupplier());
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);

  const [mfgForm, setMfgForm] = useState<Partial<Manufacturer>>(emptyManufacturer());
  const [editingMfgId, setEditingMfgId] = useState<string | null>(null);

  const [whName, setWhName] = useState("");
  const [whAddress, setWhAddress] = useState("");
  const [whDefault, setWhDefault] = useState(false);
  const [editingWhId, setEditingWhId] = useState<string | null>(null);

  const [locName, setLocName] = useState("");
  const [locDesc, setLocDesc] = useState("");
  const [editingLocId, setEditingLocId] = useState<string | null>(null);

  const activeTabMeta = tabs.find((item) => item.id === tab)!;
  const mainWarehouse = useMemo(() => getDefaultWarehouse(warehouses), [warehouses]);
  const tabLabels = TAB_LABELS[tab];
  const isEditing =
    Boolean(editingCategoryId || editingSupplierId || editingMfgId || editingWhId || editingLocId);

  const activeCategories = useMemo(
    () => [...categories].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [categories]
  );

  const activeSuppliers = useMemo(
    () => [...suppliers].sort((a, b) => a.name.localeCompare(b.name)),
    [suppliers]
  );

  const activeManufacturers = useMemo(
    () => [...manufacturers].sort((a, b) => a.name.localeCompare(b.name)),
    [manufacturers]
  );

  const activeWarehouses = useMemo(
    () => warehouses.filter((w) => w.active),
    [warehouses]
  );

  const secondaryWarehouses = useMemo(
    () => activeWarehouses.filter((w) => !w.isDefault),
    [activeWarehouses]
  );

  const tabCounts = useMemo(
    () => ({
      categorias: activeCategories.length,
      proveedores: activeSuppliers.length,
      fabricantes: activeManufacturers.length,
      almacenes: activeWarehouses.length,
      ubicaciones: locations.length,
    }),
    [activeCategories, activeSuppliers, activeManufacturers, activeWarehouses, locations]
  );

  const rowCount = useMemo(() => {
    switch (tab) {
      case "categorias": return activeCategories.length;
      case "proveedores": return activeSuppliers.length;
      case "fabricantes": return activeManufacturers.length;
      case "almacenes": return activeWarehouses.length;
      case "ubicaciones": return locations.length;
    }
  }, [tab, activeCategories, activeSuppliers, activeManufacturers, activeWarehouses, locations]);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  const flash = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(null), 2800);
  };

  const resetForms = () => {
    setEditingCategoryId(null);
    setCatName("");
    setCatDesc("");
    setEditingSupplierId(null);
    setSupplierForm(emptySupplier());
    setEditingMfgId(null);
    setMfgForm(emptyManufacturer());
    setEditingWhId(null);
    setWhName("");
    setWhAddress("");
    setWhDefault(false);
    setEditingLocId(null);
    setLocName("");
    setLocDesc("");
  };

  const closeModal = () => {
    setModalOpen(false);
    resetForms();
  };

  const openNewModal = () => {
    resetForms();
    setModalOpen(true);
  };

  const openEditCategory = (c: Category) => {
    resetForms();
    setEditingCategoryId(c.id);
    setCatName(c.name);
    setCatDesc(c.description || "");
    setModalOpen(true);
  };

  const openEditSupplier = (s: Supplier) => {
    resetForms();
    setEditingSupplierId(s.id);
    setSupplierForm({ ...s });
    setModalOpen(true);
  };

  const openEditManufacturer = (m: Manufacturer) => {
    resetForms();
    setEditingMfgId(m.id);
    setMfgForm({ ...m });
    setModalOpen(true);
  };

  const setAsMainWarehouse = (w: Warehouse) => {
    try {
      onSaveWarehouse({
        id: w.id,
        name: w.name,
        address: w.address,
        notes: w.notes,
        isDefault: true,
      });
      flash(t("catalog.warehousesMainSet"));
    } catch (err) {
      flash(`❌ ${(err as Error).message}`);
    }
  };

  const openEditWarehouse = (w: Warehouse) => {
    resetForms();
    setEditingWhId(w.id);
    setWhName(w.name);
    setWhAddress(w.address || "");
    setWhDefault(w.isDefault);
    setModalOpen(true);
  };

  const openEditLocation = (l: StorageLocation) => {
    resetForms();
    setEditingLocId(l.id);
    setLocName(l.name);
    setLocDesc(l.description || "");
    setModalOpen(true);
  };

  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (tab === "categorias") {
        onSaveCategory({ id: editingCategoryId || undefined, name: catName, description: catDesc || undefined });
        flash(isEditing ? t("catalog.categoryUpdated") : t("catalog.categoryCreated"));
      } else if (tab === "proveedores") {
        onSaveSupplier({ ...supplierForm, id: editingSupplierId || undefined, name: (supplierForm.name || "").trim() });
        flash(isEditing ? "Proveedor actualizado." : "Proveedor creado.");
      } else if (tab === "fabricantes") {
        onSaveManufacturer({ ...mfgForm, id: editingMfgId || undefined, name: (mfgForm.name || "").trim() });
        flash(isEditing ? "Fabricante actualizado." : "Fabricante creado.");
      } else if (tab === "almacenes") {
        onSaveWarehouse({ id: editingWhId || undefined, name: whName, address: whAddress || undefined, isDefault: whDefault });
        flash(isEditing ? t("catalog.warehousesUpdated") : t("catalog.warehousesCreated"));
      } else {
        onSaveLocation({ id: editingLocId || undefined, name: locName, description: locDesc || undefined });
        flash(isEditing ? "Ubicación actualizada." : "Ubicación creada.");
      }
      closeModal();
    } catch (err) {
      flash(`❌ ${(err as Error).message}`);
    }
  };

  const handleMerge = () => {
    if (!mergeTargetId || !mergeSourceId || mergeTargetId === mergeSourceId) {
      flash(t("catalog.mergeSelectDistinct"));
      return;
    }
    try {
      onMergeCategories(mergeTargetId, [mergeSourceId]);
      flash(t("catalog.mergeSuccess"));
      setMergeSourceId("");
      setMergeTargetId("");
      setMergeOpen(false);
    } catch (err) {
      flash(`❌ ${(err as Error).message}`);
    }
  };

  const renderModalFields = () => {
    if (tab === "categorias") {
      return (
        <div className="catalog-modal-grid">
          <div className="catalog-modal-field">
            <label>Nombre</label>
            <input className="catalog-modal-input" value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="Ej: Bebidas" autoFocus required />
          </div>
          <div className="catalog-modal-field">
            <label>Descripción</label>
            <input className="catalog-modal-input" value={catDesc} onChange={(e) => setCatDesc(e.target.value)} placeholder="Opcional" />
          </div>
        </div>
      );
    }

    if (tab === "proveedores") {
      return (
        <div className="catalog-modal-grid catalog-modal-grid--3">
          <div className="catalog-modal-field"><label>Nombre *</label><input className="catalog-modal-input" value={supplierForm.name || ""} onChange={(e) => setSupplierForm((p) => ({ ...p, name: e.target.value }))} autoFocus required /></div>
          <div className="catalog-modal-field"><label>RUC</label><input className="catalog-modal-input" value={supplierForm.ruc || ""} onChange={(e) => setSupplierForm((p) => ({ ...p, ruc: e.target.value }))} /></div>
          <div className="catalog-modal-field"><label>Teléfono</label><input className="catalog-modal-input" value={supplierForm.phone || ""} onChange={(e) => setSupplierForm((p) => ({ ...p, phone: e.target.value }))} /></div>
          <div className="catalog-modal-field"><label>Contacto</label><input className="catalog-modal-input" value={supplierForm.contact || ""} onChange={(e) => setSupplierForm((p) => ({ ...p, contact: e.target.value }))} /></div>
          <div className="catalog-modal-field"><label>Email</label><input className="catalog-modal-input" type="email" value={supplierForm.email || ""} onChange={(e) => setSupplierForm((p) => ({ ...p, email: e.target.value }))} /></div>
          <div className="catalog-modal-field"><label>Dirección</label><input className="catalog-modal-input" value={supplierForm.address || ""} onChange={(e) => setSupplierForm((p) => ({ ...p, address: e.target.value }))} /></div>
          <div className="catalog-modal-field catalog-modal-field--wide"><label>Notas</label><input className="catalog-modal-input" value={supplierForm.notes || ""} onChange={(e) => setSupplierForm((p) => ({ ...p, notes: e.target.value }))} /></div>
        </div>
      );
    }

    if (tab === "fabricantes") {
      return (
        <div className="catalog-modal-grid catalog-modal-grid--3">
          <div className="catalog-modal-field"><label>Nombre *</label><input className="catalog-modal-input" value={mfgForm.name || ""} onChange={(e) => setMfgForm((p) => ({ ...p, name: e.target.value }))} autoFocus required /></div>
          <div className="catalog-modal-field"><label>RUC</label><input className="catalog-modal-input" value={mfgForm.ruc || ""} onChange={(e) => setMfgForm((p) => ({ ...p, ruc: e.target.value }))} /></div>
          <div className="catalog-modal-field"><label>Teléfono</label><input className="catalog-modal-input" value={mfgForm.phone || ""} onChange={(e) => setMfgForm((p) => ({ ...p, phone: e.target.value }))} /></div>
          <div className="catalog-modal-field"><label>Contacto</label><input className="catalog-modal-input" value={mfgForm.contact || ""} onChange={(e) => setMfgForm((p) => ({ ...p, contact: e.target.value }))} /></div>
          <div className="catalog-modal-field"><label>Email</label><input className="catalog-modal-input" type="email" value={mfgForm.email || ""} onChange={(e) => setMfgForm((p) => ({ ...p, email: e.target.value }))} /></div>
          <div className="catalog-modal-field catalog-modal-field--wide"><label>Notas</label><input className="catalog-modal-input" value={mfgForm.notes || ""} onChange={(e) => setMfgForm((p) => ({ ...p, notes: e.target.value }))} /></div>
        </div>
      );
    }

    if (tab === "almacenes") {
      return (
        <>
          <div className="catalog-modal-grid">
            <div className="catalog-modal-field">
              <label>{t("catalog.warehousesName")}</label>
              <input
                className="catalog-modal-input"
                value={whName}
                onChange={(e) => setWhName(e.target.value)}
                placeholder={t("catalog.warehousesNamePlaceholder")}
                autoFocus
                required
              />
            </div>
            <div className="catalog-modal-field">
              <label>{t("catalog.warehousesAddress")}</label>
              <input
                className="catalog-modal-input"
                value={whAddress}
                onChange={(e) => setWhAddress(e.target.value)}
                placeholder={t("catalog.warehousesAddressPlaceholder")}
              />
            </div>
          </div>
          <button
            type="button"
            className={`catalog-wh-default-toggle${whDefault ? " is-on" : ""}`}
            onClick={() => setWhDefault((prev) => !prev)}
          >
            <span className="catalog-wh-default-toggle-icon">{whDefault ? "★" : "○"}</span>
            <span className="catalog-wh-default-toggle-copy">
              <strong>{t("catalog.warehousesMarkAsMain")}</strong>
              <small>{t("catalog.warehousesMarkAsMainHint")}</small>
            </span>
          </button>
        </>
      );
    }

    return (
      <div className="catalog-modal-grid">
        <div className="catalog-modal-field"><label>Nombre</label><input className="catalog-modal-input" value={locName} onChange={(e) => setLocName(e.target.value)} placeholder="Ej: Estante A1" autoFocus required /></div>
        <div className="catalog-modal-field"><label>Descripción</label><input className="catalog-modal-input" value={locDesc} onChange={(e) => setLocDesc(e.target.value)} placeholder="Opcional" /></div>
      </div>
    );
  };

  return (
    <div className="catalog-manager">
      <div className="catalog-tabs">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`catalog-tab catalog-tab--${item.id} ${tab === item.id ? "active" : ""}`}
            onClick={() => {
              setTab(item.id);
              setMergeOpen(false);
            }}
          >
            <div className="catalog-tab-head">
              <strong>{item.label}</strong>
              <span className="catalog-tab-count">{tabCounts[item.id]}</span>
            </div>
            <span className="catalog-tab-hint">{item.hint}</span>
          </button>
        ))}
      </div>

      <div className={`catalog-toolbar catalog-toolbar--${tab}`}>
        <div className="catalog-toolbar-main">
          <p className="catalog-toolbar-kicker">{activeTabMeta.label}</p>
          <h3>{activeTabMeta.label}</h3>
          <p>
            {rowCount === 1
              ? t("catalog.records", { count: rowCount })
              : t("catalog.records_plural", { count: rowCount })}
          </p>
        </div>
        <div className="catalog-toolbar-actions">
          {status && <span className="catalog-manager-status">{status}</span>}
          {tab === "categorias" && (
            <button
              type="button"
              className={`btn btn-secondary btn-sm catalog-merge-toggle${mergeOpen ? " is-open" : ""}`}
              onClick={() => setMergeOpen((v) => !v)}
            >
              {t("catalog.merge")}
            </button>
          )}
          <button type="button" className="btn btn-primary catalog-new-btn" onClick={openNewModal}>
            <PlusIcon size={16} /> {t("catalog.new")}
          </button>
        </div>
      </div>

      {tab === "categorias" && mergeOpen && (
        <div className="catalog-merge-panel">
          <div className="catalog-merge-copy">
            <h4>{t("catalog.mergeTitle")}</h4>
            <p>{t("catalog.mergeHint")}</p>
          </div>
          <div className="catalog-merge-fields">
            <div>
              <label>{t("catalog.mergeTarget")}</label>
              <select className="catalog-modal-input" value={mergeTargetId} onChange={(e) => setMergeTargetId(e.target.value)}>
                <option value="">{t("common.selectPlaceholder")}</option>
                {activeCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label>{t("catalog.mergeSource")}</label>
              <select className="catalog-modal-input" value={mergeSourceId} onChange={(e) => setMergeSourceId(e.target.value)}>
                <option value="">{t("common.selectPlaceholder")}</option>
                {activeCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <button type="button" className="btn btn-primary btn-sm catalog-merge-confirm" onClick={handleMerge}>
              {t("catalog.mergeConfirm")}
            </button>
          </div>
        </div>
      )}

      <section className="catalog-panel card-glass">
        {tab === "categorias" && (
          <div className="catalog-entity-grid catalog-entity-grid--cat">
            {activeCategories.map((c) => (
              <article className="catalog-entity-card catalog-entity-card--cat" key={c.id}>
                <div className="catalog-entity-card-top">
                  <div className="catalog-list-avatar catalog-list-avatar--cat">{c.name.charAt(0).toUpperCase()}</div>
                  <span className={`catalog-badge ${c.active ? "ok" : "off"}`}>
                    {c.active ? t("catalog.active") : t("catalog.inactive")}
                  </span>
                </div>
                <div className="catalog-entity-card-body">
                  <strong>{c.name}</strong>
                  <span>{c.description || "—"}</span>
                  <code className="catalog-entity-slug">{c.slug}</code>
                </div>
                <div className="catalog-entity-card-actions">
                  <button type="button" className="catalog-icon-btn" title={t("catalog.edit")} onClick={() => openEditCategory(c)}>
                    <EditIcon size={15} />
                  </button>
                  <button
                    type="button"
                    className="catalog-icon-btn catalog-icon-btn--danger"
                    title={t("catalog.delete")}
                    onClick={() => {
                      if (confirm(t("catalog.deleteCategoryConfirm", { name: c.name }))) onDeleteCategory(c.id);
                    }}
                  >
                    ×
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {tab === "proveedores" && (
          <div className="catalog-entity-grid catalog-entity-grid--sup">
            {activeSuppliers.map((s) => (
              <article className="catalog-entity-card catalog-entity-card--sup" key={s.id}>
                <div className="catalog-entity-card-top">
                  <div className="catalog-list-avatar catalog-list-avatar--sup">{s.name.charAt(0).toUpperCase()}</div>
                  <span className={`catalog-badge ${s.active !== false ? "ok" : "off"}`}>
                    {s.active !== false ? t("catalog.activeMasc") : t("catalog.inactiveMasc")}
                  </span>
                </div>
                <div className="catalog-entity-card-body">
                  <strong>{s.name}</strong>
                  <span>
                    {[s.ruc && `RUC ${s.ruc}`, s.contact, s.phone].filter(Boolean).join(" · ") || t("catalog.noContact")}
                  </span>
                </div>
                <div className="catalog-entity-card-actions">
                  <button type="button" className="catalog-icon-btn" onClick={() => openEditSupplier(s)}>
                    <EditIcon size={15} />
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => onToggleSupplier(s.id, s.active === false)}>
                    {s.active === false ? t("catalog.activate") : t("catalog.deactivate")}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {tab === "fabricantes" && (
          <div className="catalog-entity-grid catalog-entity-grid--mfg">
            {activeManufacturers.map((m) => (
              <article className="catalog-entity-card catalog-entity-card--mfg" key={m.id}>
                <div className="catalog-entity-card-top">
                  <div className="catalog-list-avatar catalog-list-avatar--mfg">{m.name.charAt(0).toUpperCase()}</div>
                  <span className={`catalog-badge ${m.active ? "ok" : "off"}`}>
                    {m.active ? t("catalog.activeMasc") : t("catalog.inactiveMasc")}
                  </span>
                </div>
                <div className="catalog-entity-card-body">
                  <strong>{m.name}</strong>
                  <span>
                    {[m.ruc && `RUC ${m.ruc}`, m.contact, m.phone].filter(Boolean).join(" · ") || t("catalog.noContact")}
                  </span>
                </div>
                <div className="catalog-entity-card-actions">
                  <button type="button" className="catalog-icon-btn" onClick={() => openEditManufacturer(m)}>
                    <EditIcon size={15} />
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => onToggleManufacturer(m.id, !m.active)}>
                    {m.active ? t("catalog.deactivate") : t("catalog.activate")}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {tab === "almacenes" && (
          <div className="catalog-wh-layout">
            {mainWarehouse && (
              <section className="catalog-wh-main-panel">
                <div className="catalog-wh-main-panel-accent" />
                <div className="catalog-wh-main-panel-body">
                  <div className="catalog-wh-main-icon">★</div>
                  <div className="catalog-wh-main-copy">
                    <p className="catalog-wh-main-kicker">{t("catalog.warehousesMainTitle")}</p>
                    <h4>{getLocalizedWarehouseName(mainWarehouse, t)}</h4>
                    <p>{mainWarehouse.address || t("catalog.warehousesNoAddress")}</p>
                    <span className="catalog-wh-main-hint">{t("catalog.warehousesMainHint")}</span>
                  </div>
                </div>
                <button type="button" className="btn btn-secondary btn-sm catalog-wh-main-btn" onClick={() => openEditWarehouse(mainWarehouse)}>
                  {t("catalog.warehousesEditMain")}
                </button>
              </section>
            )}

            {secondaryWarehouses.length > 0 ? (
              <>
                <h4 className="catalog-wh-others-title">{t("catalog.warehousesOthersTitle")}</h4>
                <div className="catalog-wh-grid">
                  {secondaryWarehouses.map((w) => (
                    <article key={w.id} className="catalog-wh-card">
                      <div className="catalog-wh-card-top">
                        <div className="catalog-list-avatar catalog-list-avatar--wh">
                          {getLocalizedWarehouseName(w, t).charAt(0).toUpperCase()}
                        </div>
                        <span className="catalog-badge">{t("warehouses.badgeSecondary")}</span>
                      </div>
                      <div className="catalog-wh-card-body">
                        <strong>{getLocalizedWarehouseName(w, t)}</strong>
                        <span>{w.address || t("catalog.warehousesNoAddress")}</span>
                      </div>
                      <div className="catalog-wh-card-actions">
                        <button type="button" className="catalog-icon-btn" title={t("catalog.editWarehouse")} onClick={() => openEditWarehouse(w)}>
                          <EditIcon size={15} />
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm catalog-wh-set-main-btn" onClick={() => setAsMainWarehouse(w)}>
                          {t("catalog.warehousesSetAsMain")}
                        </button>
                        <button
                          type="button"
                          className="catalog-icon-btn catalog-icon-btn--danger"
                          title={t("catalog.close")}
                          onClick={() => {
                            try {
                              onDeleteWarehouse(w.id);
                              flash(t("catalog.warehousesDeleted"));
                            } catch (err) {
                              flash(`❌ ${(err as Error).message}`);
                            }
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <p className="catalog-wh-others-empty">{t("catalog.warehousesOthersEmpty")}</p>
            )}
          </div>
        )}

        {tab === "ubicaciones" && (
          <div className="catalog-entity-grid catalog-entity-grid--loc">
            {locations.map((l) => (
              <article className="catalog-entity-card catalog-entity-card--loc" key={l.id}>
                <div className="catalog-entity-card-top">
                  <div className="catalog-list-avatar catalog-list-avatar--loc">{l.name.charAt(0).toUpperCase()}</div>
                  <span className={`catalog-badge ${l.active ? "ok" : "off"}`}>
                    {l.active ? t("catalog.active") : t("catalog.inactive")}
                  </span>
                </div>
                <div className="catalog-entity-card-body">
                  <strong>{l.name}</strong>
                  <span>{l.description || "—"}</span>
                  <code className="catalog-entity-slug">{l.slug}</code>
                </div>
                <div className="catalog-entity-card-actions">
                  <button type="button" className="catalog-icon-btn" onClick={() => openEditLocation(l)}>
                    <EditIcon size={15} />
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => onToggleLocation(l.id, !l.active)}>
                    {l.active ? t("catalog.deactivate") : t("catalog.activate")}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {rowCount === 0 && tab !== "almacenes" && (
          <div className="catalog-empty">
            <p>{t("catalog.emptyRecords")}</p>
            <button type="button" className="btn btn-primary btn-sm" onClick={openNewModal}>
              <PlusIcon size={14} /> {t("catalog.createFirst")}
            </button>
          </div>
        )}
      </section>

      {modalOpen && (
        <div className="modal-overlay catalog-modal-overlay" onMouseDown={closeModal}>
          <div className="catalog-modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <header className="catalog-modal-header">
              <div>
                <p className="catalog-modal-kicker">{isEditing ? t("catalog.editMode") : t("catalog.newMode")}</p>
                <h3>
                  {tab === "almacenes"
                    ? isEditing
                      ? t("catalog.editWarehouse")
                      : t("catalog.newWarehouse")
                    : isEditing
                      ? tabLabels.edit
                      : tabLabels.new}
                </h3>
              </div>
              <button type="button" className="catalog-modal-close" onClick={closeModal} aria-label={t("catalog.close")}>
                ×
              </button>
            </header>

            <form className="catalog-modal-body" onSubmit={handleModalSubmit}>
              {renderModalFields()}
              <footer className="catalog-modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  {t("catalog.cancel")}
                </button>
                <button type="submit" className="btn btn-primary catalog-modal-save">
                  {isEditing
                    ? t("catalog.saveChanges")
                    : tab === "almacenes"
                      ? t("catalog.newWarehouse")
                      : `Crear ${tabLabels.entity}`}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};