import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useI18n } from "../i18n";
import {
  buildSunatQrPayload,
  formatReceiptDate,
} from "../utils/documents";
import { resolveTaxConfig, taxLabel } from "../utils/tax";
import { formatCurrency, normalizeCurrency } from "../utils/currency";
import type { StoreConfig } from "../types/store";

export interface SaleLotAllocation {
  lotId: string;
  lotNumber: string;
  warehouseId: string;
  quantity: number;
  unitCost?: number;
}

export interface SaleItem {
  code: string;
  name: string;
  price: number;
  quantity: number;
  lotAllocations?: SaleLotAllocation[];
}

export interface Sale {
  id: string;
  sessionId?: string;
  timestamp: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  cashReceived?: number;
  cashChange?: number;
  documentType?: "ticket" | "boleta";
  documentNumber?: string;
  customerDni?: string;
  customerName?: string;
  gravada?: number;
  igv?: number;
  sunatQrPayload?: string;
  sunatHash?: string;
  sunatCdrCode?: string;
  sunatStatus?: "accepted" | "rejected" | "pending_summary" | "not_sent";
  sunatPendingSummary?: boolean;
}

interface ReceiptPrinterProps {
  sale: Sale | null;
  storeConfig: StoreConfig;
}

export const ReceiptPrinter: React.FC<ReceiptPrinterProps> = ({ sale, storeConfig }) => {
  const { t, locale } = useI18n();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const taxConfig = resolveTaxConfig({ tax: storeConfig.tax, language: locale });
  const currency = normalizeCurrency(storeConfig.currency, locale);
  const money = (amount: number) => formatCurrency(amount, currency);

  useEffect(() => {
    if (!sale || sale.documentType !== "boleta") {
      setQrDataUrl(null);
      return;
    }

    const payload =
      sale.sunatQrPayload || buildSunatQrPayload(storeConfig.ruc, sale);
    QRCode.toDataURL(payload, {
      width: 120,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [sale, storeConfig.ruc]);

  if (!sale) return null;

  const isBoleta = sale.documentType === "boleta";
  const sunatAccepted = sale.sunatStatus === "accepted";
  const sunatPending = sale.sunatStatus === "pending_summary";
  const businessName = storeConfig.businessName.trim() || "Nifty Retail";

  const footerLegalLine = (() => {
    if (isBoleta && sunatAccepted) {
      return "Representación impresa — Boleta Electrónica SUNAT";
    }
    if (isBoleta && sunatPending) {
      return "Boleta registrada — incluida en resumen diario SUNAT";
    }
    if (isBoleta) {
      return "Comprobante interno — boleta sin validación SUNAT";
    }
    return "Comprobante interno de venta — no es documento tributario";
  })();

  return (
    <div className="receipt-print-container" id="receipt-print-area">
      <div className="receipt-brand-block">
        <h2 className="receipt-business-name">{businessName.toUpperCase()}</h2>
        <p className="receipt-meta-line">{storeConfig.address}</p>
        <p className="receipt-meta-line">RUC: {storeConfig.ruc}</p>
      </div>

      <div className="receipt-divider" />

      <div className="receipt-doc-block">
        {isBoleta ? (
          <>
            <p className="receipt-doc-title">BOLETA DE VENTA ELECTRÓNICA</p>
            <p className="receipt-doc-number">{sale.documentNumber}</p>
          </>
        ) : (
          <>
            <p className="receipt-doc-title">TICKET DE VENTA INTERNO</p>
            <p className="receipt-doc-number">{sale.documentNumber || sale.id.replace("sale_", "")}</p>
          </>
        )}
      </div>

      <div className="receipt-divider" />

      <div className="receipt-info-block">
        <p className="receipt-info-line">Fecha: {formatReceiptDate(sale.timestamp)}</p>
        <p className="receipt-info-line">Cajero: Operador</p>
        {(sale.customerName || sale.customerDni) && (
          <>
            <p className="receipt-info-line receipt-info-label">Adquiriente:</p>
            {sale.customerName && (
              <p className="receipt-info-line receipt-customer-name">{sale.customerName.toUpperCase()}</p>
            )}
            {sale.customerDni && (
              <p className="receipt-info-line">DNI/RUC: {sale.customerDni}</p>
            )}
          </>
        )}
      </div>

      <div className="receipt-divider" />

      <table className="receipt-table">
        <thead>
          <tr>
            <th className="th-desc">Cant - Producto</th>
            <th className="th-price">P. Unit</th>
            <th className="th-total">Total</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((item, idx) => (
            <tr key={idx}>
              <td className="receipt-item-desc">
                <span className="receipt-item-qty">{item.quantity} x</span>{" "}
                {item.name.length > 22 ? `${item.name.substring(0, 22)}…` : item.name}
              </td>
              <td>{money(item.price)}</td>
              <td>{money(item.price * item.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="receipt-divider" />

      <div className="receipt-totals">
        {(isBoleta || taxConfig.region === "us") && (sale.gravada || sale.igv) ? (
          <>
            <div className="receipt-row">
              <span>{t("tax.taxableAmount")}:</span>
              <span>{money(sale.gravada || 0)}</span>
            </div>
            <div className="receipt-row">
              <span>{taxLabel(taxConfig, t)}:</span>
              <span>{money(sale.igv || 0)}</span>
            </div>
          </>
        ) : (
          <div className="receipt-row">
            <span>{t("pos.subtotal")}:</span>
            <span>{money(sale.subtotal)}</span>
          </div>
        )}

        {sale.discount > 0 && (
          <div className="receipt-row">
            <span>{t("pos.discount")}:</span>
            <span>- {money(sale.discount)}</span>
          </div>
        )}

        <div className="receipt-row receipt-total-row">
          <span>{t("pos.total").toUpperCase()}:</span>
          <span>{money(sale.total)}</span>
        </div>

        <div className="receipt-divider receipt-divider-dotted" />

        <div className="receipt-row">
          <span>Met. Pago:</span>
          <span>{sale.paymentMethod}</span>
        </div>

        {sale.paymentMethod === "Efectivo" && sale.cashReceived !== undefined && (
          <>
            <div className="receipt-row">
              <span>Efectivo Recibido:</span>
              <span>{money(sale.cashReceived)}</span>
            </div>
            <div className="receipt-row">
              <span>{t("pos.change")}:</span>
              <span>{money(sale.cashChange || 0)}</span>
            </div>
          </>
        )}
      </div>

      {isBoleta && (
        <>
          <div className="receipt-divider" />
          <div className="receipt-qr-block">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Código QR SUNAT" className="receipt-qr-image" />
            ) : (
              <div className="receipt-qr-placeholder">Generando QR…</div>
            )}
            <p className="receipt-qr-legend">
              Representación impresa de la Boleta de Venta Electrónica.
              <br />
              Autorizado mediante Resolución de SUNAT.
            </p>
            {sunatAccepted && (
              <p className="receipt-qr-note receipt-qr-note-ok">
                Comprobante aceptado por SUNAT
                {sale.sunatCdrCode ? ` (CDR ${sale.sunatCdrCode})` : ""}.
              </p>
            )}
            {sunatPending && (
              <p className="receipt-qr-note">
                Boleta registrada — se incluirá en el resumen diario SUNAT (ventas menores a S/ 700).
              </p>
            )}
            {!sunatAccepted && !sunatPending && (
              <p className="receipt-qr-note">
                QR de representación impresa — active SUNAT en Configuración para emisión electrónica.
              </p>
            )}
          </div>
        </>
      )}

      <div className="receipt-divider" />

      <div className="receipt-footer">
        <p>¡Gracias por su compra en</p>
        <p className="receipt-footer-brand">{businessName}!</p>
        <p>Conserve su comprobante.</p>
        <p className="receipt-small">{footerLegalLine}</p>
      </div>
    </div>
  );
};