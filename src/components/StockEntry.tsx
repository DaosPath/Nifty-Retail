import React, { useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, PlusIcon, PackagePlusIcon } from "./Icons";
import { SelectField } from "./SelectField";
import type { Product } from "../App";
import type { Warehouse } from "../types/catalog";
import {
  type PurchaseDocType,
  type PurchaseLine,
  type PurchasePaymentCondition,
  type PurchasePaymentMethod,
  type Supplier,
} from "../types/stock";
import { useI18n } from "../i18n";
import { isoToDisplay, parseDisplayDate } from "../utils/dateInput";
import {
  getLocalizedWarehouseName,
  getWarehouseOptionHint,
} from "../utils/catalogHelpers";
import { buildProductByCodeMap } from "../utils/performanceMaps";

interface StockEntryProps {
  products: Product[];
  suppliers: Supplier[];
  warehouses: Warehouse[];
  activeSession: { id: string; expectedCash: number } | null;
  onConfirmPurchase: (payload: {
    supplierId: string;
    supplierName: string;
    docType: PurchaseDocType;
    warehouse: string;
    warehouseId?: string;
    series: string;
    correlativo: string;
    paymentCondition: PurchasePaymentCondition;
    paymentMethod: PurchasePaymentMethod;
    items: PurchaseLine[];
    total: number;
    paidToday: number;
  }) => Promise<boolean>;
}

interface DraftLine {
  id: string;
  productCode: string;
  quantity: string;
  unitCost: string;
  lotNumber: string;
  expiryDraft: string;
}

const DOC_TYPES: PurchaseDocType[] = ["FACTURA", "BOLETA", "GUIA", "OTRO"];
const PAYMENT_METHODS: PurchasePaymentMethod[] = ["Efectivo", "Yape", "Tarjeta", "Transferencia"];

const DOC_TYPE_HINTS: Record<PurchaseDocType, string> = {
  FACTURA: "Compra con factura",
  BOLETA: "Boleta de compra",
  GUIA: "Guía de remisión",
  OTRO: "Otro comprobante",
};

const PAYMENT_HINTS: Record<PurchasePaymentMethod, string> = {
  Efectivo: "Sale de caja en efectivo",
  Yape: "Pago digital Yape",
  Tarjeta: "Débito o crédito",
  Transferencia: "Transferencia bancaria",
};

