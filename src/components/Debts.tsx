import React, { useMemo, useState } from "react";
import {
  UserIcon,
  PlusIcon,
  CashIcon,
  HistoryIcon,
  BoxIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  EyeIcon,
  TicketIcon,
  ChartIcon,
} from "./Icons";
import type { StockPurchase, SupplierDebt } from "../types/stock";
import type { Sale } from "./ReceiptPrinter";
import type { StoreConfig } from "../App";
import type { CashSession } from "../utils/cashSales";
import { SaleViewModal } from "./SaleViewModal";
import { useI18n } from "../i18n";
import { useMoney } from "../hooks/useMoney";
import { localizeWarehouseLegacyName } from "../utils/catalogHelpers";

export interface DebtHistoryEntry {
  id: string;
  date: string;
  amount: number;
  type: "sale" | "payment";
  notes?: string;
  saleId?: string;
}

export interface CustomerDebt {
  id: string;
  customerName: string;
  customerPhone?: string;
  customerDni?: string;
  totalDebt: number;
  history: DebtHistoryEntry[];
}

type DebtTab = "internas" | "externas";

interface SupplierInvoiceRow {
  purchaseId: string;
  documentRef: string;
  docType: string;
  date: string;
  total: number;
  paid: number;
  balance: number;
  purchase: StockPurchase | null;
}

function safeAmount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeCustomerDebts(debts: CustomerDebt[]): CustomerDebt[] {
  return (debts || []).map((d) => ({
    ...d,
    totalDebt: safeAmount(d.totalDebt),
    history: Array.isArray(d.history) ? d.history : [],
  }));
}

function normalizeSupplierDebts(debts: SupplierDebt[]): SupplierDebt[] {
  return (debts || []).map((d) => ({
    ...d,
    totalDebt: safeAmount(d.totalDebt),
    history: Array.isArray(d.history) ? d.history : [],
  }));
}

