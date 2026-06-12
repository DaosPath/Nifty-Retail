import React, { useCallback, useMemo, useState } from "react";
import type { Sale } from "./ReceiptPrinter";
import {
  FolderIcon,
  PlusIcon,
  MinusIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  LockIcon,
  UnlockIcon,
  KeyIcon,
  HistoryIcon,
  CashIcon,
  EditIcon,
  CheckIcon,
  CartIcon,
} from "./Icons";
import { SessionEditModal } from "./SessionEditModal";
import { useI18n } from "../i18n";
import { useMoney } from "../hooks/useMoney";

interface CashSession {
  id: string;
  startTime: string;
  endTime: string | null;
  initialBalance: number;
  salesCash: number;
  salesCard: number;
  salesYape?: number;
  withdrawals: number;
  deposits: number;
  expectedCash: number;
  actualCash: number | null;
  difference: number | null;
  notes?: string;
}

interface CashControlProps {
  sessions: CashSession[];
  sales: Sale[];
  activeSession: CashSession | null;
  onOpenSession: (initialBalance: number) => void;
  onCloseSession: (actualCash: number, notes: string) => void;
  onAddTransaction: (type: "deposit" | "withdrawal", amount: number, notes: string) => void;
  onUpdateSession: (session: CashSession) => void;
  onUpdateSale: (saleId: string, updated: Sale) => void;
  onDeleteSale: (saleId: string) => void;
  initialEditSessionId?: string | null;
  onClearEditSessionId?: () => void;
}

const PRESET_AMOUNTS = [100, 200, 500, 1000];

