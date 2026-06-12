import React, { useDeferredValue, useMemo, useRef, useState } from "react";
import "../styles/kardex.css";
import { buildProductByCodeMap } from "../utils/performanceMaps";
import { useVirtualList } from "../hooks/useVirtualList";
import { BoxIcon, HistoryIcon, LayersIcon, SearchIcon } from "./Icons";
import type { Product } from "../App";
import type { Warehouse } from "../types/catalog";
import type { StockMovement } from "../types/inventory";
import type { StockMovementType } from "../types/inventory";
import { useI18n } from "../i18n";
import { getLocalizedWarehouseName } from "../utils/catalogHelpers";
import { buildKardexFromMovements, formatKardexDate, KARDEX_TYPE_OPTIONS, movementTypeLabel } from "../utils/kardex";

interface KardexProps {
  products: Product[];
  movements: StockMovement[];
  warehouses: Warehouse[];
  onTransferStock: (payload: {
    productCode: string;
    quantity: number;
    fromWarehouseId: string;
    toWarehouseId: string;
    observation?: string;
  }) => void;
}

type TypeFilter = "ALL" | StockMovementType;
type SortOrder = "desc" | "asc";

function toDateInputValue(date: Date): string {
  return date.toISOString().split("T")[0];
}

function isoToDisplay(iso: string): string {
  if (!iso) return "";
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return "";
  return `${day}/${month}/${year}`;
}

