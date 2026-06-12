import React, { useCallback, useMemo, useState } from "react";
import type { Sale } from "./ReceiptPrinter";
import type { StoreConfig } from "../App";
import { EditIcon, DeleteIcon, HistoryIcon, EyeIcon, PrinterIcon, CashIcon, CartIcon } from "./Icons";
import { SaleEditModal } from "./SaleEditModal";
import { SaleViewModal } from "./SaleViewModal";
import { SelectField, type SelectOption } from "./SelectField";
import { useI18n } from "../i18n";
import { useMoney } from "../hooks/useMoney";
import {
  type CashSession,
  formatDateTime,
  resolveSaleSessionId,
} from "../utils/cashSales";

interface SalesHistoryProps {
  sales: Sale[];
  sessions: CashSession[];
  storeConfig: StoreConfig;
  onUpdateSale: (saleId: string, updated: Sale) => void;
  onDeleteSale: (saleId: string) => void;
  onReprint: (sale: Sale) => void;
  onEditSession?: (sessionId: string) => void;
}

const PAYMENT_METHODS = ["Efectivo", "Tarjeta", "Yape", "Fiado"] as const;

function paymentBadgeClass(method: string) {
  if (method === "Efectivo") return "sales-pay-badge sales-pay-efectivo";
  if (method === "Tarjeta") return "sales-pay-badge sales-pay-tarjeta";
  if (method === "Yape") return "sales-pay-badge sales-pay-yape";
  if (method === "Fiado") return "sales-pay-badge sales-pay-fiado";
  return "sales-pay-badge";
}

function paymentChipClass(method: string) {
  if (method === "Efectivo") return "sales-pay-chip sales-pay-chip--efectivo";
  if (method === "Tarjeta") return "sales-pay-chip sales-pay-chip--tarjeta";
  if (method === "Yape") return "sales-pay-chip sales-pay-chip--yape";
  if (method === "Fiado") return "sales-pay-chip sales-pay-chip--fiado";
  return "sales-pay-chip";
}

function sessionBadgeClass(sale: Sale, sessions: CashSession[]) {
  const sessionId = resolveSaleSessionId(sale, sessions);
  if (!sessionId) return "sales-session-badge sales-session-none";
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return "sales-session-badge sales-session-none";
  return session.endTime ? "sales-session-badge sales-session-closed" : "sales-session-badge sales-session-active";
}