function buildSupplierInvoices(
  supplierDebt: SupplierDebt,
  stockPurchases: StockPurchase[] = []
): SupplierInvoiceRow[] {
  const history = Array.isArray(supplierDebt.history) ? supplierDebt.history : [];
  const purchases = Array.isArray(stockPurchases) ? stockPurchases : [];

  const purchaseEntries = history
    .filter((h) => h.type === "purchase" && h.purchaseId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return purchaseEntries.map((entry) => {
    const purchaseId = entry.purchaseId!;
    const purchase = purchases.find((p) => p.id === purchaseId) || null;
    const total = safeAmount(entry.amount);
    const paid = history
      .filter((h) => h.type === "payment" && h.purchaseId === purchaseId)
      .reduce((sum, h) => sum + Math.abs(safeAmount(h.amount)), 0);

    return {
      purchaseId,
      documentRef: purchase?.documentRef || entry.notes || "—",
      docType: purchase?.docType || "",
      date: entry.date,
      total,
      paid,
      balance: Math.max(0, total - paid),
      purchase,
    };
  });
}

function getPaymentsForPurchase(supplierDebt: SupplierDebt, purchaseId: string) {
  const history = Array.isArray(supplierDebt.history) ? supplierDebt.history : [];
  return history
    .filter((h) => h.type === "payment" && h.purchaseId === purchaseId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

interface DebtsProps {
  debts: CustomerDebt[];
  supplierDebts: SupplierDebt[];
  stockPurchases?: StockPurchase[];
  sales?: Sale[];
  storeConfig?: StoreConfig;
  cashSessions?: CashSession[];
  onAddDebtCustomer: (name: string, phone: string, dni: string) => void;
  onRecordPayment: (customerId: string, amount: number, notes: string) => void;
  onRecordSupplierPayment: (
    supplierDebtId: string,
    amount: number,
    notes: string,
    purchaseId?: string
  ) => void;
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleString("es-PE", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function formatShortDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export const Debts: React.FC<DebtsProps> = ({
  debts = [],
  supplierDebts = [],
  stockPurchases = [],
  sales = [],
  storeConfig,
  cashSessions = [],
  onAddDebtCustomer,
  onRecordPayment,
  onRecordSupplierPayment,
}) => {
  const { formatMoney } = useMoney();
  const [tab, setTab] = useState<DebtTab>("internas");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedSupplierDebtId, setSelectedSupplierDebtId] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newDni, setNewDni] = useState("");

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentPurchaseId, setPaymentPurchaseId] = useState<string | null>(null);

  const [viewingPurchaseId, setViewingPurchaseId] = useState<string | null>(null);
  const [viewingSaleId, setViewingSaleId] = useState<string | null>(null);

  const customerRows = useMemo(() => normalizeCustomerDebts(debts), [debts]);
  const supplierRows = useMemo(() => normalizeSupplierDebts(supplierDebts), [supplierDebts]);

  const totals = useMemo(() => {
    const porCobrar = customerRows.reduce((sum, d) => sum + Math.max(0, d.totalDebt), 0);
    const porPagar = supplierRows.reduce((sum, d) => sum + Math.max(0, d.totalDebt), 0);
    return { porCobrar, porPagar, neto: porCobrar - porPagar };
  }, [customerRows, supplierRows]);

  const filteredCustomers = useMemo(
    () =>
      customerRows.filter(
        (d) =>
          d.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (d.customerDni && d.customerDni.includes(searchQuery)) ||
          (d.customerPhone && d.customerPhone.includes(searchQuery))
      ),
    [customerRows, searchQuery]
  );

  const filteredSuppliers = useMemo(
    () =>
      supplierRows.filter(
        (d) =>
          d.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.supplierId.includes(searchQuery)
      ),
    [supplierRows, searchQuery]
  );

  const selectedCustomer = customerRows.find((d) => d.id === selectedCustomerId) || null;
  const selectedSupplierDebt = supplierRows.find((d) => d.id === selectedSupplierDebtId) || null;

  const supplierInvoices = useMemo(
    () =>
      selectedSupplierDebt
        ? buildSupplierInvoices(selectedSupplierDebt, stockPurchases)
        : [],
    [selectedSupplierDebt, stockPurchases]
  );

  const viewingInvoice = useMemo(
    () => supplierInvoices.find((inv) => inv.purchaseId === viewingPurchaseId) || null,
    [supplierInvoices, viewingPurchaseId]
  );

  const paymentInvoice = useMemo(
    () => supplierInvoices.find((inv) => inv.purchaseId === paymentPurchaseId) || null,
    [supplierInvoices, paymentPurchaseId]
  );

  const activeDebt =
    tab === "internas"
      ? selectedCustomer?.totalDebt ?? 0
      : paymentInvoice
        ? paymentInvoice.balance
        : selectedSupplierDebt?.totalDebt ?? 0;

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      alert("Ingrese el nombre del cliente.");
      return;
    }
    onAddDebtCustomer(newName.trim(), newPhone.trim(), newDni.trim());
    setNewName("");
    setNewPhone("");
    setNewDni("");
    setShowAddModal(false);
  };

  const openPaymentModal = (purchaseId?: string) => {
    if (purchaseId) {
      const invoice = supplierInvoices.find((inv) => inv.purchaseId === purchaseId);
      setPaymentPurchaseId(purchaseId);
      setPaymentAmount(invoice && invoice.balance > 0 ? String(invoice.balance) : "");
    } else {
      setPaymentPurchaseId(null);
      setPaymentAmount(activeDebt > 0 ? String(activeDebt) : "");
    }
    setPaymentNotes("");
    setShowPaymentModal(true);
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Ingrese un monto válido.");
      return;
    }

    if (tab === "internas" && selectedCustomer) {
      if (amount > selectedCustomer.totalDebt) {
        if (
          !window.confirm(
            `El monto (${formatMoney(amount)}) supera la deuda (${formatMoney(selectedCustomer.totalDebt)}). ¿Registrar igual?`
          )
        ) {
          return;
        }
      }
      onRecordPayment(selectedCustomer.id, amount, paymentNotes.trim() || "Abono a cuenta");
    } else if (tab === "externas" && selectedSupplierDebt) {
      const maxDebt = paymentInvoice ? paymentInvoice.balance : selectedSupplierDebt.totalDebt;
      if (amount > maxDebt) {
        if (
          !window.confirm(
            `El monto (${formatMoney(amount)}) supera el saldo (${formatMoney(maxDebt)}). ¿Registrar igual?`
          )
        ) {
          return;
        }
      }
      const notes =
        paymentNotes.trim() ||
        (paymentInvoice
          ? `Pago ${paymentInvoice.documentRef}`
          : "Pago a proveedor");
      onRecordSupplierPayment(
        selectedSupplierDebt.id,
        amount,
        notes,
        paymentPurchaseId || undefined
      );
    } else {
      return;
    }

    setPaymentAmount("");
    setPaymentNotes("");
    setPaymentPurchaseId(null);
    setShowPaymentModal(false);
  };

  const viewingSale = useMemo(
    () => (viewingSaleId ? sales.find((s) => s.id === viewingSaleId) || null : null),
    [sales, viewingSaleId]
  );

  const switchTab = (next: DebtTab) => {
    setTab(next);
    setSearchQuery("");
    setViewingPurchaseId(null);
    setViewingSaleId(null);
    setPaymentPurchaseId(null);
  };

  return (
    <div className="debts-page">
      <header className="debts-page-hero debts-hero card-glass">
        <div className="debts-page-hero-main">
          <div className="debts-page-hero-icon">
            <ChartIcon size={22} />
          </div>
          <div className="debts-page-hero-copy">
            <p className="debts-kicker">Control financiero</p>
            <h2>Deudas internas y externas</h2>
            <div className="debts-page-legend">
              <span className="debts-legend-pill debts-legend-pill--in">
                <ArrowDownIcon size={12} />
                Internas · fiado POS
              </span>
              <span className="debts-legend-pill debts-legend-pill--out">
                <ArrowUpIcon size={12} />
                Externas · crédito proveedor
              </span>
            </div>
          </div>
        </div>

        <div className="debts-hero-stats">
          <div className="debts-stat-card debts-stat debts-stat--in">
            <div className="debts-stat-card-icon">
              <ArrowDownIcon size={16} />
            </div>
            <div>
              <span>Por cobrar</span>
              <strong>{formatMoney(totals.porCobrar)}</strong>
            </div>
          </div>
          <div className="debts-stat-card debts-stat debts-stat--out">
            <div className="debts-stat-card-icon">
              <ArrowUpIcon size={16} />
            </div>
            <div>
              <span>Por pagar</span>
              <strong>{formatMoney(totals.porPagar)}</strong>
            </div>
          </div>
          <div className={`debts-stat-card debts-stat debts-stat--net ${totals.neto >= 0 ? "positive" : "negative"}`}>
            <div className="debts-stat-card-icon">
              <ChartIcon size={16} />
            </div>
            <div>
              <span>Balance neto</span>
              <strong>{formatMoney(totals.neto)}</strong>
            </div>
          </div>
        </div>
      </header>

      <div className="debts-tabs">
        <button
          type="button"
          className={`debts-tab debts-tab--in ${tab === "internas" ? "active" : ""}`}
          onClick={() => switchTab("internas")}
        >
          <div className="debts-tab-icon">
            <UserIcon size={18} />
          </div>
          <div className="debts-tab-copy">
            <strong>Deudas internas</strong>
            <span>Clientes · nos deben</span>
          </div>
          <div className="debts-tab-amount">
            <em>{formatMoney(totals.porCobrar)}</em>
            <small>por cobrar</small>
          </div>
        </button>
        <button
          type="button"
          className={`debts-tab debts-tab--out ${tab === "externas" ? "active" : ""}`}
          onClick={() => switchTab("externas")}
        >
          <div className="debts-tab-icon">
            <BoxIcon size={18} />
          </div>
          <div className="debts-tab-copy">
            <strong>Deudas externas</strong>
            <span>Proveedores · debemos</span>
          </div>
          <div className="debts-tab-amount">
            <em>{formatMoney(totals.porPagar)}</em>
            <small>por pagar</small>
          </div>
        </button>
      </div>

      <div className="debts-layout">
        <aside
          className={`debts-list-panel card-glass ${
            tab === "externas" ? "debts-list-panel--supplier" : "debts-list-panel--customer"
          }`}
        >
          <div className="debts-list-head">
            <div className="debts-list-head-main">
              <div
                className={`debts-list-head-icon ${
                  tab === "externas" ? "is-supplier" : "is-customer"
                }`}
              >
                {tab === "internas" ? <UserIcon size={18} /> : <BoxIcon size={18} />}
              </div>
              <div>
                <h3>{tab === "internas" ? "Clientes / Fiado" : "Proveedores / Crédito"}</h3>
                <p className="debts-list-head-meta">
                  {tab === "internas"
                    ? `${filteredCustomers.length} cliente${filteredCustomers.length !== 1 ? "s" : ""}`
                    : `${filteredSuppliers.length} proveedor${filteredSuppliers.length !== 1 ? "es" : ""}`}
                </p>
              </div>
            </div>
            {tab === "internas" && (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
                <PlusIcon size={12} /> Nuevo
              </button>
            )}
          </div>

          {tab === "internas" && (
            <p className="debts-list-hint debts-list-hint--customer">
              Se generan al vender con pago <strong>Fiado</strong> en el POS o al registrar un cliente manualmente.
            </p>
          )}

          {tab === "externas" && (
            <p className="debts-list-hint">
              Se generan al confirmar compras con condición <strong>Crédito proveedor</strong> en Ingreso de Stock.
            </p>
          )}

          <div className="debts-search-wrap">
            <input
              type="text"
              className="debts-search"
              placeholder={tab === "internas" ? "Buscar por nombre, DNI o cel..." : "Buscar proveedor..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="debts-list-scroll">
            {tab === "internas" &&
              filteredCustomers.map((c) => {
                const saleCount = c.history.filter((h) => h.type === "sale").length;
                const paymentCount = c.history.filter((h) => h.type === "payment").length;
                return (
                  <button
                    type="button"
                    key={c.id}
                    className={`debts-list-item ${selectedCustomerId === c.id ? "active" : ""}`}
                    onClick={() => {
                      setSelectedCustomerId(c.id);
                      setViewingSaleId(null);
                    }}
                  >
                    <div className="debts-list-item-inner">
                      <div className="debts-list-avatar debts-list-avatar--customer">
                        {getInitials(c.customerName)}
                      </div>
                      <div className="debts-list-item-body">
                        <div className="debts-list-item-top">
                          <strong>{c.customerName}</strong>
                          <span className={`debts-list-amount ${c.totalDebt > 0 ? "amount-due" : "amount-clear"}`}>
                            {formatMoney(c.totalDebt)}
                          </span>
                        </div>
                        <div className="debts-list-item-meta">
                          <span>DNI: {c.customerDni || "—"}</span>
                          <span>Tel: {c.customerPhone || "—"}</span>
                        </div>
                        <div className="debts-list-badges">
                          <span className="debts-list-badge debts-list-badge--sale">
                            {saleCount} venta{saleCount !== 1 ? "s" : ""} fiado
                          </span>
                          <span className="debts-list-badge debts-list-badge--pay">
                            {paymentCount} cobro{paymentCount !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}

            {tab === "externas" &&
              filteredSuppliers.map((s) => {
                const purchaseCount = s.history.filter((h) => h.type === "purchase").length;
                const paymentCount = s.history.filter((h) => h.type === "payment").length;
                return (
                  <button
                    type="button"
                    key={s.id}
                    className={`debts-list-item debts-list-item--supplier ${selectedSupplierDebtId === s.id ? "active" : ""}`}
                    onClick={() => {
                      setSelectedSupplierDebtId(s.id);
                      setViewingPurchaseId(null);
                    }}
                  >
                    <div className="debts-list-item-inner">
                      <div className="debts-list-avatar debts-list-avatar--supplier">
                        {getInitials(s.supplierName)}
                      </div>
                      <div className="debts-list-item-body">
                        <strong className="debts-list-item-name">{s.supplierName}</strong>
                        <div className="debts-list-badges">
                          <span className="debts-list-badge">
                            {purchaseCount} compra{purchaseCount !== 1 ? "s" : ""}
                          </span>
                          <span className="debts-list-badge debts-list-badge--pay">
                            {paymentCount} pago{paymentCount !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                      <div
                        className={`debts-list-amount-pill ${
                          s.totalDebt > 0 ? "has-debt" : "is-clear"
                        }`}
                      >
                        <span>Saldo</span>
                        <strong>{formatMoney(s.totalDebt)}</strong>
                      </div>
                    </div>
                  </button>
                );
              })}

            {tab === "internas" && filteredCustomers.length === 0 && (
              <div className="debts-list-empty">No hay clientes con deuda registrados.</div>
            )}
            {tab === "externas" && filteredSuppliers.length === 0 && (
              <div className="debts-list-empty">
                No hay deuda con proveedores. Registra una compra a crédito en Ingreso de Stock.
              </div>
            )}
          </div>
        </aside>

        <section className="debts-detail-panel card-glass">
          {tab === "internas" && selectedCustomer ? (
            <CustomerDebtDetail
              customer={selectedCustomer}
              sales={sales}
              onPay={() => openPaymentModal()}
              onViewSale={(saleId) => setViewingSaleId(saleId)}
            />
          ) : tab === "externas" && selectedSupplierDebt ? (
            <SupplierDebtDetail
              supplierName={selectedSupplierDebt.supplierName}
              totalDebt={selectedSupplierDebt.totalDebt}
              invoices={supplierInvoices}
              onViewInvoice={(purchaseId) => setViewingPurchaseId(purchaseId)}
              onPayInvoice={(purchaseId) => openPaymentModal(purchaseId)}
            />
          ) : (
            <div className="debts-detail-empty">
              {tab === "internas" ? <UserIcon size={48} /> : <BoxIcon size={48} />}
              <h3>
                {tab === "internas" ? "Seleccione un cliente" : "Seleccione un proveedor"}
              </h3>
              <p>
                {tab === "internas"
                  ? "Elija un cliente de la lista para ver cargos por fiado, cobros y registrar abonos parciales."
                  : "Elija un proveedor para ver comprobantes a crédito, pagos parciales e historial."}
              </p>
            </div>
          )}
        </section>
      </div>

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Registrar cliente para fiado</h3>
              <button type="button" className="modal-close" onClick={() => setShowAddModal(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleCreateCustomer}>
              <div className="form-group">
                <label>Nombre completo</label>
                <input className="form-control" value={newName} onChange={(e) => setNewName(e.target.value)} required autoFocus />
              </div>
              <div className="form-group">
                <label>DNI</label>
                <input className="form-control" value={newDni} onChange={(e) => setNewDni(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Celular</label>
                <input className="form-control" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowAddModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPaymentModal && (selectedCustomer || selectedSupplierDebt) && (
        <PaymentModal
          tab={tab}
          entityName={
            tab === "internas" ? selectedCustomer?.customerName || "" : selectedSupplierDebt?.supplierName || ""
          }
          paymentInvoice={paymentInvoice}
          activeDebt={activeDebt}
          paymentAmount={paymentAmount}
          paymentNotes={paymentNotes}
          onAmountChange={setPaymentAmount}
          onNotesChange={setPaymentNotes}
          onClose={() => {
            setShowPaymentModal(false);
            setPaymentPurchaseId(null);
          }}
          onSubmit={handlePaymentSubmit}
        />
      )}

      {viewingSale && storeConfig && (
        <SaleViewModal
          sale={viewingSale}
          storeConfig={storeConfig}
          sessionLabel={
            cashSessions.find((s) => s.id === viewingSale.sessionId)?.id?.slice(-6) || "Sin caja"
          }
          onClose={() => setViewingSaleId(null)}
          onEdit={() => setViewingSaleId(null)}
          onReprint={() => {}}
        />
      )}

      {viewingInvoice && selectedSupplierDebt && (
        <InvoiceDetailModal
          invoice={viewingInvoice}
          supplierName={selectedSupplierDebt.supplierName}
          payments={getPaymentsForPurchase(selectedSupplierDebt, viewingInvoice.purchaseId)}
          onClose={() => setViewingPurchaseId(null)}
          onPay={() => {
            setViewingPurchaseId(null);
            openPaymentModal(viewingInvoice.purchaseId);
          }}
        />
      )}
    </div>
  );
};

function PaymentModal({
  tab,
  entityName,
  paymentInvoice,
  activeDebt,
  paymentAmount,
  paymentNotes,
  onAmountChange,
  onNotesChange,
  onClose,
  onSubmit,
}: {
  tab: DebtTab;
  entityName: string;
  paymentInvoice: SupplierInvoiceRow | null;
  activeDebt: number;
  paymentAmount: string;
  paymentNotes: string;
  onAmountChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const { formatMoney, symbol } = useMoney();
  const isSupplier = tab === "externas";
  const amountNum = parseFloat(paymentAmount);
  const hasValidAmount = !isNaN(amountNum) && amountNum > 0;
  const remainingAfter = hasValidAmount ? Math.max(0, activeDebt - amountNum) : activeDebt;
  const isPartial = hasValidAmount && amountNum < activeDebt;
  const isFullPay = hasValidAmount && amountNum >= activeDebt;

  const setQuickAmount = (value: number) => {
    onAmountChange(value > 0 ? value.toFixed(2) : "");
  };

  return (
    <div className="modal-overlay debts-pay-overlay" onClick={onClose}>
      <div className="debts-pay-modal" onClick={(e) => e.stopPropagation()}>
        <header className="debts-pay-header">
          <div className="debts-pay-header-main">
            <div className={`debts-pay-icon ${isSupplier ? "is-supplier" : "is-customer"}`}>
              <CashIcon size={20} />
            </div>
            <div className="debts-pay-header-text">
              <p className="debts-pay-kicker">
                {isSupplier ? "Pago a proveedor" : "Cobro a cliente"}
              </p>
              <h3>{entityName}</h3>
            </div>
            <button type="button" className="modal-close debts-pay-close" onClick={onClose} aria-label="Cerrar">
              ×
            </button>
          </div>
          {paymentInvoice && (
            <div className="debts-pay-invoice-chip">
              <TicketIcon size={14} />
              <span>{paymentInvoice.documentRef}</span>
            </div>
          )}
        </header>

        <form className="debts-pay-form" onSubmit={onSubmit}>
          <div className={`debts-pay-summary ${hasValidAmount ? "has-preview" : ""}`}>
            <div className="debts-pay-balance-card">
              <span>Saldo {paymentInvoice ? "del comprobante" : "pendiente"}</span>
              <strong>{formatMoney(activeDebt)}</strong>
            </div>
            {hasValidAmount && (
              <div className={`debts-pay-after-card ${isFullPay ? "is-complete" : ""}`}>
                <span>Quedará pendiente</span>
                <strong>{formatMoney(remainingAfter)}</strong>
              </div>
            )}
          </div>

          <div className="debts-pay-quick">
            <span className="debts-pay-quick-label">Montos rápidos</span>
            <div className="debts-pay-quick-btns">
              <button type="button" onClick={() => setQuickAmount(activeDebt * 0.25)}>
                25%
              </button>
              <button type="button" onClick={() => setQuickAmount(activeDebt * 0.5)}>
                50%
              </button>
              <button type="button" onClick={() => setQuickAmount(activeDebt * 0.75)}>
                75%
              </button>
              <button type="button" className="is-full" onClick={() => setQuickAmount(activeDebt)}>
                Saldo completo
              </button>
            </div>
          </div>

          <div className="form-group debts-pay-amount-group">
            <label>Monto a registrar</label>
            <div className={`debts-pay-amount-input ${hasValidAmount ? "has-value" : ""}`}>
              <span className="debts-pay-currency">{symbol}</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="debts-pay-amount-field"
                value={paymentAmount}
                onChange={(e) => onAmountChange(e.target.value)}
                placeholder="0.00"
                required
                autoFocus
              />
            </div>
            {isPartial && (
              <p className="debts-pay-partial-hint">Pago parcial — puedes abonar el resto después.</p>
            )}
          </div>

          <div className="form-group">
            <label>Observaciones</label>
            <input
              className="form-control debts-pay-notes"
              value={paymentNotes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder={
                isSupplier
                  ? paymentInvoice
                    ? "Ej: abono parcial, transferencia"
                    : "Ej: transferencia, factura cancelada"
                  : "Ej: pago parcial en efectivo"
              }
            />
          </div>

          {isSupplier && (
            <div className="debts-pay-note">
              <CashIcon size={14} />
              <p>
                Puedes registrar pagos parciales. Si la caja está abierta, el pago sale de caja automáticamente.
              </p>
            </div>
          )}

          <footer className="debts-pay-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-success debts-pay-submit">
              <CashIcon size={15} />
              {isSupplier ? "Confirmar pago" : "Confirmar cobro"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

function CustomerDebtDetail({
  customer,
  sales,
  onPay,
  onViewSale,
}: {
  customer: CustomerDebt;
  sales: Sale[];
  onPay: () => void;
  onViewSale: (saleId: string) => void;
}) {
  const { formatMoney } = useMoney();
  const history = Array.isArray(customer.history) ? customer.history : [];
  const charges = history.filter((h) => h.type === "sale" || h.amount > 0);
  const payments = history.filter((h) => h.type === "payment" || h.amount < 0);
  const totalCharged = charges.reduce((sum, h) => sum + Math.abs(safeAmount(h.amount)), 0);
  const totalPaid = payments.reduce((sum, h) => sum + Math.abs(safeAmount(h.amount)), 0);

  return (
    <div className="debts-detail debts-detail--customer">
      <header className="debts-customer-head">
        <div className="debts-customer-head-main">
          <div className="debts-customer-avatar">{getInitials(customer.customerName)}</div>
          <div>
            <p className="debts-customer-kicker">Cliente fiado</p>
            <h2>{customer.customerName}</h2>
            <div className="debts-customer-chips">
              {customer.customerDni && <span>DNI: {customer.customerDni}</span>}
              {customer.customerPhone && <span>Cel: {customer.customerPhone}</span>}
              <span>{charges.length} cargo{charges.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
        </div>
        <div className={`debts-customer-balance-card ${customer.totalDebt > 0 ? "has-debt" : "is-clear"}`}>
          <span>Deuda pendiente</span>
          <strong>{formatMoney(customer.totalDebt)}</strong>
          {customer.totalDebt > 0 && (
            <button type="button" className="btn btn-success btn-sm debts-customer-pay-btn" onClick={onPay}>
              <CashIcon size={14} /> Registrar cobro
            </button>
          )}
        </div>
      </header>

      <div className="debts-customer-stats">
        <div className="debts-customer-stat">
          <span>Total fiado</span>
          <strong>{formatMoney(totalCharged)}</strong>
        </div>
        <div className="debts-customer-stat debts-customer-stat--paid">
          <span>Cobrado</span>
          <strong>{formatMoney(totalPaid)}</strong>
        </div>
        <div className="debts-customer-stat debts-customer-stat--due">
          <span>Pendiente</span>
          <strong>{formatMoney(customer.totalDebt)}</strong>
        </div>
      </div>

      <div className="debts-customer-section-head">
        <h3>
          <HistoryIcon size={18} /> Libreta de movimientos
        </h3>
        <span>{history.length} movimiento{history.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="debts-customer-movements">
        {history.map((entry) => {
          const isCharge = entry.type === "sale" || entry.amount > 0;
          const linkedSale = entry.saleId ? sales.find((s) => s.id === entry.saleId) : null;
          return (
            <article
              key={entry.id}
              className={`debts-customer-movement-card ${isCharge ? "is-charge" : "is-payment"}`}
            >
              <div className={`debts-customer-movement-icon ${isCharge ? "is-charge" : "is-payment"}`}>
                {isCharge ? <TicketIcon size={15} /> : <CashIcon size={15} />}
              </div>
              <div className="debts-customer-movement-main">
                <p className="debts-customer-movement-notes">{entry.notes || (isCharge ? "Venta fiado" : "Cobro registrado")}</p>
                <p className="debts-customer-movement-date">{formatDate(entry.date)}</p>
                <span className={`debts-customer-movement-type ${isCharge ? "is-charge" : "is-payment"}`}>
                  {isCharge ? "Cargo · Venta fiado" : "Abono · Cobro"}
                </span>
              </div>
              <div className="debts-customer-movement-right">
                <p className={`debts-customer-movement-amount ${isCharge ? "is-charge" : "is-payment"}`}>
                  {isCharge ? "+" : "−"} {formatMoney(Math.abs(safeAmount(entry.amount)))}
                </p>
                {linkedSale && (
                  <button
                    type="button"
                    className="sales-icon-btn sales-icon-btn-view debts-customer-view-btn"
                    title="Ver detalle de venta"
                    onClick={() => onViewSale(linkedSale.id)}
                  >
                    <EyeIcon size={14} />
                  </button>
                )}
              </div>
            </article>
          );
        })}

        {history.length === 0 && (
          <div className="debts-customer-movements-empty">
            <UserIcon size={32} />
            <p>Sin movimientos registrados.</p>
            <span>Las ventas con pago Fiado en el POS aparecerán aquí automáticamente.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SupplierDebtDetail({
  supplierName,
  totalDebt,
  invoices,
  onViewInvoice,
  onPayInvoice,
}: {
  supplierName: string;
  totalDebt: number;
  invoices: SupplierInvoiceRow[];
  onViewInvoice: (purchaseId: string) => void;
  onPayInvoice: (purchaseId: string) => void;
}) {
  const { formatMoney } = useMoney();
  const pendingCount = invoices.filter((inv) => inv.balance > 0).length;
  const totalPaid = invoices.reduce((sum, inv) => sum + inv.paid, 0);
  const totalBilled = invoices.reduce((sum, inv) => sum + inv.total, 0);

  const invoiceCardStatus = (balance: number, paid: number) => {
    if (balance <= 0) return "is-settled";
    if (paid > 0) return "is-partial";
    return "is-pending";
  };

  return (
    <div className="debts-detail debts-detail--supplier">
      <section className="debts-supplier-hero card-glass">
        <div className="debts-supplier-hero-glow" aria-hidden="true" />
        <div className="debts-supplier-hero-main">
          <div className="debts-supplier-head-main">
            <div className="debts-supplier-avatar">{getInitials(supplierName)}</div>
            <div>
              <p className="debts-supplier-kicker">Proveedor a crédito</p>
              <h2>{supplierName}</h2>
              <div className="debts-supplier-chips">
                <span>{invoices.length} comprobante{invoices.length !== 1 ? "s" : ""}</span>
                {pendingCount > 0 && (
                  <span className="is-pending">
                    {pendingCount} pendiente{pendingCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className={`debts-supplier-balance-card ${totalDebt > 0 ? "has-debt" : "is-clear"}`}>
            <span>Saldo por pagar</span>
            <strong>{formatMoney(totalDebt)}</strong>
          </div>
        </div>

        <div className="debts-supplier-hero-stats" role="list" aria-label="Resumen del proveedor">
          <div className="debts-supplier-hero-stat debts-supplier-hero-stat--billed" role="listitem">
            <div className="debts-supplier-hero-stat-head">
              <span className="debts-supplier-hero-stat-icon">
                <TicketIcon size={13} />
              </span>
              <span className="debts-supplier-hero-stat-label">Facturado</span>
            </div>
            <strong className="debts-supplier-hero-stat-value">{formatMoney(totalBilled)}</strong>
            <span className="debts-supplier-hero-stat-meta">
              {invoices.length} comprobante{invoices.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="debts-supplier-hero-stat debts-supplier-hero-stat--paid" role="listitem">
            <div className="debts-supplier-hero-stat-head">
              <span className="debts-supplier-hero-stat-icon">
                <CashIcon size={13} />
              </span>
              <span className="debts-supplier-hero-stat-label">Abonado</span>
            </div>
            <strong className="debts-supplier-hero-stat-value">{formatMoney(totalPaid)}</strong>
            <span className="debts-supplier-hero-stat-meta">Pagos registrados</span>
          </div>
          <div className="debts-supplier-hero-stat debts-supplier-hero-stat--due" role="listitem">
            <div className="debts-supplier-hero-stat-head">
              <span className="debts-supplier-hero-stat-icon">
                <ChartIcon size={13} />
              </span>
              <span className="debts-supplier-hero-stat-label">Pendiente</span>
            </div>
            <strong className="debts-supplier-hero-stat-value">{formatMoney(totalDebt)}</strong>
            <span className="debts-supplier-hero-stat-meta">
              {pendingCount} por cancelar
            </span>
          </div>
        </div>
      </section>

      <div className="debts-supplier-section-head">
        <div className="debts-supplier-section-title">
          <span className="debts-supplier-section-icon">
            <HistoryIcon size={16} />
          </span>
          <div>
            <h3>Comprobantes a crédito</h3>
            <p>Facturas y notas con saldo pendiente o pagos parciales</p>
          </div>
        </div>
        <span className="debts-supplier-section-count">
          {invoices.length} registro{invoices.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="debts-supplier-invoices">
        {invoices.map((inv) => {
          const paidPercent =
            inv.total > 0 ? Math.min(100, Math.round((inv.paid / inv.total) * 100)) : 0;
          const statusKey = invoiceCardStatus(inv.balance, inv.paid);
          return (
            <article
              key={inv.purchaseId}
              className={`debts-supplier-invoice-card ${statusKey}`}
            >
              <div className="debts-supplier-invoice-body">
                <div className="debts-supplier-invoice-top">
                  <div className="debts-supplier-invoice-id">
                    {inv.docType && <span className="debts-supplier-invoice-type">{inv.docType}</span>}
                    <h4>{inv.documentRef}</h4>
                    <p>{formatShortDate(inv.date)}</p>
                  </div>
                  <span className={invoiceStatusClass(inv.balance, inv.paid)}>
                    {invoiceStatusLabel(inv.balance, inv.paid)}
                  </span>
                </div>

                <div className="debts-supplier-invoice-amounts">
                  <div className="debts-supplier-invoice-amount">
                    <span>Total</span>
                    <strong>{formatMoney(inv.total)}</strong>
                  </div>
                  <div className="debts-supplier-invoice-amount">
                    <span>Pagado</span>
                    <strong className="is-paid">{formatMoney(inv.paid)}</strong>
                  </div>
                  <div className="debts-supplier-invoice-amount">
                    <span>Saldo</span>
                    <strong className={inv.balance > 0 ? "is-due" : "is-clear"}>
                      {formatMoney(inv.balance)}
                    </strong>
                  </div>
                </div>

                <div className="debts-supplier-invoice-progress">
                  <div className="debts-supplier-invoice-progress-track">
                    <div
                      className={`debts-supplier-invoice-progress-bar ${inv.balance <= 0 ? "is-complete" : ""}`}
                      style={{ width: `${paidPercent}%` }}
                    />
                  </div>
                  <span>{paidPercent}% cancelado</span>
                </div>
              </div>

              <div className="debts-supplier-invoice-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm debts-supplier-btn-detail"
                  onClick={() => onViewInvoice(inv.purchaseId)}
                >
                  <EyeIcon size={14} /> Ver detalle
                </button>
                {inv.balance > 0 && (
                  <button
                    type="button"
                    className="btn btn-success btn-sm"
                    onClick={() => onPayInvoice(inv.purchaseId)}
                  >
                    <CashIcon size={14} /> Pagar
                  </button>
                )}
              </div>
            </article>
          );
        })}

        {invoices.length === 0 && (
          <div className="debts-supplier-invoices-empty">
            <BoxIcon size={32} />
            <p>Sin comprobantes a crédito registrados.</p>
            <span>Confirma una compra con condición Crédito proveedor en Ingreso de Stock.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function invoiceStatusLabel(balance: number, paid: number) {
  if (balance <= 0) return "Pagado";
  if (paid > 0) return "Pago parcial";
  return "Pendiente";
}

function invoiceStatusClass(balance: number, paid: number) {
  if (balance <= 0) return "debts-inv-status debts-inv-status--paid";
  if (paid > 0) return "debts-inv-status debts-inv-status--partial";
  return "debts-inv-status debts-inv-status--pending";
}

function InvoiceDetailModal({
  invoice,
  supplierName,
  payments,
  onClose,
  onPay,
}: {
  invoice: SupplierInvoiceRow;
  supplierName: string;
  payments: Array<{ id: string; date: string; amount: number; notes?: string }>;
  onClose: () => void;
  onPay: () => void;
}) {
  const { t } = useI18n();
  const { formatMoney } = useMoney();
  const purchase = invoice.purchase;
  const items = purchase && Array.isArray(purchase.items) ? purchase.items : [];
  const paidPercent =
    invoice.total > 0 ? Math.min(100, Math.round((invoice.paid / invoice.total) * 100)) : 0;

  return (
    <div className="modal-overlay debts-inv-overlay" onClick={onClose}>
      <div className="debts-inv-modal" onClick={(e) => e.stopPropagation()}>
        <header className="debts-inv-header">
          <div className="debts-inv-header-top">
            <div className="debts-inv-type-pill">
              <TicketIcon size={14} />
              {invoice.docType || "Comprobante"}
            </div>
            <span className={invoiceStatusClass(invoice.balance, invoice.paid)}>
              {invoiceStatusLabel(invoice.balance, invoice.paid)}
            </span>
            <button type="button" className="modal-close debts-inv-close" onClick={onClose} aria-label="Cerrar">
              ×
            </button>
          </div>
          <h3 className="debts-inv-doc-number">{invoice.documentRef}</h3>
          <div className="debts-inv-header-meta">
            <p className="debts-inv-datetime">{formatShortDate(invoice.date)}</p>
            <span className="debts-inv-supplier-chip">{supplierName}</span>
          </div>
        </header>

        <div className="debts-inv-body">
          <section className="debts-inv-finance">
            <div className="debts-inv-stats">
              <div className="debts-inv-stat">
                <p className="debts-inv-stat-label">Total</p>
                <p className="debts-inv-stat-value">{formatMoney(invoice.total)}</p>
              </div>
              <div className="debts-inv-stat debts-inv-stat--paid">
                <p className="debts-inv-stat-label">Pagado</p>
                <p className="debts-inv-stat-value">{formatMoney(invoice.paid)}</p>
              </div>
              <div className={`debts-inv-stat ${invoice.balance > 0 ? "debts-inv-stat--due" : "debts-inv-stat--clear"}`}>
                <p className="debts-inv-stat-label">Saldo</p>
                <p className="debts-inv-stat-value">{formatMoney(invoice.balance)}</p>
              </div>
            </div>
            <div className="debts-inv-progress-wrap">
              <div className="debts-inv-progress-track">
                <div
                  className={`debts-inv-progress-bar ${invoice.balance <= 0 ? "is-complete" : ""}`}
                  style={{ width: `${paidPercent}%` }}
                />
              </div>
              <p className="debts-inv-progress-label">
                {paidPercent}% cancelado · {payments.length} pago{payments.length !== 1 ? "s" : ""}
              </p>
            </div>
          </section>

          {(purchase?.warehouse || purchase?.paymentMethod) && (
            <section className="debts-inv-meta-strip">
              {purchase?.warehouse && (
                <div className="debts-inv-meta-block">
                  <p className="debts-inv-meta-label">{t("warehouses.label")}</p>
                  <p className="debts-inv-meta-value">{localizeWarehouseLegacyName(purchase.warehouse, t)}</p>
                </div>
              )}
              {purchase?.paymentMethod && (
                <div className="debts-inv-meta-block">
                  <p className="debts-inv-meta-label">Condición</p>
                  <p className="debts-inv-meta-value">Crédito proveedor</p>
                </div>
              )}
              <div className="debts-inv-meta-block">
                <p className="debts-inv-meta-label">Ítems</p>
                <p className="debts-inv-meta-value">
                  {items.length} producto{items.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="debts-inv-meta-block">
                <p className="debts-inv-meta-label">Proveedor</p>
                <p className="debts-inv-meta-value">{supplierName}</p>
              </div>
            </section>
          )}

          {items.length > 0 && (
            <section className="debts-inv-products">
              <h4 className="debts-inv-section-title">Ítems de la compra</h4>
              <div className="debts-inv-item-list">
                {items.map((item, idx) => (
                  <div className="debts-inv-item-row" key={`${item.productCode}-${idx}`}>
                    <div className="debts-inv-item-main">
                      <p className="debts-inv-item-name">{item.productName}</p>
                      <p className="debts-inv-item-detail">
                        {item.productCode} · Cant. {item.quantity} · {formatMoney(item.unitCost)} c/u
                      </p>
                    </div>
                    <p className="debts-inv-item-total">
                      {formatMoney(item.quantity * item.unitCost)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="debts-inv-payments">
            <h4 className="debts-inv-section-title">
              <HistoryIcon size={14} /> Historial de pagos
            </h4>
            {payments.length > 0 ? (
              <div className="debts-inv-payment-list">
                {payments.map((p) => (
                  <div className="debts-inv-payment-row" key={p.id}>
                    <div className="debts-inv-payment-icon">
                      <CashIcon size={14} />
                    </div>
                    <div className="debts-inv-payment-main">
                      <p className="debts-inv-payment-notes">{p.notes || "Pago registrado"}</p>
                      <p className="debts-inv-payment-date">{formatDate(p.date)}</p>
                    </div>
                    <p className="debts-inv-payment-amount">− {formatMoney(Math.abs(p.amount))}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="debts-inv-payments-empty">
                <CashIcon size={22} />
                <p>Sin pagos registrados para este comprobante.</p>
                {invoice.balance > 0 && (
                  <span>Usa el botón inferior para registrar el primer abono.</span>
                )}
              </div>
            )}
          </section>
        </div>

        <footer className="debts-inv-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cerrar
          </button>
          {invoice.balance > 0 && (
            <button type="button" className="btn btn-success debts-inv-pay-btn" onClick={onPay}>
              <CashIcon size={15} />
              Registrar pago parcial
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