export const CashControl: React.FC<CashControlProps> = ({
  sessions,
  sales,
  activeSession,
  onOpenSession,
  onCloseSession,
  onAddTransaction,
  onUpdateSession,
  onUpdateSale,
  onDeleteSale,
  initialEditSessionId,
  onClearEditSessionId,
}) => {
  const { t, localeTag } = useI18n();
  const { formatMoney, symbol } = useMoney();
  const [initialBalanceInput, setInitialBalanceInput] = useState("");
  const [actualCashInput, setActualCashInput] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [transType, setTransType] = useState<"deposit" | "withdrawal">("withdrawal");
  const [transAmount, setTransAmount] = useState("");
  const [transNotes, setTransNotes] = useState("");
  const [showTransModal, setShowTransModal] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(initialEditSessionId ?? null);

  const editingSession = editingSessionId ? sessions.find((s) => s.id === editingSessionId) ?? null : null;

  const formatDate = useCallback(
    (dateStr: string) => {
      try {
        return new Date(dateStr).toLocaleString(localeTag, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      } catch {
        return dateStr;
      }
    },
    [localeTag]
  );

  const differenceMeta = useCallback(
    (diff: number) => {
      if (diff === 0) {
        return {
          label: t("cashControl.diffBalanced"),
          className: "cash-diff-pill cash-diff-pill--ok",
          prefix: formatMoney(0),
        };
      }
      if (diff > 0) {
        return {
          label: t("cashControl.diffSurplus"),
          className: "cash-diff-pill cash-diff-pill--surplus",
          prefix: `+${formatMoney(diff)}`,
        };
      }
      return {
        label: t("cashControl.diffShort"),
        className: "cash-diff-pill cash-diff-pill--short",
        prefix: formatMoney(diff),
      };
    },
    [formatMoney, t]
  );

  React.useEffect(() => {
    if (initialEditSessionId) setEditingSessionId(initialEditSessionId);
  }, [initialEditSessionId]);

  const closedSessions = useMemo(
    () =>
      [...sessions]
        .filter((s) => s.endTime !== null)
        .sort((a, b) => new Date(b.endTime!).getTime() - new Date(a.endTime!).getTime()),
    [sessions]
  );

  const historyStats = useMemo(() => {
    const balanced = closedSessions.filter((s) => (s.difference || 0) === 0).length;
    const shortages = closedSessions.filter((s) => (s.difference || 0) < 0).length;
    const surpluses = closedSessions.filter((s) => (s.difference || 0) > 0).length;
    const totalVariance = closedSessions.reduce((sum, s) => sum + (s.difference || 0), 0);
    return { total: closedSessions.length, balanced, shortages, surpluses, totalVariance };
  }, [closedSessions]);

  const flowSegments = useMemo(() => {
    if (!activeSession) return [];
    const total =
      activeSession.initialBalance +
      activeSession.salesCash +
      activeSession.deposits +
      activeSession.withdrawals;
    const safeTotal = total > 0 ? total : 1;
    return [
      { key: "initial", label: t("cashControl.initialBalance"), value: activeSession.initialBalance, className: "cash-flow-seg--base" },
      { key: "sales", label: t("cashControl.salesCash"), value: activeSession.salesCash, className: "cash-flow-seg--in" },
      { key: "deposits", label: t("cashControl.deposits"), value: activeSession.deposits, className: "cash-flow-seg--in" },
      { key: "withdrawals", label: t("cashControl.withdrawals"), value: activeSession.withdrawals, className: "cash-flow-seg--out" },
    ].map((seg) => ({ ...seg, pct: Math.max(4, (Math.abs(seg.value) / safeTotal) * 100) }));
  }, [activeSession, t]);

  const closeSessionEditor = () => {
    setEditingSessionId(null);
    onClearEditSessionId?.();
  };

  const handleOpen = (e: React.FormEvent) => {
    e.preventDefault();
    const balance = parseFloat(initialBalanceInput);
    if (isNaN(balance) || balance < 0) {
      alert(t("cashControl.invalidInitial"));
      return;
    }
    onOpenSession(balance);
    setInitialBalanceInput("");
  };

  const handleClose = (e: React.FormEvent) => {
    e.preventDefault();
    const actual = parseFloat(actualCashInput);
    if (isNaN(actual) || actual < 0) {
      alert(t("cashControl.invalidActual"));
      return;
    }
    onCloseSession(actual, closeNotes);
    setActualCashInput("");
    setCloseNotes("");
  };

  const handleTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(transAmount);
    if (isNaN(amount) || amount <= 0) {
      alert(t("cashControl.invalidAmount"));
      return;
    }
    if (!transNotes.trim()) {
      alert(t("cashControl.invalidReason"));
      return;
    }
    onAddTransaction(transType, amount, transNotes);
    setTransAmount("");
    setTransNotes("");
    setShowTransModal(false);
  };

  const projectedDiff = useMemo(() => {
    if (!activeSession || !actualCashInput || isNaN(parseFloat(actualCashInput))) return null;
    return parseFloat(actualCashInput) - activeSession.expectedCash;
  }, [activeSession, actualCashInput]);

  return (
    <div className="cash-page">
      <section className="cash-hero card-glass">
        <div className="cash-hero-top">
          <div className="cash-hero-main">
            <div className="cash-hero-icon">
              <CashIcon size={22} />
            </div>
            <div className="cash-hero-copy">
              <p className="cash-kicker">{t("cashControl.kicker")}</p>
              <h2>{t("cashControl.title")}</h2>
              <p>{t("cashControl.subtitle")}</p>
            </div>
          </div>
          <div className={`cash-hero-status${activeSession ? " is-open" : ""}`}>
            <span className="cash-hero-status-dot" aria-hidden="true" />
            {activeSession ? t("cashControl.statusOpen") : t("cashControl.statusClosed")}
          </div>
        </div>

        <div className="cash-hero-stats">
          <article className={`cash-stat-card cash-stat-card--status${activeSession ? " cash-stat-card--active" : ""}`}>
            <span>{t("cashControl.status")}</span>
            <strong>{activeSession ? t("cashControl.statusOpen") : t("cashControl.statusClosed")}</strong>
          </article>
          <article className="cash-stat-card">
            <span>{t("cashControl.closedCount")}</span>
            <strong>{historyStats.total}</strong>
          </article>
          <article className="cash-stat-card cash-stat-card--ok">
            <span>{t("cashControl.balanced")}</span>
            <strong>{historyStats.balanced}</strong>
          </article>
          <article className="cash-stat-card cash-stat-card--warn">
            <span>{t("cashControl.shortages")}</span>
            <strong>{historyStats.shortages}</strong>
          </article>
          <article className="cash-stat-card cash-stat-card--surplus">
            <span>{t("cashControl.surpluses")}</span>
            <strong>{historyStats.surpluses}</strong>
          </article>
          <article className={`cash-stat-card cash-stat-card--variance${historyStats.totalVariance >= 0 ? " is-positive" : " is-negative"}`}>
            <span>{t("cashControl.totalVariance")}</span>
            <strong>{formatMoney(historyStats.totalVariance)}</strong>
          </article>
        </div>

        {!activeSession && (
          <div className="cash-workflow">
            <div className="cash-workflow-step is-current">
              <span className="cash-workflow-num">1</span>
              <span>{t("cashControl.stepOpen")}</span>
            </div>
            <div className="cash-workflow-line" />
            <div className="cash-workflow-step">
              <span className="cash-workflow-num">2</span>
              <span>{t("cashControl.stepSell")}</span>
            </div>
            <div className="cash-workflow-line" />
            <div className="cash-workflow-step">
              <span className="cash-workflow-num">3</span>
              <span>{t("cashControl.stepClose")}</span>
            </div>
          </div>
        )}
      </section>

      <div className="cash-layout">
        <section className="cash-panel card-glass">
          {activeSession ? (
            <div className="cash-active">
              <header className="cash-panel-head">
                <div className="cash-panel-head-main">
                  <div className="cash-panel-icon cash-panel-icon--active">
                    <FolderIcon size={18} />
                  </div>
                  <div>
                    <p className="cash-panel-eyebrow">{t("cashControl.activeEyebrow")}</p>
                    <h3>{t("cashControl.activeTitle")}</h3>
                    <p className="cash-panel-meta">
                      {t("cashControl.startedAt", { date: formatDate(activeSession.startTime) })}
                    </p>
                  </div>
                </div>
                <span className="cash-status-pill cash-status-pill--open">{t("cashControl.statusOpenPill")}</span>
              </header>

              <div className="cash-expected-banner">
                <span>{t("cashControl.expectedCash")}</span>
                <strong>{formatMoney(activeSession.expectedCash)}</strong>
              </div>

              <div className="cash-flow-bar" aria-hidden="true">
                {flowSegments.map((seg) => (
                  <div
                    key={seg.key}
                    className={`cash-flow-seg ${seg.className}`}
                    style={{ flexGrow: seg.pct }}
                    title={`${seg.label}: ${formatMoney(seg.value)}`}
                  />
                ))}
              </div>
              <p className="cash-flow-caption">{t("cashControl.flowFormula")}</p>

              <div className="cash-metrics-grid">
                <div className="cash-metric">
                  <span>{t("cashControl.initialBalance")}</span>
                  <strong>{formatMoney(activeSession.initialBalance)}</strong>
                </div>
                <div className="cash-metric cash-metric--in">
                  <span>{t("cashControl.salesCash")}</span>
                  <strong>+ {formatMoney(activeSession.salesCash)}</strong>
                </div>
                <div className="cash-metric cash-metric--in">
                  <span>{t("cashControl.deposits")}</span>
                  <strong>+ {formatMoney(activeSession.deposits)}</strong>
                </div>
                <div className="cash-metric cash-metric--out">
                  <span>{t("cashControl.withdrawals")}</span>
                  <strong>− {formatMoney(activeSession.withdrawals)}</strong>
                </div>
                <div className="cash-metric cash-metric--info">
                  <span>{t("cashControl.salesCard")}</span>
                  <strong>{formatMoney(activeSession.salesCard)}</strong>
                </div>
                <div className="cash-metric cash-metric--info">
                  <span>{t("cashControl.salesYape")}</span>
                  <strong>{formatMoney(activeSession.salesYape || 0)}</strong>
                </div>
              </div>

              <div className="cash-actions-row">
                <button type="button" className="btn btn-secondary btn-sm cash-action-btn" onClick={() => setEditingSessionId(activeSession.id)}>
                  <EditIcon size={14} /> {t("cashControl.editSession")}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm cash-action-btn cash-action-btn--out"
                  onClick={() => {
                    setTransType("withdrawal");
                    setShowTransModal(true);
                  }}
                >
                  <ArrowDownIcon size={14} /> {t("cashControl.withdraw")}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm cash-action-btn cash-action-btn--in"
                  onClick={() => {
                    setTransType("deposit");
                    setShowTransModal(true);
                  }}
                >
                  <ArrowUpIcon size={14} /> {t("cashControl.deposit")}
                </button>
              </div>

              <form className="cash-close-card" onSubmit={handleClose}>
                <div className="cash-close-head">
                  <LockIcon size={16} />
                  <div>
                    <h4>{t("cashControl.closeTitle")}</h4>
                    <p>{t("cashControl.closeDesc")}</p>
                  </div>
                </div>

                <div className="form-group">
                  <label>{t("cashControl.actualCash")}</label>
                  <div className="cash-money-input cash-money-input--lg">
                    <span>{symbol}</span>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      placeholder="0.00"
                      value={actualCashInput}
                      onChange={(e) => setActualCashInput(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {projectedDiff !== null && (
                  <div className={`cash-close-preview ${projectedDiff === 0 ? "is-ok" : projectedDiff > 0 ? "is-surplus" : "is-short"}`}>
                    {projectedDiff === 0 && (
                      <>
                        <CheckIcon size={14} /> {t("cashControl.previewBalanced")}
                      </>
                    )}
                    {projectedDiff > 0 && t("cashControl.previewSurplus", { amount: formatMoney(projectedDiff) })}
                    {projectedDiff < 0 && t("cashControl.previewShort", { amount: formatMoney(Math.abs(projectedDiff)) })}
                  </div>
                )}

                <div className="form-group">
                  <label>{t("cashControl.closeNotes")}</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder={t("cashControl.closeNotesPlaceholder")}
                    value={closeNotes}
                    onChange={(e) => setCloseNotes(e.target.value)}
                  />
                </div>

                <button type="submit" className="btn btn-danger btn-full cash-close-btn">
                  <KeyIcon size={14} /> {t("cashControl.closeBtn")}
                </button>
              </form>
            </div>
          ) : (
            <form className="cash-open" onSubmit={handleOpen}>
              <header className="cash-panel-head">
                <div className="cash-panel-head-main">
                  <div className="cash-panel-icon">
                    <UnlockIcon size={18} />
                  </div>
                  <div>
                    <p className="cash-panel-eyebrow">{t("cashControl.openEyebrow")}</p>
                    <h3>{t("cashControl.openTitle")}</h3>
                    <p className="cash-panel-meta">{t("cashControl.openDesc")}</p>
                  </div>
                </div>
              </header>

              <div className="cash-open-body">
                <div className="form-group">
                  <label>{t("cashControl.initialAmount")}</label>
                  <div className="cash-money-input cash-money-input--lg">
                    <span>{symbol}</span>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      placeholder="100.00"
                      value={initialBalanceInput}
                      onChange={(e) => setInitialBalanceInput(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div className="cash-preset-row">
                  <span className="cash-preset-label">{t("cashControl.presetLabel")}</span>
                  <div className="cash-preset-chips">
                    {PRESET_AMOUNTS.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        className={`cash-preset-chip${initialBalanceInput === String(amount) ? " is-active" : ""}`}
                        onClick={() => setInitialBalanceInput(String(amount))}
                      >
                        {formatMoney(amount)}
                      </button>
                    ))}
                  </div>
                </div>

                <button type="submit" className="btn btn-primary btn-full cash-open-btn">
                  <KeyIcon size={14} /> {t("cashControl.openBtn")}
                </button>

                <aside className="cash-tips-card">
                  <h4>{t("cashControl.tipsTitle")}</h4>
                  <ul>
                    <li>{t("cashControl.tip1")}</li>
                    <li>{t("cashControl.tip2")}</li>
                    <li>{t("cashControl.tip3")}</li>
                  </ul>
                </aside>
              </div>
            </form>
          )}
        </section>

        <section className="cash-panel card-glass cash-panel--history">
          <header className="cash-panel-head cash-panel-head--history">
            <div className="cash-panel-head-main">
              <div className="cash-panel-icon cash-panel-icon--history">
                <HistoryIcon size={18} />
              </div>
              <div>
                <p className="cash-panel-eyebrow">{t("cashControl.historyEyebrow")}</p>
                <h3>{t("cashControl.historyTitle")}</h3>
                <p className="cash-panel-meta">{t("cashControl.historyDesc")}</p>
              </div>
            </div>
            {closedSessions.length > 0 && (
              <span className="cash-history-count">{t("cashControl.sessionsCount", { count: closedSessions.length })}</span>
            )}
          </header>

          {closedSessions.length === 0 ? (
            <div className="cash-history-empty">
              <div className="cash-history-empty-icon">
                <HistoryIcon size={28} />
              </div>
              <h4>{t("cashControl.historyEmptyTitle")}</h4>
              <p>{t("cashControl.historyEmptyDesc")}</p>
              <div className="cash-history-empty-steps">
                <span><KeyIcon size={12} /> {t("cashControl.stepOpen")}</span>
                <span><CartIcon size={12} /> {t("cashControl.stepSell")}</span>
                <span><LockIcon size={12} /> {t("cashControl.stepClose")}</span>
              </div>
            </div>
          ) : (
            <div className="cash-history-list">
              {closedSessions.map((s) => {
                const diff = s.difference || 0;
                const meta = differenceMeta(diff);
                return (
                  <article key={s.id} className="cash-history-card">
                    <div className="cash-history-card-head">
                      <div>
                        <span className="cash-history-card-date">{formatDate(s.startTime)}</span>
                        <span className="cash-history-card-arrow">→</span>
                        <span className="cash-history-card-date">{formatDate(s.endTime || "")}</span>
                      </div>
                      <span className={meta.className}>
                        {meta.prefix} · {meta.label}
                      </span>
                    </div>
                    <div className="cash-history-card-grid">
                      <div>
                        <span>{t("cashControl.colInitial")}</span>
                        <strong>{formatMoney(s.initialBalance)}</strong>
                      </div>
                      <div>
                        <span>{t("cashControl.colExpected")}</span>
                        <strong>{formatMoney(s.expectedCash)}</strong>
                      </div>
                      <div>
                        <span>{t("cashControl.colActual")}</span>
                        <strong>{formatMoney(s.actualCash || 0)}</strong>
                      </div>
                    </div>
                    {s.notes && <p className="cash-history-card-notes">{s.notes}</p>}
                    <button type="button" className="btn btn-secondary btn-sm cash-edit-btn" onClick={() => setEditingSessionId(s.id)}>
                      <EditIcon size={14} /> {t("cashControl.edit")}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {showTransModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {transType === "withdrawal" ? (
                  <MinusIcon size={18} style={{ color: "var(--danger)" }} />
                ) : (
                  <PlusIcon size={18} style={{ color: "var(--success)" }} />
                )}
                {transType === "withdrawal" ? t("cashControl.transWithdraw") : t("cashControl.transDeposit")}
              </h3>
              <button className="modal-close" onClick={() => setShowTransModal(false)}>×</button>
            </div>
            <form onSubmit={handleTransaction}>
              <div className="form-group">
                <label>{t("cashControl.transAmount")} ({symbol})</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-control"
                  placeholder="0.00"
                  value={transAmount}
                  onChange={(e) => setTransAmount(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>{t("cashControl.transReason")}</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder={
                    transType === "withdrawal"
                      ? t("cashControl.transWithdrawPlaceholder")
                      : t("cashControl.transDepositPlaceholder")
                  }
                  value={transNotes}
                  onChange={(e) => setTransNotes(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowTransModal(false)}>
                  {t("cashControl.cancel")}
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  {t("cashControl.confirm")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingSession && (
        <SessionEditModal
          session={editingSession}
          sales={sales}
          sessions={sessions}
          onSave={onUpdateSession}
          onUpdateSale={onUpdateSale}
          onDeleteSale={onDeleteSale}
          onClose={closeSessionEditor}
        />
      )}
    </div>
  );
};