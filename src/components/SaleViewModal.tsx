import React from "react";
import type { Sale } from "./ReceiptPrinter";
import type { StoreConfig } from "../App";
import { TicketIcon, PrinterIcon } from "./Icons";
import { formatDateTime } from "../utils/cashSales";

interface SaleViewModalProps {
  sale: Sale;
  storeConfig: StoreConfig;
  sessionLabel: string;
  onClose: () => void;
  onEdit: () => void;
  onReprint: (sale: Sale) => void;
}

function paymentBadgeClass(method: string) {
  if (method === "Efectivo") return "sales-pay-badge sales-pay-efectivo";
  if (method === "Tarjeta") return "sales-pay-badge sales-pay-tarjeta";
  if (method === "Yape") return "sales-pay-badge sales-pay-yape";
  if (method === "Fiado") return "sales-pay-badge sales-pay-fiado";
  return "sales-pay-badge";
}

export const SaleViewModal: React.FC<SaleViewModalProps> = ({
  sale,
  storeConfig,
  sessionLabel,
  onClose,
  onEdit,
  onReprint,
}) => {
  const isBoleta = sale.documentType === "boleta";

  return (
    <div className="modal-overlay sale-view-overlay" onClick={onClose}>
      <div className="sale-view-modal" onClick={(e) => e.stopPropagation()}>
        <header className="sale-view-header">
          <div className="sale-view-header-top">
            <div className="sale-view-type-pill">
              <TicketIcon size={14} />
              {isBoleta ? "Boleta de Venta" : "Ticket de Venta"}
            </div>
            <button type="button" className="modal-close sale-view-close" onClick={onClose} aria-label="Cerrar">
              ×
            </button>
          </div>
          <h3 className="sale-view-doc-number">{sale.documentNumber || sale.id}</h3>
          <div className="sale-view-header-meta">
            <p className="sale-view-datetime">{formatDateTime(sale.timestamp)}</p>
            <span className={paymentBadgeClass(sale.paymentMethod)}>{sale.paymentMethod}</span>
          </div>
        </header>

        <div className="sale-view-body">
          <section className="sale-view-meta-strip">
            <div className="sale-view-meta-block">
              <p className="sale-view-meta-label">Negocio</p>
              <p className="sale-view-meta-value">{storeConfig.businessName}</p>
            </div>
            <div className="sale-view-meta-block">
              <p className="sale-view-meta-label">Caja</p>
              <p className="sale-view-meta-value">{sessionLabel}</p>
            </div>
            <div className="sale-view-meta-block">
              <p className="sale-view-meta-label">Ítems</p>
              <p className="sale-view-meta-value">
                {sale.items.length} producto{sale.items.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="sale-view-meta-block">
              <p className="sale-view-meta-label">Comprobante</p>
              <p className="sale-view-meta-value">{isBoleta ? "Boleta electrónica" : "Ticket interno"}</p>
            </div>
            {isBoleta && sale.sunatStatus && (
              <div className="sale-view-meta-block">
                <p className="sale-view-meta-label">SUNAT</p>
                <p className="sale-view-meta-value">
                  {sale.sunatStatus === "accepted" && "Aceptada"}
                  {sale.sunatStatus === "pending_summary" && "Pendiente resumen diario"}
                  {sale.sunatStatus === "rejected" && "Rechazada"}
                  {sale.sunatStatus === "not_sent" && "Sin envío"}
                </p>
              </div>
            )}
          </section>

          {(sale.customerName || sale.customerDni) && (
            <section className="sale-view-customer-card">
              <p className="sale-view-meta-label">Cliente</p>
              <div>
                {sale.customerName && <p className="sale-view-meta-value">{sale.customerName}</p>}
                {sale.customerDni && <p className="sale-view-customer-dni">DNI/RUC: {sale.customerDni}</p>}
              </div>
            </section>
          )}

          <section className="sale-view-products">
            <h4 className="sale-view-section-title">Productos</h4>
            <div className="sale-view-item-list">
              {sale.items.map((item, idx) => (
                <div className="sale-view-item-row" key={`${item.code}-${idx}`}>
                  <div className="sale-view-item-main">
                    <p className="sale-view-item-name">{item.name}</p>
                    <p className="sale-view-item-detail">
                      {item.code} · Cant. {item.quantity} · S/ {item.price.toFixed(2)} c/u
                    </p>
                  </div>
                  <p className="sale-view-item-total">S/ {(item.price * item.quantity).toFixed(2)}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="sale-view-summary">
            <h4 className="sale-view-section-title">Resumen</h4>
            <div className="sale-view-summary-card">
              <div className="sale-view-total-row">
                <p>Subtotal</p>
                <p>S/ {sale.subtotal.toFixed(2)}</p>
              </div>
              {sale.discount > 0 && (
                <div className="sale-view-total-row sale-view-discount">
                  <p>Descuento</p>
                  <p>- S/ {sale.discount.toFixed(2)}</p>
                </div>
              )}
              {isBoleta && (
                <>
                  <div className="sale-view-total-row">
                    <p>Op. Gravada</p>
                    <p>S/ {(sale.gravada || 0).toFixed(2)}</p>
                  </div>
                  <div className="sale-view-total-row">
                    <p>IGV (18%)</p>
                    <p>S/ {(sale.igv || 0).toFixed(2)}</p>
                  </div>
                </>
              )}
              <div className="sale-view-total-row grand">
                <p>Total</p>
                <p>S/ {sale.total.toFixed(2)}</p>
              </div>
              {sale.paymentMethod === "Efectivo" && sale.cashReceived !== undefined && (
                <>
                  <div className="sale-view-divider" />
                  <div className="sale-view-total-row">
                    <p>Efectivo recibido</p>
                    <p>S/ {sale.cashReceived.toFixed(2)}</p>
                  </div>
                  <div className="sale-view-total-row">
                    <p>Vuelto</p>
                    <p>S/ {(sale.cashChange || 0).toFixed(2)}</p>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>

        <footer className="sale-view-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cerrar
          </button>
          <button
            type="button"
            className="btn btn-secondary sale-view-btn-reprint"
            onClick={() => onReprint(sale)}
          >
            <PrinterIcon size={16} />
            Reimprimir
          </button>
          <button type="button" className="btn btn-primary" onClick={onEdit}>
            <TicketIcon size={15} />
            Editar venta
          </button>
        </footer>
      </div>
    </div>
  );
};