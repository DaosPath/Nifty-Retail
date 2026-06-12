import React, { useMemo, useState, useDeferredValue } from "react";
import { buildProductByCodeMap } from "../utils/performanceMaps";
import { VirtualScroll } from "./VirtualScroll";
import { useI18n } from "../i18n";
import { useMoney } from "../hooks/useMoney";
import {
  CalendarIcon,
  AlertIcon,
  PlusIcon,
  DeleteIcon,
  BoxIcon,
  ChartIcon,
} from "./Icons";

interface Product {
  code: string;
  name: string;
  category: string;
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
  minStock: number;
  expiryDate?: string;
}

interface Lot {
  id: string;
  productCode: string;
  lotNumber: string;
  purchasePrice: number;
  initialQty: number;
  stock: number;
  expiryDate: string;
  createdAt: string;
}

interface AlertsProps {
  products: Product[];
  lots: Lot[];
  onQuickAdjustStock: (code: string, newStock: number) => void;
}

type ExpiryFilter = "all" | "expired" | "critical" | "warning";
type StockFilter = "all" | "out" | "low" | "critical";
type SortKey = "urgency" | "name" | "stock";

interface ExpiryStatus {
  type: "none" | "expired" | "critical" | "warning" | "safe";
  days: number;
}

interface ExpiringLotRow {
  lot: Lot;
  productName: string;
  productCode: string;
  category: string;
  status: ExpiryStatus;
  unitCost: number;
  exposureValue: number;
}

function getExpirationStatus(expiryDateStr: string | undefined, today: Date): ExpiryStatus {
  if (!expiryDateStr) return { type: "none", days: 999 };
  const expDate = new Date(expiryDateStr);
  const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { type: "expired", days: diffDays };
  if (diffDays <= 15) return { type: "critical", days: diffDays };
  if (diffDays <= 45) return { type: "warning", days: diffDays };
  return { type: "safe", days: diffDays };
}

function urgencyScore(status: ExpiryStatus): number {
  if (status.type === "expired") return status.days;
  if (status.type === "critical") return 100 + status.days;
  if (status.type === "warning") return 200 + status.days;
  return 999;
}

function stockDeficit(product: Product): number {
  return Math.max(0, product.minStock - product.stock);
}

