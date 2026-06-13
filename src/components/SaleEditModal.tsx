import React, { useState } from "react";
import type { Sale, SaleItem } from "./ReceiptPrinter";
import type { StoreConfig } from "../App";
import { recalculateSaleTotals } from "../utils/cashSales";
import { resolveTaxConfig } from "../utils/tax";
import { SelectField, type SelectOption } from "./SelectField";

interface SaleEditModalProps {
  sale: Sale;
  storeConfig?: StoreConfig;
  onSave: (updated: Sale) => void;
  onClose: () => void;
}

const PAYMENT_METHODS = ["Efectivo", "Tarjeta", "Yape", "Fiado"];

const PAYMENT_METHOD_OPTIONS: SelectOption[] = PAYMENT_METHODS.map((m) => ({
  value: m,
  label: m,
}));

function toDatetimeLocalValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const SaleEditModal: React.FC<SaleEditModalProps> = ({ sale, storeConfig, onSave, onClose }) => {
  const [items, setItems] = useState<SaleItem[]>(sale.items.map((i) => ({ ...i })));
  const [discount, setDiscount] = useState(sale.discount);
  const [paymentMethod, setPaymentMethod] = useState(sale.paymentMethod);
  const [cashReceived, setCashReceived] = useState(sale.cashReceived ?? sale.total);
  const [timestamp, setTimestamp] = useState(toDatetimeLocalValue(sale.timestamp));

  const totals = recalculateSaleTotals(items, discount, resolveTaxConfig(storeConfig));
  const cashChange =
    paymentMethod === "Efectivo"
      ? parseFloat(Math.max(0, cashReceived - totals.total).toFixed(2))
      : 0;

  const updateItem = (index: number, field: keyof SaleItem, value: string | number) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      alert("La venta debe tener al menos un producto.");
      return;
    }
    if (items.some((i) => i.quantity <= 0 || i.price < 0)) {
      alert("Cantidades y precios deben ser válidos.");
      return;
    }

    onSave({
      ...sale,
      items,
      discount,
      paymentMethod,
      subtotal: totals.subtotal,
      total: totals.total,
      gravada: totals.gravada,
      igv: totals.igv,
      cashReceived: paymentMethod === "Efectivo" ? cashReceived : undefined,
      cashChange: paymentMethod === "Efectivo" ? cashChange : undefined,
      timestamp: new Date(timestamp).toISOString(),
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Editar Venta {sale.documentNumber ? `— ${sale.documentNumber}` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Fecha y hora</label>
              <input
                type="datetime-local"
                className="form-control"
                value={timestamp}
                onChange={(e) => setTimestamp(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <SelectField
                label="Método de pago"
                value={paymentMethod}
                options={PAYMENT_METHOD_OPTIONS}
                onChange={setPaymentMethod}
                accent="cyan"
              />
            </div>
          </div>

          <div className="card-glass" style={{ padding: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase" }}>
              Productos
            </div>
            {items.map((item, idx) => (
              <div key={`${item.code}-${idx}`} style={{ display: "grid", gridTemplateColumns: "1fr 80px 100px", gap: 8, marginBottom: 8 }}>
                <input
                  className="form-control"
                  value={item.name}
                  onChange={(e) => updateItem(idx, "name", e.target.value)}
                  readOnly
                  style={{ fontSize: 13 }}
                />
                <input
                  type="number"
                  min={1}
                  className="form-control"
                  value={item.quantity}
                  onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 0)}
                  title="Cantidad"
                />
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  className="form-control"
                  value={item.price}
                  onChange={(e) => updateItem(idx, "price", parseFloat(e.target.value) || 0)}
                  title="Precio unitario"
                />
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Descuento (S/)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                className="form-control"
                value={discount}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
              />
            </div>
            {paymentMethod === "Efectivo" && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Efectivo recibido</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  className="form-control"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(parseFloat(e.target.value) || 0)}
                />
              </div>
            )}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Total</label>
              <div className="form-control surface-panel" style={{ fontWeight: 700, color: "var(--color-accent-price)" }}>
                S/ {totals.total.toFixed(2)}
              </div>
            </div>
          </div>

          {paymentMethod === "Fiado" && (
            <p style={{ fontSize: 12, color: "var(--warning)", marginBottom: 12 }}>
              Nota: cambios en ventas fiadas no actualizan automáticamente las cuentas por cobrar.
            </p>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
              Guardar cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};