export const SalesHistory: React.FC<SalesHistoryProps> = ({
  sales,
  sessions,
  storeConfig,
  onUpdateSale,
  onDeleteSale,
  onReprint,
  onEditSession,
}) => {
  const { t, locale, localeTag } = useI18n();
  const { formatMoney } = useMoney();
  const [search, setSearch] = useState("");
  const [filterSession, setFilterSession] = useState("all");
  const [filterPayment, setFilterPayment] = useState("all");
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [viewingSale, setViewingSale] = useState<Sale | null>(null);

  const paymentLabel = useCallback(
    (method: string) => {
      if (method === "Efectivo") return t("pos.cash");
      if (method === "Tarjeta") return t("pos.card");
      if (method === "Yape") return t("pos.yape");
      if (method === "Fiado") return locale === "en" ? "Credit" : "Fiado";
      return method;
    },
    [locale, t]
  );

  const sortedSales = useMemo(
    () => [...sales].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [sales]
  );

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()),
    [sessions]
  );

  const filteredSales = useMemo(() => {
    return sortedSales.filter((sale) => {
      const sessionId = resolveSaleSessionId(sale, sessions);
      if (filterSession !== "all" && sessionId !== filterSession) return false;
      if (filterPayment !== "all" && sale.paymentMethod !== filterPayment) return false;
      const q = search.toLowerCase();
      if (!q) return true;
      return (
        sale.documentNumber?.toLowerCase().includes(q) ||
        sale.items.some((i) => i.name.toLowerCase().includes(q) || i.code.includes(q)) ||
        sale.paymentMethod.toLowerCase().includes(q)
      );
    });
  }, [sortedSales, filterSession, filterPayment, search, sessions]);

  const stats = useMemo(() => {
    const totalFiltered = filteredSales.reduce((s, sale) => s + sale.total, 0);
    const sumByMethod = (method: string) =>
      filteredSales.filter((s) => s.paymentMethod === method).reduce((sum, s) => sum + s.total, 0);
    const efectivoTotal = sumByMethod("Efectivo");
    const tarjetaTotal = sumByMethod("Tarjeta");
    const yapeTotal = sumByMethod("Yape");
    const fiadoTotal = sumByMethod("Fiado");
    const boletas = filteredSales.filter((s) => s.documentType === "boleta").length;
    const tickets = filteredSales.filter((s) => s.documentType !== "boleta").length;
    const avgTicket = filteredSales.length > 0 ? totalFiltered / filteredSales.length : 0;
    return {
      totalFiltered,
      efectivoTotal,
      tarjetaTotal,
      yapeTotal,
      fiadoTotal,
      boletas,
      tickets,
      avgTicket,
      count: filteredSales.length,
    };
  }, [filteredSales]);

  const sessionOptions: SelectOption[] = useMemo(
    () => [
      {
        value: "all",
        label: t("salesHistory.allSessions"),
        hint: t("salesHistory.sessionCount", { count: sessions.length }),
      },
      ...sortedSessions.map((s) => ({
        value: s.id,
        label: s.endTime ? t("salesHistory.sessionClosed") : t("salesHistory.sessionActive"),
        hint: formatDateTime(s.startTime),
      })),
    ],
    [sessions.length, sortedSessions, t]
  );

  const paymentOptions: SelectOption[] = useMemo(
    () => [
      {
        value: "all",
        label: t("salesHistory.allPayments"),
        hint: `${stats.count} ${locale === "en" ? "sales" : "ventas"}`,
      },
      ...PAYMENT_METHODS.map((method) => ({
        value: method,
        label: paymentLabel(method),
        hint: formatMoney(
          filteredSales.filter((s) => s.paymentMethod === method).reduce((sum, s) => sum + s.total, 0)
        ),
      })),
    ],
    [filteredSales, locale, formatMoney, paymentLabel, stats.count, t]
  );

  const hasActiveFilters = search.trim() !== "" || filterSession !== "all" || filterPayment !== "all";

  const clearFilters = () => {
    setSearch("");
    setFilterSession("all");
    setFilterPayment("all");
  };

  const getSessionLabel = (sale: Sale) => {
    const sessionId = resolveSaleSessionId(sale, sessions);
    if (!sessionId) return t("salesHistory.noSession");
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return t("salesHistory.unknownSession");
    return session.endTime ? t("salesHistory.sessionClosedBadge") : t("salesHistory.sessionActiveBadge");
  };

  const selectedSessionLabel =
    filterSession === "all"
      ? t("salesHistory.allSessions")
      : sessionOptions.find((o) => o.value === filterSession)?.label ?? "";

  const handleDelete = (sale: Sale) => {
    const doc = sale.documentNumber || sale.id;
    if (!confirm(t("salesHistory.deleteConfirm", { doc }))) return;
    onDeleteSale(sale.id);
    if (viewingSale?.id === sale.id) setViewingSale(null);
  };

  return (
    <div className="sales-history-page">
      <section className="sales-history-hero card-glass">
        <div className="sales-history-hero-top">
          <div className="sales-history-hero-main">
            <div className="sales-history-hero-icon">
              <HistoryIcon size={22} />
            </div>
            <div className="sales-history-hero-copy">
              <p className="sales-history-kicker">{t("salesHistory.kicker")}</p>
              <h2>{t("salesHistory.title")}</h2>
              <p>{t("salesHistory.subtitle")}</p>
            </div>
          </div>
          <div className="sales-history-hero-badge">
            <CartIcon size={14} />
            <span>{t("salesHistory.totalRecords", { count: sales.length })}</span>
          </div>
        </div>

        <div className="sales-history-stats">
          <article className="sales-stat-card">
            <span className="sales-stat-label">{t("salesHistory.filteredSales")}</span>
            <span className="sales-stat-value">{stats.count.toLocaleString(localeTag)}</span>
          </article>
          <article className="sales-stat-card sales-stat-card--accent">
            <span className="sales-stat-label">{t("salesHistory.filteredTotal")}</span>
            <span className="sales-stat-value accent">{formatMoney(stats.totalFiltered)}</span>
          </article>
          <article className="sales-stat-card sales-stat-card--cash">
            <span className="sales-stat-label">{t("salesHistory.cashTotal")}</span>
            <span className="sales-stat-value">{formatMoney(stats.efectivoTotal)}</span>
          </article>
          <article className="sales-stat-card sales-stat-card--doc">
            <span className="sales-stat-label">{t("salesHistory.boletas")}</span>
            <span className="sales-stat-value">{stats.boletas}</span>
          </article>
          <article className="sales-stat-card sales-stat-card--ticket">
            <span className="sales-stat-label">{t("salesHistory.tickets")}</span>
            <span className="sales-stat-value">{stats.tickets}</span>
          </article>
          <article className="sales-stat-card sales-stat-card--avg">
            <span className="sales-stat-label">{t("salesHistory.avgTicket")}</span>
            <span className="sales-stat-value">{formatMoney(stats.avgTicket)}</span>
          </article>
        </div>

        <div className="sales-history-pay-strip">
          {PAYMENT_METHODS.map((method) => (
            <button
              key={method}
              type="button"
              className={`${paymentChipClass(method)}${filterPayment === method ? " is-active" : ""}`}
              onClick={() => setFilterPayment((prev) => (prev === method ? "all" : method))}
            >
              <span className="sales-pay-chip-label">{paymentLabel(method)}</span>
              <span className="sales-pay-chip-amount">
                {formatMoney(
                  method === "Efectivo"
                    ? stats.efectivoTotal
                    : method === "Tarjeta"
                      ? stats.tarjetaTotal
                      : method === "Yape"
                        ? stats.yapeTotal
                        : stats.fiadoTotal
                )}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="sales-history-filters card-glass">
        <div className="sales-history-filters-head">
          <div>
            <p className="sales-history-kicker">{t("salesHistory.filtersKicker")}</p>
            <h3>{t("salesHistory.filtersTitle")}</h3>
          </div>
          {hasActiveFilters && (
            <button type="button" className="btn btn-secondary btn-sm sales-clear-filters" onClick={clearFilters}>
              {t("salesHistory.clearFilters")}
            </button>
          )}
        </div>

        <div className="sales-history-filters-body">
          <div className="sales-search-wrap">
            <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className="form-control sales-search-input"
              placeholder={t("salesHistory.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <SelectField
            label={t("salesHistory.sessionLabel")}
            value={filterSession}
            options={sessionOptions}
            onChange={setFilterSession}
            accent="cyan"
          />
          <SelectField
            label={t("salesHistory.paymentLabel")}
            value={filterPayment}
            options={paymentOptions}
            onChange={setFilterPayment}
            accent="magenta"
          />
        </div>

        {hasActiveFilters && (
          <div className="sales-active-filters">
            <span className="sales-active-filters-label">{t("salesHistory.activeFilters")}</span>
            {search.trim() && (
              <span className="sales-filter-pill">
                “{search.trim()}”
                <button type="button" onClick={() => setSearch("")} aria-label={t("salesHistory.clearFilters")}>×</button>
              </span>
            )}
            {filterSession !== "all" && (
              <span className="sales-filter-pill sales-filter-pill--cyan">
                {selectedSessionLabel}
                <button type="button" onClick={() => setFilterSession("all")} aria-label={t("salesHistory.clearFilters")}>×</button>
              </span>
            )}
            {filterPayment !== "all" && (
              <span className={`sales-filter-pill sales-filter-pill--payment sales-filter-pill--${filterPayment.toLowerCase()}`}>
                {paymentLabel(filterPayment)}
                <button type="button" onClick={() => setFilterPayment("all")} aria-label={t("salesHistory.clearFilters")}>×</button>
              </span>
            )}
          </div>
        )}
      </section>

      <section className="sales-history-workspace card-glass">
        {filteredSales.length === 0 ? (
          <div className="sales-history-empty">
            <div className="sales-history-empty-icon">
              <HistoryIcon size={28} />
            </div>
            <h4>{t("salesHistory.emptyTitle")}</h4>
            <p>
              {hasActiveFilters ? t("salesHistory.emptyFiltered") : t("salesHistory.emptyDefault")}
            </p>
            {hasActiveFilters && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>
                {t("salesHistory.clearFilters")}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="sales-history-results-bar">
              <span>{t("salesHistory.resultsCount", { count: filteredSales.length })}</span>
              <span className="sales-history-results-total">
                <CashIcon size={14} />
                {formatMoney(stats.totalFiltered)}
              </span>
            </div>
            <div className="sales-table-scroll">
              <table className="sales-history-table">
                <thead>
                  <tr>
                    <th>{t("salesHistory.colDate")}</th>
                    <th>{t("salesHistory.colDocument")}</th>
                    <th>{t("salesHistory.colProducts")}</th>
                    <th>{t("salesHistory.colTotal")}</th>
                    <th>{t("salesHistory.colPayment")}</th>
                    <th>{t("salesHistory.colSession")}</th>
                    <th className="sales-actions-col">{t("salesHistory.colActions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map((sale) => {
                    const isBoleta = sale.documentType === "boleta";
                    return (
                      <tr key={sale.id} className="sales-history-row">
                        <td className="sales-date-cell">{formatDateTime(sale.timestamp)}</td>
                        <td>
                          <div className="sales-doc-cell">
                            <span className={`sales-doc-type ${isBoleta ? "is-boleta" : "is-ticket"}`}>
                              {isBoleta ? t("salesHistory.boleta") : t("salesHistory.ticket")}
                            </span>
                            <span className="sales-doc-badge">{sale.documentNumber || "—"}</span>
                          </div>
                        </td>
                        <td className="sales-products-cell">
                          <span className="sales-items-count">
                            {t("salesHistory.itemsCount", { count: sale.items.length })}
                          </span>
                          <span className="sales-items-names" title={sale.items.map((i) => i.name).join(", ")}>
                            {sale.items.map((i) => i.name).join(", ")}
                          </span>
                        </td>
                        <td className="sales-total-cell">{formatMoney(sale.total)}</td>
                        <td>
                          <span className={paymentBadgeClass(sale.paymentMethod)}>
                            {paymentLabel(sale.paymentMethod)}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={sessionBadgeClass(sale, sessions)}
                            onClick={() => {
                              const sid = resolveSaleSessionId(sale, sessions);
                              if (sid && onEditSession) onEditSession(sid);
                            }}
                            disabled={!resolveSaleSessionId(sale, sessions) || !onEditSession}
                          >
                            {getSessionLabel(sale)}
                          </button>
                        </td>
                        <td>
                          <div className="sales-action-group">
                            <button
                              type="button"
                              className="sales-icon-btn sales-icon-btn-view"
                              title={t("salesHistory.viewDetail")}
                              onClick={() => setViewingSale(sale)}
                            >
                              <EyeIcon size={15} />
                            </button>
                            <button
                              type="button"
                              className="sales-icon-btn sales-icon-btn-print"
                              title={t("salesHistory.reprint")}
                              onClick={() => onReprint(sale)}
                            >
                              <PrinterIcon size={15} />
                            </button>
                            <button
                              type="button"
                              className="sales-icon-btn sales-icon-btn-edit"
                              title={t("salesHistory.edit")}
                              onClick={() => setEditingSale(sale)}
                            >
                              <EditIcon size={15} />
                            </button>
                            <button
                              type="button"
                              className="sales-icon-btn sales-icon-btn-delete"
                              title={t("salesHistory.delete")}
                              onClick={() => handleDelete(sale)}
                            >
                              <DeleteIcon size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {viewingSale && (
        <SaleViewModal
          sale={viewingSale}
          storeConfig={storeConfig}
          sessionLabel={getSessionLabel(viewingSale)}
          onClose={() => setViewingSale(null)}
          onReprint={onReprint}
          onEdit={() => {
            setEditingSale(viewingSale);
            setViewingSale(null);
          }}
        />
      )}

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
  );
};