function createLine(): DraftLine {
  return {
    id: `line_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    productCode: "",
    quantity: "1",
    unitCost: "",
    lotNumber: "",
    expiryDraft: "",
  };
}

export const StockEntry: React.FC<StockEntryProps> = ({
  products,
  suppliers,
  warehouses,
  activeSession,
  onConfirmPurchase,
}) => {
  const { t } = useI18n();
  const tableRef = useRef<HTMLDivElement>(null);
  const defaultWarehouse = warehouses.find((w) => w.isDefault) || warehouses[0];
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || "");
  const [docType, setDocType] = useState<PurchaseDocType>("FACTURA");
  const [warehouseId, setWarehouseId] = useState(defaultWarehouse?.id || "");
  const [series, setSeries] = useState("F001");
  const [correlativo, setCorrelativo] = useState("");
  const [paymentCondition, setPaymentCondition] = useState<PurchasePaymentCondition>("contado");
  const [paymentMethod, setPaymentMethod] = useState<PurchasePaymentMethod>("Efectivo");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [searchTexts, setSearchTexts] = useState<Record<string, string>>({});
  const [activeSearchLineId, setActiveSearchLineId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedSupplier = suppliers.find((s) => s.id === supplierId);

  const supplierOptions = useMemo(
    () => suppliers.map((s) => ({ value: s.id, label: s.name, hint: s.ruc ? `RUC ${s.ruc}` : undefined })),
    [suppliers]
  );

  const docTypeOptions = useMemo(
    () => DOC_TYPES.map((t) => ({ value: t, label: t, hint: DOC_TYPE_HINTS[t] })),
    []
  );

  const warehouseOptions = useMemo(
    () =>
      warehouses.map((w) => ({
        value: w.id,
        label: getLocalizedWarehouseName(w, t),
        hint: getWarehouseOptionHint(w, t),
      })),
    [warehouses, t]
  );

  const productsByCode = useMemo(() => buildProductByCodeMap(products), [products]);

  const selectedWarehouse = warehouses.find((w) => w.id === warehouseId);

  const paymentMethodOptions = useMemo(
    () => PAYMENT_METHODS.map((m) => ({ value: m, label: m, hint: PAYMENT_HINTS[m] })),
    []
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!tableRef.current?.contains(event.target as Node)) {
        setActiveSearchLineId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const parsedLines = useMemo(() => {
    return lines
      .map((line) => {
        const product = productsByCode.get(line.productCode);
        const quantity = parseFloat(line.quantity) || 0;
        const unitCost = parseFloat(line.unitCost) || product?.purchasePrice || 0;
        const expiryDate = parseDisplayDate(line.expiryDraft);
        if (!product || quantity <= 0 || unitCost <= 0 || !expiryDate) return null;
        return {
          productCode: product.code,
          productName: product.name,
          quantity,
          unitCost,
          expiryDate,
          lotNumber: line.lotNumber.trim() || undefined,
        } satisfies PurchaseLine;
      })
      .filter(Boolean) as PurchaseLine[];
  }, [lines, productsByCode]);

  const linesMissingExpiry = useMemo(
    () =>
      lines.filter((line) => {
        const product = productsByCode.get(line.productCode);
        const quantity = parseFloat(line.quantity) || 0;
        const unitCost = parseFloat(line.unitCost) || product?.purchasePrice || 0;
        if (!product || quantity <= 0 || unitCost <= 0) return false;
        return !parseDisplayDate(line.expiryDraft);
      }).length,
    [lines, productsByCode]
  );

  const total = parsedLines.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  const paidToday = paymentCondition === "contado" ? total : 0;
  const documentRef =
    series.trim() && correlativo.trim() ? `${series.trim()}-${correlativo.trim().padStart(6, "0")}` : "";
  const hasSupplier = Boolean(selectedSupplier);
  const hasDocument = Boolean(documentRef);
  const hasItems = parsedLines.length > 0;
  const docComplete = hasSupplier && hasDocument && hasItems;
  const projectedCash = activeSession ? activeSession.expectedCash - paidToday : null;
  const completionSteps = [hasSupplier, hasDocument, hasItems];
  const completionCount = completionSteps.filter(Boolean).length;
  const completionPct = Math.round((completionCount / 3) * 100);

  const getSuggestions = (lineId: string): Product[] => {
    if (activeSearchLineId !== lineId) return [];
    const q = (searchTexts[lineId] || "").trim().toLowerCase();
    if (q.length < 1) return [];
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      )
      .slice(0, 8);
  };

  const getInputValue = (line: DraftLine): string => {
    if (activeSearchLineId === line.id) {
      return searchTexts[line.id] ?? "";
    }
    if (line.productCode) {
      return productsByCode.get(line.productCode)?.name || searchTexts[line.id] || "";
    }
    return searchTexts[line.id] || "";
  };

  const suggestLotNumber = (lineIndex: number) => `L-${String(lineIndex + 1).padStart(2, "0")}`;

  const handleAddLine = () => {
    const newLine = createLine();
    newLine.lotNumber = suggestLotNumber(lines.length);
    setLines((prev) => [...prev, newLine]);
    setSearchTexts((prev) => ({ ...prev, [newLine.id]: "" }));
    setActiveSearchLineId(newLine.id);
  };

  const updateLine = (id: string, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  };

  const handleSearchChange = (lineId: string, value: string) => {
    setSearchTexts((prev) => ({ ...prev, [lineId]: value }));
    setActiveSearchLineId(lineId);
    updateLine(lineId, { productCode: "", unitCost: "" });
  };

  const selectProduct = (lineId: string, product: Product) => {
    const lineIndex = lines.findIndex((l) => l.id === lineId);
    updateLine(lineId, {
      productCode: product.code,
      unitCost: product.purchasePrice > 0 ? String(product.purchasePrice) : "",
      lotNumber: lines.find((l) => l.id === lineId)?.lotNumber || suggestLotNumber(Math.max(lineIndex, 0)),
    });
    setSearchTexts((prev) => ({ ...prev, [lineId]: product.name }));
    setActiveSearchLineId(null);
  };

  const removeLine = (lineId: string) => {
    setLines((prev) => prev.filter((l) => l.id !== lineId));
    setSearchTexts((prev) => {
      const next = { ...prev };
      delete next[lineId];
      return next;
    });
    if (activeSearchLineId === lineId) setActiveSearchLineId(null);
  };

  const resetLines = () => {
    setLines([]);
    setSearchTexts({});
    setActiveSearchLineId(null);
  };

  const handleConfirm = async () => {
    if (!selectedSupplier) {
      alert("Seleccione un proveedor.");
      return;
    }
    if (!documentRef) {
      alert("Complete serie y correlativo del comprobante.");
      return;
    }
    if (parsedLines.length === 0) {
      if (linesMissingExpiry > 0) {
        alert("Cada producto debe incluir una fecha de vencimiento válida (dd/mm/aaaa) para crear el lote.");
      } else {
        alert("Agregue al menos un producto válido con cantidad, costo y vencimiento.");
      }
      return;
    }
    if (paymentCondition === "contado" && !activeSession) {
      alert("Para compras al contado debe tener la caja abierta.");
      return;
    }

    setIsSubmitting(true);
    try {
      const ok = await onConfirmPurchase({
        supplierId: selectedSupplier.id,
        supplierName: selectedSupplier.name,
        docType,
        warehouse: selectedWarehouse?.name || "",
        warehouseId,
        series: series.trim().toUpperCase(),
        correlativo: correlativo.trim(),
        paymentCondition,
        paymentMethod,
        items: parsedLines,
        total,
        paidToday,
      });
      if (ok) {
        setCorrelativo("");
        resetLines();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="stock-entry-layout">
      <div className="stock-entry-main card-glass">
        <div className="stock-entry-main-accent" aria-hidden="true" />
        <header className="stock-entry-header">
          <div className="stock-entry-header-icon">
            <PackagePlusIcon size={22} />
          </div>
          <div className="stock-entry-header-body">
            <p className="stock-entry-kicker">Ingreso de stock</p>
            <h3 className="stock-entry-title">Datos de la compra</h3>
            <p className="stock-entry-subtitle">Proveedor, comprobante, almacén destino y detalle de productos.</p>
          </div>
          <div className="stock-entry-header-meta">
            <span className="stock-entry-header-pill">{parsedLines.length} ítems</span>
            <span className="stock-entry-header-pill stock-entry-header-pill--total">S/ {total.toFixed(2)}</span>
          </div>
        </header>

        <div className="stock-entry-steps-rail" aria-hidden="true">
          <span className={`stock-entry-rail-step${hasSupplier ? " is-done" : ""}`}>1</span>
          <span className={`stock-entry-rail-line${hasSupplier ? " is-done" : ""}`} />
          <span className={`stock-entry-rail-step${hasDocument ? " is-done" : ""}`}>2</span>
          <span className={`stock-entry-rail-line${hasDocument ? " is-done" : ""}`} />
          <span className={`stock-entry-rail-step${hasItems ? " is-done" : ""}`}>3</span>
        </div>

        <section className="stock-entry-panel">
          <div className="stock-entry-panel-head">
            <span className="stock-entry-step">1</span>
            <div>
              <h4>Identificación del movimiento</h4>
              <p>Selecciona quién vendió, qué documento respalda la compra y dónde ingresa el stock.</p>
            </div>
          </div>

          <div className="stock-entry-grid-top">
            <SelectField
              label="Proveedor"
              value={supplierId}
              options={supplierOptions}
              onChange={setSupplierId}
              accent="amber"
              placeholder="Elegir proveedor"
            />

            <SelectField
              label="Tipo comprobante"
              value={docType}
              options={docTypeOptions}
              onChange={(v) => setDocType(v as PurchaseDocType)}
              accent="cyan"
            />

            <SelectField
              label={t("warehouses.destination")}
              value={warehouseId}
              options={warehouseOptions}
              onChange={setWarehouseId}
              accent="magenta"
              placeholder={t("warehouses.choose")}
            />
          </div>

          {suppliers.length === 0 && (
            <p className="stock-entry-catalog-hint">
              No hay proveedores activos. Créalos en <strong>Catálogo → Proveedores</strong>.
            </p>
          )}

          <div className="stock-entry-doc-row">
            <div className="stock-entry-doc-fields">
              <div className="stock-entry-field">
                <label>Serie</label>
                <input className="stock-entry-input" value={series} onChange={(e) => setSeries(e.target.value.toUpperCase())} />
              </div>
              <div className="stock-entry-field">
                <label>Correlativo</label>
                <input
                  className="stock-entry-input"
                  placeholder="001234"
                  value={correlativo}
                  onChange={(e) => setCorrelativo(e.target.value.replace(/\D/g, ""))}
                />
              </div>
            </div>
            <div className={`stock-entry-preview ${hasDocument ? "is-ready" : ""}`}>
              <div className="stock-entry-preview-head">
                <span>Comprobante</span>
                <span className={`stock-entry-badge ${hasDocument ? "ok" : "warn"}`}>
                  {hasDocument ? "VÁLIDO" : "PENDIENTE"}
                </span>
              </div>
              <div className="stock-entry-preview-body">
                <p><span>Tipo</span><strong>{docType}</strong></p>
                <p><span>Referencia</span><strong>{documentRef || "—"}</strong></p>
              </div>
            </div>
          </div>
        </section>

        <section className="stock-entry-panel stock-entry-panel--payment">
          <div className="stock-entry-panel-head">
            <span className="stock-entry-step">2</span>
            <div>
              <h4>Condición de pago</h4>
              <p>Define si la compra sale de caja hoy o queda como deuda con el proveedor.</p>
            </div>
          </div>

          <div className="stock-entry-payment-options">
            <button
              type="button"
              className={`stock-entry-pay-card stock-entry-pay-card--cash ${paymentCondition === "contado" ? "active" : ""}`}
              onClick={() => setPaymentCondition("contado")}
            >
              <span className="stock-entry-pay-dot" />
              <div>
                <strong>Contado</strong>
                <span>Salida de caja inmediata</span>
              </div>
            </button>
            <button
              type="button"
              className={`stock-entry-pay-card stock-entry-pay-card--credit ${paymentCondition === "credito" ? "active" : ""}`}
              onClick={() => setPaymentCondition("credito")}
            >
              <span className="stock-entry-pay-dot" />
              <div>
                <strong>Crédito proveedor</strong>
                <span>Difiere el pago del saldo</span>
              </div>
            </button>
          </div>

          {paymentCondition === "contado" && (
            <div className="stock-entry-payment-method">
              <SelectField
                label="Método de pago"
                value={paymentMethod}
                options={paymentMethodOptions}
                onChange={(v) => setPaymentMethod(v as PurchasePaymentMethod)}
                accent="cyan"
              />
            </div>
          )}
        </section>

        <section className="stock-entry-panel stock-entry-panel--lines">
          <div className="stock-entry-lines-head">
            <div className="stock-entry-panel-head stock-entry-panel-head--inline">
              <span className="stock-entry-step">3</span>
              <div>
                <h4>Detalle de productos</h4>
                <p>Busca por nombre o código. Cada línea crea un lote con su fecha de vencimiento.</p>
              </div>
            </div>
            <button type="button" className="btn btn-primary btn-sm stock-entry-add-row" onClick={handleAddLine}>
              <PlusIcon size={14} /> Añadir fila
            </button>
          </div>

          {lines.length === 0 ? (
            <div className="stock-entry-lines-empty">
              <div className="stock-entry-lines-empty-icon">
                <PackagePlusIcon size={28} />
              </div>
              <p>Sin productos en esta compra</p>
              <span>Agrega la primera fila para buscar SKU y registrar cantidades.</span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddLine}>
                <PlusIcon size={14} /> Añadir primera fila
              </button>
            </div>
          ) : (
            <div className="stock-entry-table" ref={tableRef}>
              <div className="stock-entry-table-head">
                <span>Producto</span>
                <span>Cantidad</span>
                <span>Costo unit.</span>
                <span>Lote</span>
                <span>Vencimiento</span>
                <span></span>
              </div>
              {lines.map((line, index) => {
                const suggestions = getSuggestions(line.id);
                const selectedProduct = productsByCode.get(line.productCode);
                const lineTotal = (parseFloat(line.quantity) || 0) * (parseFloat(line.unitCost) || 0);
                const expiryValid = Boolean(parseDisplayDate(line.expiryDraft));
                const expiryHint =
                  line.expiryDraft && !expiryValid ? "Formato: dd/mm/aaaa" : undefined;
                return (
                  <div className={`stock-entry-line-card ${line.productCode ? "has-product" : ""}`} key={line.id}>
                    <div className="stock-entry-table-row">
                      <div className="stock-entry-product-cell">
                        <span className="stock-entry-line-num">{index + 1}</span>
                        <div className="stock-entry-product-search">
                          <input
                            className="stock-entry-input"
                            placeholder="Buscar por nombre o código..."
                            value={getInputValue(line)}
                            onFocus={() => {
                              setActiveSearchLineId(line.id);
                              if (line.productCode && selectedProduct) {
                                setSearchTexts((prev) => ({ ...prev, [line.id]: selectedProduct.name }));
                              }
                            }}
                            onChange={(e) => handleSearchChange(line.id, e.target.value)}
                          />
                          {suggestions.length > 0 && (
                            <div className="stock-entry-suggestions">
                              {suggestions.map((p) => (
                                <button
                                  type="button"
                                  key={p.code}
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => selectProduct(line.id, p)}
                                >
                                  <strong>{p.name}</strong>
                                  <span>{p.code} · {p.category}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <input
                        className="stock-entry-input stock-entry-input--num"
                        type="number"
                        min="1"
                        step="1"
                        value={line.quantity}
                        onChange={(e) => updateLine(line.id, { quantity: e.target.value })}
                      />
                      <input
                        className="stock-entry-input stock-entry-input--num"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={line.unitCost}
                        onChange={(e) => updateLine(line.id, { unitCost: e.target.value })}
                      />
                      <input
                        className="stock-entry-input"
                        placeholder="Ej: L-01"
                        value={line.lotNumber}
                        onChange={(e) => updateLine(line.id, { lotNumber: e.target.value })}
                      />
                      <input
                        className={`stock-entry-input stock-entry-input--date ${expiryHint ? "is-invalid" : ""}`}
                        type="text"
                        inputMode="numeric"
                        placeholder="dd/mm/aaaa"
                        value={line.expiryDraft}
                        title={expiryHint}
                        onChange={(e) => updateLine(line.id, { expiryDraft: e.target.value })}
                        onBlur={() => {
                          const parsed = parseDisplayDate(line.expiryDraft);
                          if (parsed) {
                            updateLine(line.id, { expiryDraft: isoToDisplay(parsed) });
                          }
                        }}
                        required
                      />
                      <button type="button" className="stock-entry-remove" onClick={() => removeLine(line.id)} aria-label="Eliminar fila">
                        ×
                      </button>
                    </div>
                    {line.productCode && lineTotal > 0 && (
                      <p className="stock-entry-line-subtotal">
                        Subtotal línea: S/ {lineTotal.toFixed(2)}
                        {line.lotNumber ? ` · Lote ${line.lotNumber}` : ""}
                        {expiryValid ? ` · Vence ${line.expiryDraft}` : expiryHint ? ` · ${expiryHint}` : ""}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <aside className="stock-entry-sidebar card-glass">
        <div className="stock-entry-sidebar-accent" aria-hidden="true" />
        <header className="stock-entry-sidebar-head">
          <div className="stock-entry-sidebar-icon">
            <CheckIcon size={18} />
          </div>
          <div>
            <p className="stock-entry-kicker">Antes de confirmar</p>
            <h3>Resumen global</h3>
            <p>Verifica que todo esté completo.</p>
          </div>
        </header>

        <div className="stock-entry-progress">
          <div className="stock-entry-progress-head">
            <span>Progreso del ingreso</span>
            <strong>{completionPct}%</strong>
          </div>
          <div className="stock-entry-progress-track" role="progressbar" aria-valuenow={completionPct} aria-valuemin={0} aria-valuemax={100}>
            <div className="stock-entry-progress-fill" style={{ width: `${completionPct}%` }} />
          </div>
          <span className="stock-entry-progress-meta">{completionCount} de 3 pasos listos</span>
        </div>

        <ul className="stock-entry-checklist">
          <li className={hasSupplier ? "done" : ""}>
            <span className="stock-entry-check-icon">{hasSupplier ? "✓" : "·"}</span>
            Proveedor seleccionado
          </li>
          <li className={hasDocument ? "done" : ""}>
            <span className="stock-entry-check-icon">{hasDocument ? "✓" : "·"}</span>
            Comprobante completo
          </li>
          <li className={hasItems ? "done" : ""}>
            <span className="stock-entry-check-icon">{hasItems ? "✓" : "·"}</span>
            Productos con lote y vencimiento
          </li>
        </ul>

        <div className="stock-entry-summary-grid">
          <div className="stock-entry-summary-cell">
            <span>Proveedor</span>
            <strong>{selectedSupplier?.name || "—"}</strong>
          </div>
          <div className="stock-entry-summary-cell">
            <span>Ítems</span>
            <strong>{parsedLines.length}</strong>
          </div>
          <div className="stock-entry-summary-cell stock-entry-summary-cell--wide">
            <span>Comprobante</span>
            <strong>{docType} {documentRef || "—"}</strong>
          </div>
          <div className="stock-entry-summary-cell">
            <span>Destino</span>
            <strong>{selectedWarehouse?.name || "—"}</strong>
          </div>
          <div className="stock-entry-summary-cell">
            <span>Condición</span>
            <strong>{paymentCondition === "contado" ? "Contado" : "Crédito"}</strong>
          </div>
        </div>

        <div className="stock-entry-impact">
          <p>Impacto final bruto</p>
          <h2>S/ {total.toFixed(2)}</h2>
          <div className="stock-entry-impact-meta">
            <span>{paymentCondition === "contado" ? `Pagado hoy S/ ${paidToday.toFixed(2)}` : "Pago diferido"}</span>
            <span className={`stock-entry-badge ${paymentCondition === "contado" ? "ok" : "warn"}`}>
              {paymentCondition === "contado" ? "CONTADO" : "CRÉDITO"}
            </span>
          </div>
        </div>

        {projectedCash !== null && paymentCondition === "contado" && paymentMethod === "Efectivo" && (
          <div className="stock-entry-projection">
            <p>Proyección de caja</p>
            <div className="stock-entry-projection-row">
              <span>Caja actual</span>
              <strong>S/ {activeSession!.expectedCash.toFixed(2)}</strong>
            </div>
            <div className="stock-entry-projection-row">
              <span>Remanente proyectado</span>
              <strong className={projectedCash < 0 ? "is-negative" : ""}>S/ {projectedCash.toFixed(2)}</strong>
            </div>
          </div>
        )}

        <button
          type="button"
          className="btn btn-primary stock-entry-confirm"
          disabled={!docComplete || isSubmitting}
          onClick={handleConfirm}
        >
          <CheckIcon size={18} />
          {isSubmitting ? "Procesando..." : "Confirmar movimiento"}
        </button>
      </aside>
    </div>
  );
};