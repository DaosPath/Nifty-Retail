import React, { useMemo, useState } from "react";
import type { Sale } from "./ReceiptPrinter";
import type { StoreConfig } from "../types/store";
import { EditIcon, DeleteIcon, FolderIcon } from "./Icons";
import { SaleEditModal } from "./SaleEditModal";
import {
  type CashSession,
  formatDateTime,
  getSessionSales,
  recalculateSession,
} from "../utils/cashSales";

function toDatetimeLocalValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface SessionEditModalProps {
  session: CashSession;
  sales: Sale[];
  sessions: CashSession[];
  storeConfig?: StoreConfig;
  onSave: (session: CashSession) => void;
  onUpdateSale: (saleId: string, updated: Sale) => void;
  onDeleteSale: (saleId: string) => void;
  onClose: () => void;
}

export const SessionEditModal: React.FC<SessionEditModalProps> = ({
  session,
  sales,
  sessions,
  storeConfig,
  onSave,
  onUpdateSale,
  onDeleteSale,
  onClose,
}) => {
  const [form, setForm] = useState({
    initialBalance: session.initialBalance,
    deposits: session.deposits,
    withdrawals: session.withdrawals,
    actualCash: session.actualCash ?? 0,
    notes: session.notes || "",
    startTime: toDatetimeLocalValue(session.startTime),
    endTime: session.endTime ? toDatetimeLocalValue(session.endTime) : "",
  });
  const [editingSale, setEditingSale] = useState<Sale | null>(null);

  const sessionSales = useMemo(
    () => getSessionSales(sales, session.id, sessions),
    [sales, session.id, sessions]
  );

  const preview = useMemo(() => {
    const draft: CashSession = {
      ...session,
      initialBalance: form.initialBalance,
      deposits: form.deposits,
      withdrawals: form.withdrawals,
      actualCash: session.endTime ? form.actualCash : null,
      notes: form.notes,
      startTime: new Date(form.startTime).toISOString(),
      endTime: form.endTime ? new Date(form.endTime).toISOString() : null,
    };
    return recalculateSession(draft, sessionSales);
  }, [session, form, sessionSales]);

  const isClosed = Boolean(session.endTime);
  const isActive = !session.endTime;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...preview,
      notes: form.notes,
      startTime: new Date(form.startTime).toISOString(),
      endTime: form.endTime ? new Date(form.endTime).toISOString() : null,
      actualCash: form.endTime ? form.actualCash : null,
      difference: form.endTime ? preview.difference : null,
    });
    onClose();
  };

  const handleDeleteSale = (sale: Sale) => {
    if (!confirm(`¿Eliminar venta ${sale.documentNumber || sale.id}?`)) return;
    onDeleteSale(sale.id);
  };

  const diffMeta = (() => {
    if (preview.difference === null) return null;
    if (preview.difference === 0) {
      return { label: "Caja cuadrada", className: "session-edit-diff session-edit-diff--ok" };
    }
    if (preview.difference > 0) {
      return {
        label: `Sobrante: S/ ${preview.difference.toFixed(2)}`,
        className: "session-edit-diff session-edit-diff--surplus",
      };
    }
    return {
      label: `Faltante: S/ ${Math.abs(preview.difference).toFixed(2)}`,
      className: "session-edit-diff session-edit-diff--short",
    };
  })();

  return (
    <div className="modal-overlay session-edit-overlay" onClick={onClose}>
      <div className="session-edit-modal" onClick={(e) => e.stopPropagation()}>
        <header className="session-edit-header">
          <div className="session-edit-header-main">
            <div className="session-edit-icon">
              <FolderIcon size={20} />
            </div>
            <div>
              <p className="session-edit-kicker">Edición de turno</p>
              <h3>Editar caja</h3>
              <p className="session-edit-subtitle">Apertura {formatDateTime(session.startTime)}</p>
            </div>
          </div>
          <div className="session-edit-header-actions">
            <span className={`session-edit-status ${isActive ? "is-active" : "is-closed"}`}>
              {isActive ? "Caja activa" : "Caja cerrada"}
            </span>
            <button type="button" className="modal-close session-edit-close" onClick={onClose}>
              ×
            </button>
          </div>
        </header>

        <form className="session-edit-body" onSubmit={handleSubmit}>
          <section className="session-edit-panel">
            <div className="session-edit-panel-head">
              <span className="session-edit-step">1</span>
              <div>
                <h4>Datos del turno</h4>
                <p>Horarios, montos iniciales y movimientos manuales de efectivo.</p>
              </div>
            </div>

            <div className="session-edit-grid">
              <div className="form-group">
                <label>Apertura</label>
                <input
                  type="datetime-local"
                  className="form-control session-edit-datetime"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Cierre</label>
                <input
                  type="datetime-local"
                  className="form-control session-edit-datetime"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Monto inicial</label>
                <div className="session-edit-money">
                  <span>S/</span>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={form.initialBalance}
                    onChange={(e) => setForm({ ...form, initialBalance: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Entradas extra</label>
                <div className="session-edit-money">
                  <span>S/</span>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={form.deposits}
                    onChange={(e) => setForm({ ...form, deposits: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Salidas</label>
                <div className="session-edit-money">
                  <span>S/</span>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={form.withdrawals}
                    onChange={(e) => setForm({ ...form, withdrawals: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              {isClosed && (
                <div className="form-group">
                  <label>Efectivo físico contado</label>
                  <div className="session-edit-money">
                    <span>S/</span>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={form.actualCash}
                      onChange={(e) => setForm({ ...form, actualCash: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="form-group session-edit-notes">
              <label>Notas / observaciones</label>
              <textarea
                className="form-control"
                rows={2}
                placeholder="Detalles del cuadre, faltantes o vales..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </section>

          <section className="session-edit-panel session-edit-panel--summary">
            <div className="session-edit-panel-head">
              <span className="session-edit-step">2</span>
              <div>
                <h4>Resumen calculado</h4>
                <p>Totales derivados de las ventas y movimientos del turno.</p>
              </div>
            </div>

            <div className="session-edit-metrics">
              <div className="session-edit-metric">
                <span>Ventas efectivo</span>
                <strong>S/ {preview.salesCash.toFixed(2)}</strong>
              </div>
              <div className="session-edit-metric">
                <span>Ventas tarjeta</span>
                <strong>S/ {preview.salesCard.toFixed(2)}</strong>
              </div>
              <div className="session-edit-metric">
                <span>Ventas Yape</span>
                <strong>S/ {(preview.salesYape || 0).toFixed(2)}</strong>
              </div>
              <div className="session-edit-metric session-edit-metric--accent">
                <span>Esperado en caja</span>
                <strong>S/ {preview.expectedCash.toFixed(2)}</strong>
              </div>
            </div>

            {diffMeta && <div className={diffMeta.className}>{diffMeta.label}</div>}
          </section>

          <section className="session-edit-panel session-edit-panel--sales">
            <div className="session-edit-panel-head session-edit-panel-head--inline">
              <span className="session-edit-step">3</span>
              <div>
                <h4>Ventas de esta caja ({sessionSales.length})</h4>
                <p>Edita o elimina ventas vinculadas a este turno.</p>
              </div>
            </div>

            {sessionSales.length === 0 ? (
              <div className="session-edit-sales-empty">No hay ventas registradas en esta caja.</div>
            ) : (
              <div className="session-edit-table-wrap">
                <table className="session-edit-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Documento</th>
                      <th>Total</th>
                      <th>Pago</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionSales.map((sale) => (
                      <tr key={sale.id}>
                        <td className="session-edit-date">{formatDateTime(sale.timestamp)}</td>
                        <td>
                          <span className="session-edit-doc">{sale.documentNumber || "—"}</span>
                        </td>
                        <td className="session-edit-amount">S/ {sale.total.toFixed(2)}</td>
                        <td>
                          <span className="session-edit-pay">{sale.paymentMethod}</span>
                        </td>
                        <td>
                          <div className="session-edit-row-actions">
                            <button
                              type="button"
                              className="sales-icon-btn sales-icon-btn-edit"
                              title="Editar venta"
                              onClick={() => setEditingSale(sale)}
                            >
                              <EditIcon size={14} />
                            </button>
                            <button
                              type="button"
                              className="sales-icon-btn sales-icon-btn-delete"
                              title="Eliminar venta"
                              onClick={() => handleDeleteSale(sale)}
                            >
                              <DeleteIcon size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <footer className="session-edit-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary session-edit-save">
              Guardar caja
            </button>
          </footer>
        </form>

        {editingSale && (
          <SaleEditModal
            sale={editingSale}
            storeConfig={storeConfig}
            onClose={() => setEditingSale(null)}
            onSave={(updated) => {
              onUpdateSale(editingSale.id, updated);
              setEditingSale(null);
            }}
          />
        )}
      </div>
    </div>
  );
};