export const Alerts: React.FC<AlertsProps> = ({ products, lots, onQuickAdjustStock }) => {
  const { t, localeTag } = useI18n();
  const { formatMoney } = useMoney();
  const today = useMemo(() => new Date(), []);

  const [expirySearch, setExpirySearch] = useState("");
  const [stockSearch, setStockSearch] = useState("");
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>("all");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [expirySort, setExpirySort] = useState<SortKey>("urgency");
  const [stockSort, setStockSort] = useState<SortKey>("urgency");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const deferredExpirySearch = useDeferredValue(expirySearch);
  const deferredStockSearch = useDeferredValue(stockSearch);

  const productsByCode = useMemo(() => buildProductByCodeMap(products), [products]);

  const expiringLots = useMemo((): ExpiringLotRow[] => {
    return lots
      .filter((l) => l.stock > 0)
      .map((l) => {
        const prod = productsByCode.get(l.productCode);
        const status = getExpirationStatus(l.expiryDate, today);
        const unitCost = l.purchasePrice || prod?.purchasePrice || 0;
        return {
          lot: l,
          productName: prod?.name || t("alerts.unknownProduct"),
          productCode: l.productCode,
          category: prod?.category || t("alerts.uncategorized"),
          status,
          unitCost,
          exposureValue: unitCost * l.stock,
        };
      })
      .filter((el) => el.status.type === "expired" || el.status.type === "critical" || el.status.type === "warning");
  }, [lots, productsByCode, today, t]);

  const lowStockProducts = useMemo(
    () => products.filter((p) => p.stock <= p.minStock),
    [products]
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => set.add(p.category || t("alerts.uncategorized")));
    return Array.from(set).sort();
  }, [products, t]);

  const stats = useMemo(() => {
    const expired = expiringLots.filter((e) => e.status.type === "expired");
    const critical = expiringLots.filter((e) => e.status.type === "critical");
    const warning = expiringLots.filter((e) => e.status.type === "warning");
    const outOfStock = lowStockProducts.filter((p) => p.stock === 0);
    const lowOnly = lowStockProducts.filter((p) => p.stock > 0);
    const expiryExposure = expiringLots.reduce((s, e) => s + e.exposureValue, 0);
    const reorderUnits = lowStockProducts.reduce((s, p) => s + stockDeficit(p), 0);
    const healthy = products.filter((p) => p.stock > p.minStock).length;
    const healthPct = products.length ? Math.round((healthy / products.length) * 100) : 100;

    return {
      expired: expired.length,
      critical: critical.length,
      warning: warning.length,
      outOfStock: outOfStock.length,
      lowOnly: lowOnly.length,
      totalExpiry: expiringLots.length,
      totalLow: lowStockProducts.length,
      expiryExposure,
      reorderUnits,
      healthPct,
      expiredUnits: expired.reduce((s, e) => s + e.lot.stock, 0),
    };
  }, [expiringLots, lowStockProducts, products]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { expiry: number; stock: number }>();
    for (const cat of categories) map.set(cat, { expiry: 0, stock: 0 });
    for (const e of expiringLots) {
      const row = map.get(e.category) || { expiry: 0, stock: 0 };
      row.expiry += 1;
      map.set(e.category, row);
    }
    for (const p of lowStockProducts) {
      const cat = p.category || t("alerts.uncategorized");
      const row = map.get(cat) || { expiry: 0, stock: 0 };
      row.stock += 1;
      map.set(cat, row);
    }
    return Array.from(map.entries())
      .filter(([, v]) => v.expiry > 0 || v.stock > 0)
      .sort((a, b) => b[1].expiry + b[1].stock - (a[1].expiry + a[1].stock));
  }, [categories, expiringLots, lowStockProducts, t]);

  const filteredExpiry = useMemo(() => {
    let rows = [...expiringLots];
    if (expiryFilter !== "all") rows = rows.filter((r) => r.status.type === expiryFilter);
    if (categoryFilter !== "all") rows = rows.filter((r) => r.category === categoryFilter);
    const q = deferredExpirySearch.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) =>
          r.productName.toLowerCase().includes(q) ||
          r.productCode.toLowerCase().includes(q) ||
          r.lot.lotNumber.toLowerCase().includes(q)
      );
    }
    rows.sort((a, b) => {
      if (expirySort === "name") return a.productName.localeCompare(b.productName);
      if (expirySort === "stock") return b.lot.stock - a.lot.stock;
      return urgencyScore(a.status) - urgencyScore(b.status);
    });
    return rows;
  }, [expiringLots, expiryFilter, categoryFilter, deferredExpirySearch, expirySort]);

  const filteredStock = useMemo(() => {
    let rows = [...lowStockProducts];
    if (stockFilter === "out") rows = rows.filter((p) => p.stock === 0);
    else if (stockFilter === "low") rows = rows.filter((p) => p.stock > 0);
    else if (stockFilter === "critical") rows = rows.filter((p) => p.stock < p.minStock * 0.5);
    if (categoryFilter !== "all") rows = rows.filter((p) => p.category === categoryFilter);
    const q = deferredStockSearch.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }
    rows.sort((a, b) => {
      if (stockSort === "name") return a.name.localeCompare(b.name);
      if (stockSort === "stock") return a.stock - b.stock;
      return stockDeficit(b) - stockDeficit(a);
    });
    return rows;
  }, [lowStockProducts, stockFilter, categoryFilter, deferredStockSearch, stockSort]);

  const fifoQueue = useMemo(
    () =>
      [...expiringLots]
        .sort((a, b) => urgencyScore(a.status) - urgencyScore(b.status))
        .slice(0, 5),
    [expiringLots]
  );

  const handleAdjustStock = (code: string, currentStock: number) => {
    const amountStr = window.prompt(t("alerts.promptNewStock"), currentStock.toString());
    if (amountStr === null) return;
    const amount = parseInt(amountStr, 10);
    if (isNaN(amount) || amount < 0) {
      alert(t("alerts.invalidStock"));
      return;
    }
    onQuickAdjustStock(code, amount);
  };

  const handleDiscardStock = (code: string) => {
    if (window.confirm(t("alerts.discardConfirm"))) {
      onQuickAdjustStock(code, 0);
    }
  };

  const handleDiscardAllExpired = () => {
    const expiredCodes = [
      ...new Set(
        expiringLots.filter((e) => e.status.type === "expired").map((e) => e.productCode)
      ),
    ];
    if (expiredCodes.length === 0) return;
    if (!window.confirm(t("alerts.discardAllConfirm", { count: expiredCodes.length }))) return;
    expiredCodes.forEach((code) => onQuickAdjustStock(code, 0));
  };

  const expiryProgress = (status: ExpiryStatus) => {
    if (status.type === "expired") return 100;
    if (status.type === "critical") return Math.max(8, ((15 - status.days) / 15) * 100);
    if (status.type === "warning") return Math.max(5, ((45 - status.days) / 45) * 70);
    return 0;
  };

  const stockFillPct = (p: Product) => {
    if (p.minStock <= 0) return p.stock > 0 ? 100 : 0;
    return Math.min(100, Math.round((p.stock / p.minStock) * 100));
  };

  return (
    <div className="alerts-page">
      <header className="alerts-hero card-glass">
        <div className="alerts-hero-copy">
          <div className="alerts-hero-kicker">
            <AlertIcon size={16} />
            {t("alerts.kicker")}
          </div>
          <h2 className="alerts-hero-title">{t("alerts.title")}</h2>
          <p className="alerts-hero-subtitle">{t("alerts.subtitle")}</p>
        </div>
        <div className="alerts-health-ring" aria-label={t("alerts.healthLabel")}>
          <svg viewBox="0 0 120 120" className="alerts-health-svg">
            <circle cx="60" cy="60" r="52" className="alerts-health-track" />
            <circle
              cx="60"
              cy="60"
              r="52"
              className="alerts-health-progress"
              style={{
                strokeDasharray: `${(stats.healthPct / 100) * 327} 327`,
              }}
            />
          </svg>
          <div className="alerts-health-center">
            <strong>{stats.healthPct}%</strong>
            <span>{t("alerts.healthOk")}</span>
          </div>
        </div>
      </header>

      <div className="alerts-kpi-grid">
        <article className="alerts-kpi alerts-kpi--danger">
          <span className="alerts-kpi-label">{t("alerts.kpiExpired")}</span>
          <strong className="alerts-kpi-value">{stats.expired.toLocaleString(localeTag)}</strong>
          <span className="alerts-kpi-meta">
            {t("alerts.kpiExpiredMeta", { units: stats.expiredUnits })}
          </span>
        </article>
        <article className="alerts-kpi alerts-kpi--warn">
          <span className="alerts-kpi-label">{t("alerts.kpiCritical")}</span>
          <strong className="alerts-kpi-value">{stats.critical.toLocaleString(localeTag)}</strong>
          <span className="alerts-kpi-meta">{t("alerts.kpiCriticalMeta")}</span>
        </article>
        <article className="alerts-kpi alerts-kpi--amber">
          <span className="alerts-kpi-label">{t("alerts.kpiWarning")}</span>
          <strong className="alerts-kpi-value">{stats.warning.toLocaleString(localeTag)}</strong>
          <span className="alerts-kpi-meta">{t("alerts.kpiWarningMeta")}</span>
        </article>
        <article className="alerts-kpi alerts-kpi--magenta">
          <span className="alerts-kpi-label">{t("alerts.kpiOutOfStock")}</span>
          <strong className="alerts-kpi-value">{stats.outOfStock.toLocaleString(localeTag)}</strong>
          <span className="alerts-kpi-meta">{t("alerts.kpiOutMeta")}</span>
        </article>
        <article className="alerts-kpi alerts-kpi--cyan">
          <span className="alerts-kpi-label">{t("alerts.kpiExposure")}</span>
          <strong className="alerts-kpi-value alerts-kpi-value--sm">{formatMoney(stats.expiryExposure)}</strong>
          <span className="alerts-kpi-meta">{t("alerts.kpiExposureMeta")}</span>
        </article>
        <article className="alerts-kpi alerts-kpi--info">
          <span className="alerts-kpi-label">{t("alerts.kpiReorder")}</span>
          <strong className="alerts-kpi-value">{stats.reorderUnits.toLocaleString(localeTag)}</strong>
          <span className="alerts-kpi-meta">{t("alerts.kpiReorderMeta")}</span>
        </article>
      </div>

      {categoryBreakdown.length > 0 && (
        <section className="alerts-category-bar card-glass">
          <div className="alerts-category-head">
            <ChartIcon size={16} />
            <span>{t("alerts.categoryBreakdown")}</span>
          </div>
          <div className="alerts-category-chips">
            <button
              type="button"
              className={`alerts-cat-chip${categoryFilter === "all" ? " is-active" : ""}`}
              onClick={() => setCategoryFilter("all")}
            >
              {t("common.all")}
            </button>
            {categoryBreakdown.map(([cat, counts]) => (
              <button
                key={cat}
                type="button"
                className={`alerts-cat-chip${categoryFilter === cat ? " is-active" : ""}`}
                onClick={() => setCategoryFilter(cat)}
              >
                {cat}
                <span className="alerts-cat-counts">
                  {counts.expiry > 0 && (
                    <em className="alerts-cat-exp">{counts.expiry}</em>
                  )}
                  {counts.stock > 0 && (
                    <em className="alerts-cat-stk">{counts.stock}</em>
                  )}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="alerts-main-grid">
        <section className="alerts-panel card-glass">
          <header className="alerts-panel-head">
            <div className="alerts-panel-title">
              <CalendarIcon size={18} />
              <div>
                <h3>{t("alerts.expiryTitle")}</h3>
                <p>{t("alerts.expirySubtitle")}</p>
              </div>
            </div>
            <span className="alerts-panel-count">{filteredExpiry.length}</span>
          </header>

          <div className="alerts-panel-toolbar">
            <input
              type="search"
              className="form-control alerts-search"
              placeholder={t("alerts.searchExpiry")}
              value={expirySearch}
              onChange={(e) => setExpirySearch(e.target.value)}
            />
            <select
              className="form-control alerts-sort"
              value={expirySort}
              onChange={(e) => setExpirySort(e.target.value as SortKey)}
            >
              <option value="urgency">{t("alerts.sortUrgency")}</option>
              <option value="name">{t("alerts.sortName")}</option>
              <option value="stock">{t("alerts.sortStock")}</option>
            </select>
          </div>

          <div className="alerts-filter-tabs">
            {(["all", "expired", "critical", "warning"] as ExpiryFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                className={`alerts-filter-tab${expiryFilter === f ? " is-active" : ""} alerts-filter-tab--${f}`}
                onClick={() => setExpiryFilter(f)}
              >
                {t(`alerts.filter${f.charAt(0).toUpperCase() + f.slice(1)}` as "alerts.filterAll")}
              </button>
            ))}
          </div>

          {filteredExpiry.length === 0 ? (
            <div className="alerts-list">
              <div className="alerts-empty">
                <CalendarIcon size={28} />
                <p>{t("alerts.emptyExpiry")}</p>
              </div>
            </div>
          ) : (
            <VirtualScroll
              className="alerts-list"
              items={filteredExpiry}
              itemHeight={118}
              overscan={6}
              getKey={(row) => row.lot.id}
              renderItem={({ lot, productName, productCode, category, status, exposureValue }) => (
                <article className={`alerts-item alerts-item--${status.type}`}>
                  <div className="alerts-item-stripe" aria-hidden="true" />
                  <div className="alerts-item-body">
                    <div className="alerts-item-top">
                      <div>
                        <h4 className="alerts-item-name">
                          {productName}
                          <span className="alerts-item-lot">{lot.lotNumber}</span>
                        </h4>
                        <p className="alerts-item-meta">
                          {t("alerts.code")}: {productCode} · {t("alerts.lotStock")}: {lot.stock} · {category}
                        </p>
                      </div>
                      <div className="alerts-item-badges">
                        {status.type === "expired" ? (
                          <span className="badge badge-danger">
                            {t("alerts.badgeExpired", { days: Math.abs(status.days) })}
                          </span>
                        ) : status.type === "critical" ? (
                          <span className="badge badge-danger">
                            {t("alerts.badgeExpiresIn", { days: status.days })}
                          </span>
                        ) : (
                          <span className="badge badge-warning">
                            {t("alerts.badgeExpiresIn", { days: status.days })}
                          </span>
                        )}
                        <span className="alerts-exposure-tag">{formatMoney(exposureValue)}</span>
                      </div>
                    </div>
                    <div className="alerts-progress-row">
                      <div className="alerts-progress-track">
                        <div
                          className={`alerts-progress-fill alerts-progress-fill--${status.type}`}
                          style={{ width: `${expiryProgress(status)}%` }}
                        />
                      </div>
                      <span className="alerts-progress-label">{lot.expiryDate}</span>
                    </div>
                    {status.type === "expired" && lot.stock > 0 && (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm alerts-item-action"
                        onClick={() => handleDiscardStock(productCode)}
                      >
                        <DeleteIcon size={12} /> {t("alerts.discard")}
                      </button>
                    )}
                  </div>
                </article>
              )}
            />
          )}
        </section>

        <section className="alerts-panel card-glass">
          <header className="alerts-panel-head">
            <div className="alerts-panel-title">
              <BoxIcon size={18} />
              <div>
                <h3>{t("alerts.stockTitle")}</h3>
                <p>{t("alerts.stockSubtitle")}</p>
              </div>
            </div>
            <span className="alerts-panel-count">{filteredStock.length}</span>
          </header>

          <div className="alerts-panel-toolbar">
            <input
              type="search"
              className="form-control alerts-search"
              placeholder={t("alerts.searchStock")}
              value={stockSearch}
              onChange={(e) => setStockSearch(e.target.value)}
            />
            <select
              className="form-control alerts-sort"
              value={stockSort}
              onChange={(e) => setStockSort(e.target.value as SortKey)}
            >
              <option value="urgency">{t("alerts.sortDeficit")}</option>
              <option value="name">{t("alerts.sortName")}</option>
              <option value="stock">{t("alerts.sortStock")}</option>
            </select>
          </div>

          <div className="alerts-filter-tabs">
            {(["all", "out", "low", "critical"] as StockFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                className={`alerts-filter-tab${stockFilter === f ? " is-active" : ""}`}
                onClick={() => setStockFilter(f)}
              >
                {t(`alerts.stockFilter${f.charAt(0).toUpperCase() + f.slice(1)}` as "alerts.stockFilterAll")}
              </button>
            ))}
          </div>

          {filteredStock.length === 0 ? (
            <div className="alerts-list">
              <div className="alerts-empty">
                <BoxIcon size={28} />
                <p>{t("alerts.emptyStock")}</p>
              </div>
            </div>
          ) : (
            <VirtualScroll
              className="alerts-list"
              items={filteredStock}
              itemHeight={112}
              overscan={6}
              getKey={(p) => p.code}
              renderItem={(p) => {
              const deficit = stockDeficit(p);
              const fill = stockFillPct(p);
              return (
                <article
                  className={`alerts-item alerts-item--stock${p.stock === 0 ? " alerts-item--out" : ""}`}
                >
                  <div className="alerts-item-stripe alerts-item-stripe--stock" aria-hidden="true" />
                  <div className="alerts-item-body">
                    <div className="alerts-item-top">
                      <div>
                        <h4 className="alerts-item-name">{p.name}</h4>
                        <p className="alerts-item-meta">
                          {t("alerts.minRequired")}: {p.minStock} · {t("alerts.category")}: {p.category}
                        </p>
                      </div>
                      <div className="alerts-item-badges">
                        <span className={`badge ${p.stock === 0 ? "badge-danger" : "badge-warning"}`}>
                          {p.stock === 0
                            ? t("alerts.soldOut")
                            : t("alerts.units", { count: p.stock })}
                        </span>
                        {deficit > 0 && (
                          <span className="alerts-deficit-tag">
                            −{deficit} {t("alerts.toReorder")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="alerts-progress-row">
                      <div className="alerts-progress-track">
                        <div
                          className={`alerts-progress-fill alerts-progress-fill--stock${fill < 30 ? " is-critical" : ""}`}
                          style={{ width: `${fill}%` }}
                        />
                      </div>
                      <span className="alerts-progress-label">
                        {fill}% / {p.minStock}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm alerts-item-action"
                      onClick={() => handleAdjustStock(p.code, p.stock)}
                    >
                      <PlusIcon size={12} /> {t("alerts.restock")}
                    </button>
                  </div>
                </article>
              );
              }}
            />
          )}
        </section>
      </div>

      <section className="alerts-insights-grid">
        <article className="alerts-insight card-glass">
          <header className="alerts-insight-head">
            <CalendarIcon size={16} />
            <h4>{t("alerts.fifoTitle")}</h4>
          </header>
          <p className="alerts-insight-desc">{t("alerts.fifoDesc")}</p>
          <ol className="alerts-fifo-list">
            {fifoQueue.map((row, idx) => (
              <li key={row.lot.id}>
                <span className="alerts-fifo-rank">{idx + 1}</span>
                <div>
                  <strong>{row.productName}</strong>
                  <span>
                    {row.lot.lotNumber} ·{" "}
                    {row.status.type === "expired"
                      ? t("alerts.badgeExpired", { days: Math.abs(row.status.days) })
                      : t("alerts.badgeExpiresIn", { days: row.status.days })}
                  </span>
                </div>
              </li>
            ))}
            {fifoQueue.length === 0 && (
              <li className="alerts-fifo-empty">{t("alerts.fifoEmpty")}</li>
            )}
          </ol>
        </article>

        <article className="alerts-insight card-glass">
          <header className="alerts-insight-head">
            <AlertIcon size={16} />
            <h4>{t("alerts.actionsTitle")}</h4>
          </header>
          <p className="alerts-insight-desc">{t("alerts.actionsDesc")}</p>
          <div className="alerts-quick-actions">
            <button
              type="button"
              className="btn btn-danger"
              disabled={stats.expired === 0}
              onClick={handleDiscardAllExpired}
            >
              <DeleteIcon size={14} />
              {t("alerts.discardAllExpired")}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => window.print()}
            >
              {t("alerts.printReport")}
            </button>
          </div>
          <dl className="alerts-summary-stats">
            <div>
              <dt>{t("alerts.summaryLots")}</dt>
              <dd>{stats.totalExpiry}</dd>
            </div>
            <div>
              <dt>{t("alerts.summaryLow")}</dt>
              <dd>{stats.totalLow}</dd>
            </div>
            <div>
              <dt>{t("alerts.summaryExposure")}</dt>
              <dd>{formatMoney(stats.expiryExposure)}</dd>
            </div>
          </dl>
        </article>
      </section>
    </div>
  );
};