function parseDisplayDate(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const day = slashMatch[1].padStart(2, "0");
    const month = slashMatch[2].padStart(2, "0");
    const year = slashMatch[3];
    const date = new Date(`${year}-${month}-${day}T12:00:00`);
    if (Number.isNaN(date.getTime())) return "";
    if (
      date.getFullYear() !== Number(year) ||
      date.getMonth() + 1 !== Number(month) ||
      date.getDate() !== Number(day)
    ) {
      return "";
    }
    return `${year}-${month}-${day}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return "";
}

export const Kardex: React.FC<KardexProps> = ({ products, movements, warehouses, onTransferStock }) => {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCode, setSelectedCode] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateFromDraft, setDateFromDraft] = useState("");
  const [dateToDraft, setDateToDraft] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [transferQty, setTransferQty] = useState("1");
  const [transferFrom, setTransferFrom] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [transferNote, setTransferNote] = useState("");

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const productsByCode = useMemo(() => buildProductByCodeMap(products), [products]);
  const selectedProduct = selectedCode ? productsByCode.get(selectedCode) : undefined;

  const suggestions = useMemo(() => {
    const q = deferredSearchQuery.toLowerCase().trim();
    if (!q || (selectedProduct && searchQuery === selectedProduct.name)) return [];
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [products, deferredSearchQuery, selectedProduct]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (dateFrom) count += 1;
    if (dateTo) count += 1;
    if (typeFilter !== "ALL") count += 1;
    if (warehouseFilter) count += 1;
    return count;
  }, [dateFrom, dateTo, typeFilter, warehouseFilter]);

  const rows = useMemo(() => {
    if (!selectedProduct) return [];

    let all = buildKardexFromMovements(selectedProduct, movements, {
      warehouseId: warehouseFilter || undefined,
      types: typeFilter !== "ALL" ? [typeFilter] : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });

    all.sort((a, b) => {
      const diff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      return sortOrder === "asc" ? diff : -diff;
    });

    return all;
  }, [selectedProduct, movements, typeFilter, warehouseFilter, dateFrom, dateTo, sortOrder]);

  const kardexTableRef = useRef<HTMLDivElement>(null);
  const kardexRowHeight = 46;
  const virtualKardex = useVirtualList(kardexTableRef, {
    itemCount: rows.length,
    itemHeight: kardexRowHeight,
    overscan: 12,
  });
  const visibleKardexRows = useMemo(
    () => rows.slice(virtualKardex.start, virtualKardex.end),
    [rows, virtualKardex.end, virtualKardex.start]
  );

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          entrada: acc.entrada + row.entrada,
          salida: acc.salida + row.salida,
        }),
        { entrada: 0, salida: 0 }
      ),
    [rows]
  );

  const kardexPageStats = useMemo(() => {
    const productsWithHistory = new Set(movements.map((m) => m.productCode)).size;
    return {
      totalMovements: movements.length,
      productsWithHistory,
      loadedMovements: rows.length,
    };
  }, [movements, rows.length]);

  const selectProduct = (product: Product) => {
    setSelectedCode(product.code);
    setSearchQuery(product.name);
    setShowSuggestions(false);
  };

  const syncDateDrafts = (from: string, to: string) => {
    setDateFromDraft(isoToDisplay(from));
    setDateToDraft(isoToDisplay(to));
  };

  const clearAll = () => {
    setSearchQuery("");
    setSelectedCode("");
    setDateFrom("");
    setDateTo("");
    setDateFromDraft("");
    setDateToDraft("");
    setTypeFilter("ALL");
    setWarehouseFilter("");
    setSortOrder("desc");
    setShowSuggestions(false);
  };

  const clearDates = () => {
    setDateFrom("");
    setDateTo("");
    setDateFromDraft("");
    setDateToDraft("");
  };

  const applyDatePreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    const from = toDateInputValue(start);
    const to = toDateInputValue(end);
    setDateFrom(from);
    setDateTo(to);
    syncDateDrafts(from, to);
  };

  const setDateToToday = () => {
    const today = toDateInputValue(new Date());
    setDateTo(today);
    setDateToDraft(isoToDisplay(today));
  };

  const commitDateFrom = () => {
    const parsed = parseDisplayDate(dateFromDraft);
    setDateFrom(parsed);
    setDateFromDraft(parsed ? isoToDisplay(parsed) : "");
  };

  const commitDateTo = () => {
    const parsed = parseDisplayDate(dateToDraft);
    setDateTo(parsed);
    setDateToDraft(parsed ? isoToDisplay(parsed) : "");
  };

  const handleTransfer = () => {
    if (!selectedProduct || !transferFrom || !transferTo || transferFrom === transferTo) {
      alert("Seleccione producto, almacén origen y destino distintos.");
      return;
    }
    try {
      onTransferStock({
        productCode: selectedProduct.code,
        quantity: parseFloat(transferQty) || 0,
        fromWarehouseId: transferFrom,
        toWarehouseId: transferTo,
        observation: transferNote || undefined,
      });
      setTransferNote("");
      alert("Traslado registrado en el kardex.");
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="kardex-page">
      <section className="kardex-hero card-glass">
        <div className="kardex-hero-glow" aria-hidden="true" />
        <div className="kardex-hero-main">
          <div className="kardex-hero-title-block">
            <div className="kardex-hero-icon" aria-hidden="true">
              <LayersIcon size={26} />
            </div>
            <div>
              <p className="kardex-hero-eyebrow">Trazabilidad de stock</p>
              <h2>Kardex operativo</h2>
              <p className="kardex-hero-desc">
                Consulta movimientos, referencias y stock resultante desde una vista clara para auditoría diaria.
              </p>
            </div>
          </div>
          <div className="kardex-hero-badges">
            <span className={`kardex-pill ${selectedProduct ? "has-product" : ""}`} title={selectedProduct?.name}>
              {selectedProduct ? selectedProduct.name : "Sin producto"}
            </span>
            <span className={`kardex-pill ${activeFiltersCount > 0 ? "has-filters" : ""}`}>
              {activeFiltersCount} filtro{activeFiltersCount !== 1 ? "s" : ""} activo{activeFiltersCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className="kardex-hero-stats" role="list" aria-label="Resumen del kardex">
          <div className="kardex-hero-stat kardex-hero-stat--ledger" role="listitem">
            <div className="kardex-hero-stat-head">
              <span className="kardex-hero-stat-icon">
                <HistoryIcon size={13} />
              </span>
              <span className="kardex-hero-stat-label">Movimientos</span>
            </div>
            <strong className="kardex-hero-stat-value">{kardexPageStats.totalMovements}</strong>
            <span className="kardex-hero-stat-meta">En toda la base</span>
          </div>
          <div className="kardex-hero-stat kardex-hero-stat--products" role="listitem">
            <div className="kardex-hero-stat-head">
              <span className="kardex-hero-stat-icon">
                <BoxIcon size={13} />
              </span>
              <span className="kardex-hero-stat-label">Productos</span>
            </div>
            <strong className="kardex-hero-stat-value">{kardexPageStats.productsWithHistory}</strong>
            <span className="kardex-hero-stat-meta">Con historial</span>
          </div>
          <div className="kardex-hero-stat kardex-hero-stat--loaded" role="listitem">
            <div className="kardex-hero-stat-head">
              <span className="kardex-hero-stat-icon">
                <LayersIcon size={13} />
              </span>
              <span className="kardex-hero-stat-label">Cargados</span>
            </div>
            <strong className="kardex-hero-stat-value">{kardexPageStats.loadedMovements}</strong>
            <span className="kardex-hero-stat-meta">
              {selectedProduct ? "En la consulta actual" : "Selecciona producto"}
            </span>
          </div>
          <div className="kardex-hero-stat kardex-hero-stat--filters" role="listitem">
            <div className="kardex-hero-stat-head">
              <span className="kardex-hero-stat-icon">
                <SearchIcon size={13} />
              </span>
              <span className="kardex-hero-stat-label">Filtros</span>
            </div>
            <strong className="kardex-hero-stat-value">{activeFiltersCount}</strong>
            <span className="kardex-hero-stat-meta">Activos ahora</span>
          </div>
        </div>
      </section>

      <section className="kardex-filters card-glass">
        <div className="kardex-filters-head">
          <div>
            <p className="kardex-filters-eyebrow">Búsqueda principal</p>
            <h3>Producto y rango de consulta</h3>
            <p>Busca por nombre, SKU o código de barras y acota el rango temporal del kardex.</p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm kardex-clear-btn" onClick={clearAll}>
            Limpiar todo
          </button>
        </div>

        <div className="kardex-filters-body">
          <div className="kardex-filter-field kardex-filter-field--search">
            <label>Buscar producto</label>
            <div className="kardex-search-wrap">
              <SearchIcon size={16} className="kardex-search-icon" />
              <input
                className="form-control kardex-search-input"
                placeholder="Nombre, SKU o código de barras..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedCode("");
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="kardex-suggestions">
                  {suggestions.map((p) => (
                    <button type="button" key={p.code} onClick={() => selectProduct(p)}>
                      <div>
                        <strong>{p.name}</strong>
                        <span>
                          {p.code} · Stock: {p.stock}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="kardex-filters-controls">
            <div className="kardex-filter-field">
              <label>Desde</label>
              <input
                className="form-control kardex-date-input"
                type="text"
                inputMode="numeric"
                placeholder="dd/mm/aaaa"
                value={dateFromDraft}
                onChange={(e) => setDateFromDraft(e.target.value)}
                onBlur={commitDateFrom}
              />
            </div>

            <div className="kardex-filter-field">
              <label>Hasta</label>
              <input
                className="form-control kardex-date-input"
                type="text"
                inputMode="numeric"
                placeholder="dd/mm/aaaa"
                value={dateToDraft}
                onChange={(e) => setDateToDraft(e.target.value)}
                onBlur={commitDateTo}
              />
            </div>

            <div className="kardex-filter-field">
              <label>Tipo</label>
              <select
                className="form-control"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
              >
                {KARDEX_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="kardex-filter-field">
              <label>{t("warehouses.label")}</label>
              <select className="form-control" value={warehouseFilter} onChange={(e) => setWarehouseFilter(e.target.value)}>
                <option value="">{t("warehouses.all")}</option>
                {warehouses.filter((w) => w.active).map((w) => (
                  <option key={w.id} value={w.id}>{getLocalizedWarehouseName(w, t)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="kardex-date-toolbar">
            <div className="kardex-date-presets">
              <span>Rango rápido</span>
              <button type="button" onClick={() => applyDatePreset(7)}>7 días</button>
              <button type="button" onClick={() => applyDatePreset(30)}>30 días</button>
              <button type="button" onClick={() => applyDatePreset(90)}>90 días</button>
            </div>
            <div className="kardex-date-actions">
              <button type="button" className="kardex-date-action" onClick={clearDates}>
                Borrar fechas
              </button>
              <button type="button" className="kardex-date-action kardex-date-action--primary" onClick={setDateToToday}>
                Hoy
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="kardex-workspace card-glass">
      {!selectedProduct ? (
        <div className="kardex-empty">
          <div className="kardex-empty-panel">
            <div className="kardex-empty-visual" aria-hidden="true">
              <span className="kardex-empty-ring kardex-empty-ring--outer" />
              <span className="kardex-empty-ring kardex-empty-ring--inner" />
              <SearchIcon size={30} />
            </div>
            <h3>Selecciona un producto</h3>
            <p>Usa el buscador superior para encontrar un producto y consultar su historial completo de movimientos.</p>
            <div className="kardex-empty-steps">
              <div className="kardex-empty-step">
                <span className="kardex-empty-step-num">1</span>
                <span>Busca por nombre o SKU</span>
              </div>
              <div className="kardex-empty-step">
                <span className="kardex-empty-step-num">2</span>
                <span>Elige de la lista sugerida</span>
              </div>
              <div className="kardex-empty-step">
                <span className="kardex-empty-step-num">3</span>
                <span>Filtra por fecha o almacén</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="kardex-results">
          <header className="kardex-results-head">
            <div className="kardex-results-head-main">
              <div className="kardex-results-product-icon">
                <LayersIcon size={18} />
              </div>
              <div>
                <p className="kardex-results-eyebrow">Producto seleccionado</p>
                <h3>{selectedProduct.name}</h3>
                <p className="kardex-results-meta">
                  <span>SKU: {selectedProduct.code}</span>
                  <span>{selectedProduct.category}</span>
                  <span className="kardex-stock-chip">Stock: {selectedProduct.stock}</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm kardex-sort-btn"
              onClick={() => setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))}
            >
              Orden: {sortOrder === "desc" ? "Más reciente" : "Más antiguo"}
            </button>
          </header>

          <div className="kardex-transfer">
            <div className="kardex-transfer-head">
              <h4>Traslado entre almacenes</h4>
              <p>Registra movimientos de salida/entrada entre ubicaciones.</p>
            </div>
            <div className="kardex-filters-controls kardex-transfer-grid">
              <div className="kardex-filter-field">
                <label>Cantidad</label>
                <input className="form-control" type="number" min="1" value={transferQty} onChange={(e) => setTransferQty(e.target.value)} />
              </div>
              <div className="kardex-filter-field">
                <label>Desde</label>
                <select className="form-control" value={transferFrom} onChange={(e) => setTransferFrom(e.target.value)}>
                  <option value="">{t("common.selectPlaceholder")}</option>
                  {warehouses.filter((w) => w.active).map((w) => (
                    <option key={w.id} value={w.id}>{getLocalizedWarehouseName(w, t)}</option>
                  ))}
                </select>
              </div>
              <div className="kardex-filter-field">
                <label>Hacia</label>
                <select className="form-control" value={transferTo} onChange={(e) => setTransferTo(e.target.value)}>
                  <option value="">{t("common.selectPlaceholder")}</option>
                  {warehouses.filter((w) => w.active).map((w) => (
                    <option key={w.id} value={w.id}>{getLocalizedWarehouseName(w, t)}</option>
                  ))}
                </select>
              </div>
              <div className="kardex-filter-field">
                <label>Nota</label>
                <input className="form-control" value={transferNote} onChange={(e) => setTransferNote(e.target.value)} placeholder="Opcional" />
              </div>
            </div>
            <button type="button" className="btn btn-primary btn-sm kardex-transfer-btn" onClick={handleTransfer}>
              Registrar traslado
            </button>
          </div>

          <div className="kardex-stats">
            <div className="kardex-stat">
              <span>Entradas</span>
              <strong>{totals.entrada}</strong>
            </div>
            <div className="kardex-stat">
              <span>Salidas</span>
              <strong>{totals.salida}</strong>
            </div>
            <div className="kardex-stat kardex-stat--accent">
              <span>Saldo actual</span>
              <strong>{selectedProduct.stock}</strong>
            </div>
            <div className="kardex-stat">
              <span>Movimientos</span>
              <strong>{rows.length}</strong>
            </div>
          </div>

          <div ref={kardexTableRef} className="kardex-table-wrap">
            <table className="kardex-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Documento</th>
                  <th>Detalle</th>
                  <th>Entrada</th>
                  <th>Salida</th>
                  <th>Saldo</th>
                  <th>Costo/Precio</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="kardex-table-empty">
                      Sin movimientos para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  <>
                    {virtualKardex.padding.top > 0 && (
                      <tr className="kardex-virtual-spacer" aria-hidden="true">
                        <td colSpan={8} style={{ height: virtualKardex.padding.top, padding: 0, border: 0 }} />
                      </tr>
                    )}
                    {visibleKardexRows.map((row) => (
                      <tr key={row.id}>
                        <td>{formatKardexDate(row.timestamp)}</td>
                        <td>
                          <span className="kardex-type-pill">{movementTypeLabel(row.type)}</span>
                        </td>
                        <td>{row.reference}</td>
                        <td>{row.detail}</td>
                        <td className="kardex-num in">{row.entrada > 0 ? row.entrada : "-"}</td>
                        <td className="kardex-num out">{row.salida > 0 ? row.salida : "-"}</td>
                        <td className="kardex-num balance">{row.balance}</td>
                        <td>{row.unitCost !== undefined ? `S/ ${row.unitCost.toFixed(2)}` : "-"}</td>
                      </tr>
                    ))}
                    {virtualKardex.padding.bottom > 0 && (
                      <tr className="kardex-virtual-spacer" aria-hidden="true">
                        <td colSpan={8} style={{ height: virtualKardex.padding.bottom, padding: 0, border: 0 }} />
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </section>
    </div>
  );
};