import React from "react";
import { useI18n } from "../i18n";
import { BoxIcon, FolderIcon, LayersIcon, UserIcon } from "./Icons";
import { CatalogManager } from "./CatalogManager";
import type { Category, StorageLocation, Warehouse } from "../types/catalog";
import type { Manufacturer } from "../types/inventory";
import type { Supplier } from "../types/stock";

interface CatalogPageProps {
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

export const CatalogPage: React.FC<CatalogPageProps> = (props) => {
  const { t } = useI18n();
  const activeCategories = props.categories.filter((c) => c.active).length;
  const activeSuppliers = props.suppliers.filter((s) => s.active !== false).length;
  const activeManufacturers = props.manufacturers.filter((m) => m.active).length;
  const activeWarehouses = props.warehouses.filter((w) => w.active).length;

  return (
    <div className="catalog-page">
      <header className="catalog-page-hero card-glass">
        <div className="catalog-page-hero-glow" aria-hidden="true" />
        <div className="catalog-page-hero-main">
          <div className="catalog-page-hero-icon" aria-hidden="true">
            <LayersIcon size={26} />
          </div>
          <div className="catalog-page-hero-body">
            <p className="catalog-page-kicker">{t("catalog.kicker")}</p>
            <h2>{t("catalog.title")}</h2>
            <p>{t("catalog.subtitle", { new: t("catalog.new") })}</p>
          </div>
        </div>
        <div className="catalog-page-stats" role="list" aria-label={t("catalog.statsAria")}>
          <div className="catalog-page-stat catalog-page-stat--cat" role="listitem">
            <div className="catalog-page-stat-head">
              <span className="catalog-page-stat-icon">
                <LayersIcon size={13} />
              </span>
              <span className="catalog-page-stat-label">{t("catalog.statCategories")}</span>
            </div>
            <strong className="catalog-page-stat-value">{activeCategories}</strong>
          </div>
          <div className="catalog-page-stat catalog-page-stat--sup" role="listitem">
            <div className="catalog-page-stat-head">
              <span className="catalog-page-stat-icon">
                <UserIcon size={13} />
              </span>
              <span className="catalog-page-stat-label">{t("catalog.statSuppliers")}</span>
            </div>
            <strong className="catalog-page-stat-value">{activeSuppliers}</strong>
          </div>
          <div className="catalog-page-stat catalog-page-stat--mfg" role="listitem">
            <div className="catalog-page-stat-head">
              <span className="catalog-page-stat-icon">
                <BoxIcon size={13} />
              </span>
              <span className="catalog-page-stat-label">{t("catalog.statManufacturers")}</span>
            </div>
            <strong className="catalog-page-stat-value">{activeManufacturers}</strong>
          </div>
          <div className="catalog-page-stat catalog-page-stat--wh" role="listitem">
            <div className="catalog-page-stat-head">
              <span className="catalog-page-stat-icon">
                <FolderIcon size={13} />
              </span>
              <span className="catalog-page-stat-label">{t("catalog.statWarehouses")}</span>
            </div>
            <strong className="catalog-page-stat-value">{activeWarehouses}</strong>
          </div>
        </div>
      </header>

      <CatalogManager {...props} />
    </div>
  );
};